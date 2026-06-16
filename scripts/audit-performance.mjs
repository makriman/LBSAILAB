import { performance } from "node:perf_hooks";

const SITE_URL = process.env.SEO_SITE_URL || "https://lbsailab.com";
const SITE_ORIGIN = new URL(SITE_URL).origin;
const MAX_HTML_BYTES = 90 * 1024;
const MAX_CSS_BYTES_PER_PAGE = 90 * 1024;
const MAX_INLINE_SCRIPT_BYTES = 18 * 1024;
const MAX_IMAGE_BYTES = 220 * 1024;
const MAX_FONT_BYTES = 110 * 1024;
const MAX_DOCUMENT_MS = 2200;
const REQUIRED_FONT_PRELOADS = 2;
const ALLOWED_EXTERNAL_SCRIPT_PATTERNS = [
  /^https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js(?:\/|$)/,
];
const failures = [];

function fail(message) {
  failures.push(message);
}

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function allTags(html, tagName) {
  return [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "gi"))].map(
    (match) => match[0],
  );
}

function attrs(tag) {
  const attributes = {};
  const source = tag
    .replace(/^<[^\s>]+\s*/i, "")
    .replace(/\/?>$/i, "")
    .trim();

  for (const match of source.matchAll(/([\w:-]+)(?:\s*=\s*(["'])(.*?)\2)?/g)) {
    attributes[match[1].toLowerCase()] =
      match[3] === undefined ? "" : decodeHtml(match[3]);
  }

  return attributes;
}

function byteLength(value) {
  return new TextEncoder().encode(value).byteLength;
}

function normalizeUrl(value, base = SITE_ORIGIN) {
  try {
    const url = new URL(decodeHtml(value), base);
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) =>
    decodeHtml(match[1].trim()),
  );
}

function isSameOrigin(url) {
  return new URL(url).origin === SITE_ORIGIN;
}

function isAllowedExternalScript(url) {
  return ALLOWED_EXTERNAL_SCRIPT_PATTERNS.some((pattern) => pattern.test(url));
}

function isTextLike(url, contentType) {
  const pathname = new URL(url).pathname;

  return (
    contentType.includes("text/") ||
    contentType.includes("application/xml") ||
    contentType.includes("application/json") ||
    contentType.includes("application/atom+xml") ||
    pathname.endsWith(".css") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".xml") ||
    pathname.endsWith(".json")
  );
}

function contentEncoding(response) {
  return response.headers.get("content-encoding") || "";
}

function cacheControl(response) {
  return response.headers.get("cache-control") || "";
}

function auditEdgeDelivery(response, url) {
  const server = response.headers.get("server") || "";
  const altSvc = response.headers.get("alt-svc") || "";
  const cacheStatus = response.headers.get("cf-cache-status") || "";

  if (server !== "cloudflare") {
    fail(`${url}: expected Cloudflare server header, got "${server}"`);
  }

  if (!altSvc.includes("h3")) {
    fail(`${url}: expected HTTP/3 alt-svc advertisement, got "${altSvc}"`);
  }

  if (!cacheStatus) {
    fail(`${url}: missing Cloudflare cache status header`);
  }
}

async function fetchText(url, accept = "*/*") {
  const startedAt = performance.now();
  const response = await fetch(url, {
    headers: {
      Accept: accept,
      "Accept-Encoding": "br, gzip",
      "User-Agent": "lbsailab-performance-audit/1.0",
    },
  });
  const text = await response.text();
  const elapsedMs = performance.now() - startedAt;

  return { elapsedMs, response, text };
}

async function fetchBytes(url, accept = "*/*") {
  const response = await fetch(url, {
    headers: {
      Accept: accept,
      "Accept-Encoding": "br, gzip",
      "User-Agent": "lbsailab-performance-audit/1.0",
    },
  });
  const bytes = Buffer.from(await response.arrayBuffer());

  return { bytes, response };
}

async function sitemapPages() {
  const { response, text } = await fetchText(
    `${SITE_ORIGIN}/sitemap-0.xml`,
    "application/xml",
  );

  if (response.status !== 200) {
    fail(`sitemap-0.xml expected 200, got ${response.status}`);
    return [];
  }

  return extractLocs(text);
}

function srcsetUrls(value, base) {
  return value
    .split(",")
    .map((item) => item.trim().split(/\s+/)[0])
    .filter(Boolean)
    .map((item) => normalizeUrl(item, base))
    .filter(Boolean);
}

function pageAssets(html, pageUrl) {
  const stylesheets = new Set();
  const images = new Set();
  const fontPreloads = new Set();
  const externalScripts = [];
  let inlineScriptBytes = 0;

  for (const tag of allTags(html, "link")) {
    const link = attrs(tag);
    const rel = (link.rel || "").split(/\s+/);
    const href = link.href ? normalizeUrl(link.href, pageUrl) : null;

    if (!href || !isSameOrigin(href)) continue;

    if (rel.includes("stylesheet")) stylesheets.add(href);

    if (rel.includes("preload") && link.as === "font") {
      fontPreloads.add(href);

      if (!("crossorigin" in link)) {
        fail(`${pageUrl}: font preload missing crossorigin for ${href}`);
      }
    }

    if (rel.includes("preload") && link.as === "image") {
      images.add(href);
      for (const srcsetUrl of srcsetUrls(
        link.imagesrcset || link.srcset || "",
        pageUrl,
      )) {
        if (isSameOrigin(srcsetUrl)) images.add(srcsetUrl);
      }
    }
  }

  for (const tag of allTags(html, "script")) {
    const script = attrs(tag);

    if (script.src) {
      const src = normalizeUrl(script.src, pageUrl);

      if (src && !isSameOrigin(src)) externalScripts.push(src);
      continue;
    }

    const type = script.type || "";

    if (type !== "application/ld+json") {
      inlineScriptBytes += byteLength(
        tag.replace(/^<script\b[^>]*>/i, "").replace(/<\/script>$/i, ""),
      );
    }
  }

  for (const tag of allTags(html, "img")) {
    const image = attrs(tag);

    if (image.src) {
      const src = normalizeUrl(image.src, pageUrl);
      if (src && isSameOrigin(src)) images.add(src);
    }

    for (const srcsetUrl of srcsetUrls(image.srcset || "", pageUrl)) {
      if (isSameOrigin(srcsetUrl)) images.add(srcsetUrl);
    }

    if (!image.width || !image.height) {
      fail(`${pageUrl}: image missing explicit dimensions (${image.src})`);
    }
  }

  for (const tag of allTags(html, "source")) {
    const source = attrs(tag);

    for (const srcsetUrl of srcsetUrls(source.srcset || "", pageUrl)) {
      if (isSameOrigin(srcsetUrl)) images.add(srcsetUrl);
    }
  }

  return {
    externalScripts,
    fontPreloads,
    images,
    inlineScriptBytes,
    stylesheets,
  };
}

function auditHeroPreload(html, pageUrl) {
  if (pageUrl !== `${SITE_ORIGIN}/`) return;

  const heroPreload = allTags(html, "link")
    .map(attrs)
    .find((link) => link.rel === "preload" && link.as === "image");

  if (!heroPreload) {
    fail(`${pageUrl}: missing hero image preload`);
    return;
  }

  if (heroPreload.type !== "image/avif") {
    fail(`${pageUrl}: hero preload should prefer AVIF`);
  }

  if (!heroPreload.imagesrcset || !heroPreload.imagesizes) {
    fail(`${pageUrl}: hero preload missing responsive image metadata`);
  }

  if (!heroPreload.imagesrcset?.includes(".avif")) {
    fail(`${pageUrl}: hero preload srcset should include AVIF variants`);
  }

  const heroImage = allTags(html, "img")
    .map(attrs)
    .find((image) => image.fetchpriority === "high");

  if (!heroImage) {
    fail(`${pageUrl}: missing high-priority hero image`);
  } else if (heroImage.loading !== "eager") {
    fail(`${pageUrl}: hero image should load eagerly`);
  }
}

async function auditStylesheet(url) {
  const { bytes, response } = await fetchBytes(url, "text/css");
  const contentType = response.headers.get("content-type") || "";

  if (response.status !== 200) {
    fail(`${url}: stylesheet expected 200, got ${response.status}`);
    return 0;
  }

  auditEdgeDelivery(response, url);

  if (!contentType.includes("text/css")) {
    fail(`${url}: expected text/css, got ${contentType}`);
  }

  if (!cacheControl(response).includes("max-age=31536000")) {
    fail(`${url}: stylesheet missing immutable long-lived cache`);
  }

  if (!contentEncoding(response)) {
    fail(`${url}: stylesheet is not compressed`);
  }

  const css = bytes.toString("utf8");

  if (css.includes("@font-face") && !css.includes("font-display:swap")) {
    fail(`${url}: font CSS missing font-display swap`);
  }

  return bytes.byteLength;
}

async function auditImage(url) {
  const { bytes, response } = await fetchBytes(
    url,
    "image/avif,image/webp,image/*",
  );
  const contentType = response.headers.get("content-type") || "";

  if (response.status !== 200) {
    fail(`${url}: image expected 200, got ${response.status}`);
    return;
  }

  auditEdgeDelivery(response, url);

  if (!contentType.startsWith("image/")) {
    fail(`${url}: expected image content type, got ${contentType}`);
  }

  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    fail(`${url}: image is ${(bytes.byteLength / 1024).toFixed(1)}KB`);
  }

  if (!cacheControl(response).includes("max-age=31536000")) {
    fail(`${url}: image missing immutable long-lived cache`);
  }
}

async function auditFont(url) {
  const { bytes, response } = await fetchBytes(url, "font/woff2,*/*");
  const contentType = response.headers.get("content-type") || "";

  if (response.status !== 200) {
    fail(`${url}: font expected 200, got ${response.status}`);
    return;
  }

  auditEdgeDelivery(response, url);

  if (!contentType.includes("font") && !contentType.includes("octet-stream")) {
    fail(`${url}: expected font content type, got ${contentType}`);
  }

  if (bytes.byteLength > MAX_FONT_BYTES) {
    fail(`${url}: font is ${(bytes.byteLength / 1024).toFixed(1)}KB`);
  }

  if (!cacheControl(response).includes("max-age=31536000")) {
    fail(`${url}: font missing immutable long-lived cache`);
  }
}

async function auditPage(pageUrl) {
  const { elapsedMs, response, text } = await fetchText(pageUrl, "text/html");
  const contentType = response.headers.get("content-type") || "";

  if (response.status !== 200) {
    fail(`${pageUrl}: expected 200, got ${response.status}`);
    return;
  }

  auditEdgeDelivery(response, pageUrl);

  if (!contentType.includes("text/html")) {
    fail(`${pageUrl}: expected text/html, got ${contentType}`);
  }

  if (!contentEncoding(response)) {
    fail(`${pageUrl}: HTML is not compressed`);
  }

  if (elapsedMs > MAX_DOCUMENT_MS) {
    fail(`${pageUrl}: document response took ${Math.round(elapsedMs)}ms`);
  }

  const htmlBytes = byteLength(text);

  if (htmlBytes > MAX_HTML_BYTES) {
    fail(`${pageUrl}: HTML is ${(htmlBytes / 1024).toFixed(1)}KB`);
  }

  const assets = pageAssets(text, pageUrl);

  if (assets.fontPreloads.size < REQUIRED_FONT_PRELOADS) {
    fail(
      `${pageUrl}: expected at least ${REQUIRED_FONT_PRELOADS} font preloads`,
    );
  }

  const unexpectedExternalScripts = assets.externalScripts.filter(
    (script) => !isAllowedExternalScript(script),
  );

  if (unexpectedExternalScripts.length) {
    fail(
      `${pageUrl}: unexpected external scripts found (${unexpectedExternalScripts.join(", ")})`,
    );
  }

  if (assets.inlineScriptBytes > MAX_INLINE_SCRIPT_BYTES) {
    fail(
      `${pageUrl}: inline JavaScript is ${(assets.inlineScriptBytes / 1024).toFixed(1)}KB`,
    );
  }

  auditHeroPreload(text, pageUrl);

  let cssBytes = 0;

  for (const stylesheet of assets.stylesheets) {
    cssBytes += await auditStylesheet(stylesheet);
  }

  if (cssBytes > MAX_CSS_BYTES_PER_PAGE) {
    fail(`${pageUrl}: CSS payload is ${(cssBytes / 1024).toFixed(1)}KB`);
  }

  for (const font of assets.fontPreloads) {
    await auditFont(font);
  }

  for (const image of assets.images) {
    await auditImage(image);
  }
}

async function auditUtilityCompression() {
  for (const url of [
    `${SITE_ORIGIN}/robots.txt`,
    `${SITE_ORIGIN}/sitemap-index.xml`,
    `${SITE_ORIGIN}/sitemap-0.xml`,
    `${SITE_ORIGIN}/image-sitemap.xml`,
    `${SITE_ORIGIN}/llms.txt`,
    `${SITE_ORIGIN}/llms-full.txt`,
  ]) {
    const { response } = await fetchText(url);
    const type = response.headers.get("content-type") || "";

    if (response.status !== 200) {
      fail(`${url}: crawler utility expected 200, got ${response.status}`);
      continue;
    }

    auditEdgeDelivery(response, url);

    if (isTextLike(url, type) && !contentEncoding(response)) {
      fail(`${url}: text crawler utility is not compressed`);
    }
  }
}

async function auditPerformance() {
  const pages = await sitemapPages();

  for (const page of pages) {
    await auditPage(page);
  }

  await auditUtilityCompression();

  if (failures.length) {
    console.error("Performance SEO audit failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(
    `Performance SEO audit passed for ${pages.length} canonical pages on ${new URL(SITE_URL).host}.`,
  );
}

auditPerformance().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
