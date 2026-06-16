import { lookup as systemLookup, setServers } from "node:dns";
import { createHash } from "node:crypto";
import { Resolver } from "node:dns/promises";
import http from "node:http";
import https from "node:https";

const SITE_URL = process.env.SEO_SITE_URL || "https://lbsailab.com";
const SITE = new URL(SITE_URL);
const SITE_ORIGIN = SITE.origin;
const SITE_HOST = SITE.host;
const INDEXABLE_ROBOTS =
  "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";
const INDEXABLE_META_ROBOTS =
  "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1";
const NOINDEX_ROBOTS = "noindex, nofollow";
const EXPECTED_LAST_MODIFIED = "Tue, 16 Jun 2026 00:00:00 GMT";
const EXPECTED_DATE_MODIFIED = "2026-06-16";
const EXPECTED_UPDATED_TIME = "2026-06-16T00:00:00.000Z";
const EXPECTED_CONTENT_LANGUAGE = "en-GB";
const EXPECTED_ORGANIZATION_TOPICS = [
  "AI product development",
  "AI-assisted application development",
  "London Business School workflows",
  "Product prototyping",
  "Applied AI education",
];
const REQUIRED_SECURITY_HEADERS = [
  "content-security-policy",
  "cross-origin-opener-policy",
  "origin-agent-cluster",
  "strict-transport-security",
  "x-content-type-options",
  "x-dns-prefetch-control",
  "x-frame-options",
  "x-permitted-cross-domain-policies",
  "referrer-policy",
  "permissions-policy",
];
const REQUIRED_ROBOTS_DISALLOWS = [
  "/api/",
  "/admin/",
  "/login/",
  "/search/",
  "/cart/",
  "/checkout/",
  "/healthz",
  "/internal/",
  "/private/",
];
const REQUIRED_SITEMAPS = [
  `${SITE_ORIGIN}/sitemap-index.xml`,
  `${SITE_ORIGIN}/image-sitemap.xml`,
  `${SITE_ORIGIN}/feed.xml`,
];
const REQUIRED_MANIFEST_ICONS = [
  {
    src: "/favicon/favicon-16x16.png",
    sizes: "16x16",
    type: "image/png",
    width: 16,
    height: 16,
  },
  {
    src: "/favicon/favicon-32x32.png",
    sizes: "32x32",
    type: "image/png",
    width: 32,
    height: 32,
  },
  {
    src: "/favicon/apple-touch-icon.png",
    sizes: "180x180",
    type: "image/png",
    width: 180,
    height: 180,
  },
  {
    src: "/favicon/icon-192.png",
    sizes: "192x192",
    type: "image/png",
    width: 192,
    height: 192,
  },
  {
    src: "/favicon/icon-512.png",
    sizes: "512x512",
    type: "image/png",
    width: 512,
    height: 512,
  },
];
const DUPLICATE_ORIGINS = (
  process.env.SEO_DUPLICATE_ORIGINS ||
  "https://lbsailab.zahra-moghadasi.workers.dev"
)
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter((origin) => origin && origin !== SITE_ORIGIN);
const LONG_CACHE_PATHS = [
  /^\/_astro\//,
  /^\/images\//,
  /^\/mentors\/.*\.(jpg|png)$/i,
  /^\/favicon\//,
  /^\/favicon\.(?:ico|svg)$/i,
  /^\/og-[^/]+\.png$/,
  /^\/google-deepmind-logo-[^/]+\.png$/,
  /^\/site\.webmanifest$/,
];
const ALLOWED_EXTERNAL_SCRIPT_PATTERNS = [
  /^https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js(?:\/|$)/,
];
const ALLOWED_EXTERNAL_LINK_HOSTS = new Set([
  "briefd.lbsailab.com",
  "compass.lbsailab.com",
  "deepmind.google",
  "funded.lbsailab.com",
  "londoneatspal.lbsailab.com",
  "recruitsmart.lbsailab.com",
  "wayfinder.lbsailab.com",
  "www.emsplusplus.com",
  "www.linkedin.com",
  "www.london.edu",
  "zentra.lbsailab.com",
]);
const ALLOWED_EXTERNAL_RESOURCE_HOSTS = new Set([SITE_HOST]);
const FORBIDDEN_EMBED_TAGS = ["iframe", "object", "embed", "applet", "base"];
const LINK_ATTRIBUTES = ["href", "src", "action", "formaction"];
const SPAM_PATTERNS = [
  /\bviagra\b/i,
  /\bcialis\b/i,
  /\bonline\s+pharmacy\b/i,
  /\bcasino\b/i,
  /\bsports\s+betting\b/i,
  /\bpayday\s+loans?\b/i,
  /\bforex\s+signals?\b/i,
  /\bessay\s+writing\s+service\b/i,
];
const LEGACY_URLS = [
  ["/cohorts", `${SITE_ORIGIN}/batches/`],
  ["/cohorts/cohort-01", `${SITE_ORIGIN}/batches/spring-2026/`],
  ["/teams", `${SITE_ORIGIN}/batches/spring-2026/`],
  [
    "/teams/campus-collective",
    `${SITE_ORIGIN}/batches/spring-2026/london-eats-pal/`,
  ],
  ["/teams/wayfinders", `${SITE_ORIGIN}/batches/spring-2026/wayfinder/`],
];
const CANONICAL_REDIRECTS = [
  [`http://${SITE_HOST}/about`, `${SITE_ORIGIN}/about/`],
  [`https://www.${SITE_HOST}/about`, `${SITE_ORIGIN}/about/`],
  [`${SITE_ORIGIN}/sitemap.xml`, `${SITE_ORIGIN}/sitemap-index.xml`],
  [`${SITE_ORIGIN}/feed`, `${SITE_ORIGIN}/feed.xml`],
  [`${SITE_ORIGIN}/rss`, `${SITE_ORIGIN}/feed.xml`],
  [`${SITE_ORIGIN}/rss.xml`, `${SITE_ORIGIN}/feed.xml`],
  [`${SITE_ORIGIN}/atom`, `${SITE_ORIGIN}/feed.xml`],
  [`${SITE_ORIGIN}/atom.xml`, `${SITE_ORIGIN}/feed.xml`],
  [`${SITE_ORIGIN}/About`, `${SITE_ORIGIN}/about/`],
  [`${SITE_ORIGIN}/index.html`, `${SITE_ORIGIN}/`],
  [`${SITE_ORIGIN}/about/index.html`, `${SITE_ORIGIN}/about/`],
  [
    `${SITE_ORIGIN}/batches/spring-2026/wayfinder/index.html`,
    `${SITE_ORIGIN}/batches/spring-2026/wayfinder/`,
  ],
  [
    `${SITE_ORIGIN}/cohorts/cohort-01/index.html`,
    `${SITE_ORIGIN}/batches/spring-2026/`,
  ],
  [`${SITE_ORIGIN}/about`, `${SITE_ORIGIN}/about/`],
  [`${SITE_ORIGIN}/about/?utm_source=test&gclid=test`, `${SITE_ORIGIN}/about/`],
  [`${SITE_ORIGIN}/about/?preview=true&foo=bar`, `${SITE_ORIGIN}/about/`],
  ...DUPLICATE_ORIGINS.map((origin) => [
    `${origin}/about`,
    `${SITE_ORIGIN}/about/`,
  ]),
];
const GONE_URLS = [
  "/_headers",
  "/_headers/",
  "/_redirects",
  "/_redirects/",
  "/images/lbs-ai-lab-workshop-hero.png",
  "/mentors/rhea-bisaria.png",
];
const BOT_PROTECTED_EXTERNAL_HOSTS = new Set([
  "linkedin.com",
  "www.linkedin.com",
  "uk.linkedin.com",
]);
const failures = [];
const warnings = [];
const publicResolver = new Resolver();

setServers(["1.1.1.1", "8.8.8.8"]);
publicResolver.setServers(["1.1.1.1", "8.8.8.8"]);

function fail(message) {
  failures.push(message);
}

function attrs(tag) {
  const attributes = {};

  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)) {
    attributes[match[1].toLowerCase()] = decodeHtml(match[3]);
  }

  return attributes;
}

function openingTag(tag) {
  return tag.match(/^<[^>]+>/i)?.[0] || tag;
}

function allTags(html, tagName) {
  return [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "gi"))].map(
    (match) => match[0],
  );
}

function fullTags(html, tagName) {
  return [
    ...html.matchAll(
      new RegExp(`<${tagName}\\b[^>]*>[\\s\\S]*?<\\/${tagName}>`, "gi"),
    ),
  ].map((match) => match[0]);
}

function decodeHtml(value) {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) =>
      String.fromCodePoint(Number.parseInt(hex, 16)),
    )
    .replace(/&#(\d+);/g, (_, code) =>
      String.fromCodePoint(Number.parseInt(code, 10)),
    )
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function textContent(markup) {
  return decodeHtml(
    markup
      .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) =>
    decodeHtml(match[1].trim()),
  );
}

function extractImageLocs(xml) {
  return [...xml.matchAll(/<image:loc>(.*?)<\/image:loc>/g)].map((match) =>
    decodeHtml(match[1].trim()),
  );
}

function executableInlineScriptHashes(html) {
  return fullTags(html, "script")
    .map((tag) => ({
      attributes: attrs(tag.match(/^<script\b[^>]*>/i)?.[0] || tag),
      tag,
    }))
    .filter(({ attributes }) => !attributes.src)
    .filter(({ attributes }) => {
      const type = (attributes.type || "").toLowerCase();
      return (
        !type ||
        type === "module" ||
        type === "text/javascript" ||
        type === "application/javascript"
      );
    })
    .map(({ tag }) => {
      const script = tag
        .replace(/^<script\b[^>]*>/i, "")
        .replace(/<\/script>$/i, "");
      return `sha256-${createHash("sha256").update(script).digest("base64")}`;
    });
}

function cspDirective(csp, name) {
  return (
    csp
      .split(";")
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith(`${name} `)) || ""
  );
}

function htmlWithoutRawTextBlocks(html) {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/<style\b[\s\S]*?<\/style>/gi, "");
}

function inlineEventHandlerAttributes(html) {
  return [
    ...htmlWithoutRawTextBlocks(html).matchAll(/<([a-z][\w:-]*)\b([^>]*)>/gi),
  ].flatMap((match) => {
    const tagName = match[1].toLowerCase();
    const attributeText = match[2] || "";

    return [...attributeText.matchAll(/(?:^|\s)(on[a-z][\w:-]*)\s*=/gi)].map(
      (attributeMatch) => ({
        attribute: attributeMatch[1].toLowerCase(),
        tagName,
      }),
    );
  });
}

function metaContent(html, selector) {
  for (const tag of allTags(html, "meta")) {
    const attributes = attrs(tag);

    if (attributes.name === selector || attributes.property === selector) {
      return attributes.content || "";
    }
  }

  return "";
}

function linkAttrs(html, rel) {
  return allTags(html, "link")
    .map(attrs)
    .filter((attributes) => {
      const relValue = attributes.rel || "";
      return relValue.split(/\s+/).includes(rel);
    });
}

function normalizeUrl(url, base = SITE_ORIGIN) {
  try {
    const parsed = new URL(decodeHtml(url), base);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return null;
  }
}

function sameOrigin(url) {
  return new URL(url).origin === SITE_ORIGIN;
}

function isExternalUrl(url) {
  return ["http:", "https:"].includes(url.protocol) && url.host !== SITE_HOST;
}

function isJsonLdType(item, type) {
  const itemType = item?.["@type"];

  return Array.isArray(itemType) ? itemType.includes(type) : itemType === type;
}

function isCanonicalPageUrl(url) {
  const parsed = new URL(url);
  return sameOrigin(url) && parsed.pathname.endsWith("/") && !parsed.search;
}

function isLongCachePath(pathname) {
  return LONG_CACHE_PATHS.some((pattern) => pattern.test(pathname));
}

function isAllowedExternalScript(url) {
  return ALLOWED_EXTERNAL_SCRIPT_PATTERNS.some((pattern) => pattern.test(url));
}

function isDangerousDataUrl(value) {
  return /^data\s*:\s*(?:text\/html|application\/javascript|text\/javascript)/i.test(
    value,
  );
}

function isHiddenLink(attributes) {
  const style = attributes.style || "";

  return (
    "hidden" in attributes ||
    attributes["aria-hidden"] === "true" ||
    /(?:^|;)\s*display\s*:\s*none\b/i.test(style) ||
    /(?:^|;)\s*visibility\s*:\s*hidden\b/i.test(style) ||
    /(?:^|;)\s*opacity\s*:\s*0(?:[;\s]|$)/i.test(style)
  );
}

function isNonBlockingScript(attributes) {
  const type = (attributes.type || "").toLowerCase();

  return (
    "async" in attributes ||
    "defer" in attributes ||
    type === "module" ||
    type === "application/ld+json"
  );
}

function pngDimensions(bytes) {
  const signature = bytes.subarray(0, 8).toString("hex");

  if (signature !== "89504e470d0a1a0a" || bytes.length < 24) {
    return null;
  }

  return {
    height: bytes.readUInt32BE(20),
    width: bytes.readUInt32BE(16),
  };
}

function isBotProtectedExternalHost(hostname) {
  return BOT_PROTECTED_EXTERNAL_HOSTS.has(hostname);
}

async function get(url, options = {}) {
  try {
    return await fetch(url, {
      redirect: options.redirect || "follow",
      signal: AbortSignal.timeout(options.timeoutMs || 15000),
      headers: {
        "User-Agent": "lbsailab-seo-audit/1.0",
        Accept: options.accept || "*/*",
        "Accept-Encoding": options.acceptEncoding || "identity",
      },
    });
  } catch (error) {
    if (!options.allowFetchFailure) {
      fail(
        `${url}: fetch failed (${error instanceof Error ? error.message : String(error)})`,
      );
    }

    return new Response("", {
      status: 599,
      statusText: "Fetch Failed",
    });
  }
}

async function text(url, options = {}) {
  const response = await get(url, options);
  const body = await response.text();

  return { response, body };
}

async function bytes(url, options = {}) {
  const response = await get(url, options);
  const body = Buffer.from(await response.arrayBuffer());

  return { response, body };
}

async function redirectTrace(url, limit = 6) {
  const hops = [];
  let current = new URL(url, SITE_ORIGIN).toString();

  for (let index = 0; index < limit; index += 1) {
    let response;

    try {
      response = await manualRedirectRequest(current);
    } catch (error) {
      hops.push({
        error: error instanceof Error ? error.message : String(error),
        location: null,
        status: 599,
        url: current,
      });
      return hops;
    }

    const location = response.headers.get("location");
    hops.push({ error: null, location, status: response.status, url: current });

    if (!location || response.status < 300 || response.status >= 400) {
      return hops;
    }

    current = new URL(location, current).toString();
  }

  fail(`${url}: redirect chain exceeded ${limit} hops`);
  return hops;
}

async function manualRedirectRequest(url) {
  const parsed = new URL(url);
  const transport = parsed.protocol === "http:" ? http : https;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      parsed,
      {
        headers: {
          "User-Agent": "lbsailab-seo-audit/1.0",
        },
        lookup: publicDnsFallbackLookup,
        method: "HEAD",
      },
      (response) => {
        response.resume();
        response.on("end", () => {
          resolve({
            headers: {
              get(name) {
                const value = response.headers[name.toLowerCase()];
                if (Array.isArray(value)) return value.join(", ");
                return value || null;
              },
            },
            status: response.statusCode || 0,
          });
        });
      },
    );

    request.on("error", reject);
    request.end();
  });
}

async function publicDnsFallbackLookup(hostname, options, callback) {
  systemLookup(
    hostname,
    {
      family: options?.family || 0,
      hints: options?.hints || 0,
    },
    async (systemError, address, family) => {
      if (!systemError && address) {
        lookupCallback(callback, address, family, Boolean(options?.all));
        return;
      }

      try {
        const [publicAddress] = await publicResolver.resolve4(hostname);

        if (!publicAddress) {
          throw new Error(`No public A record for ${hostname}`);
        }

        lookupCallback(callback, publicAddress, 4, Boolean(options?.all));
      } catch (error) {
        callback(error);
      }
    },
  );
}

function lookupCallback(callback, address, family, all) {
  if (all) {
    callback(null, [{ address, family }]);
    return;
  }

  callback(null, address, family);
}

function assertHeader(response, name, url) {
  if (!response.headers.has(name)) {
    fail(`${url}: missing ${name} header`);
  }
}

function assertSecurityHeaders(response, url) {
  for (const header of REQUIRED_SECURITY_HEADERS) {
    assertHeader(response, header, url);
  }

  const hsts = response.headers.get("strict-transport-security") || "";

  if (!hsts.includes("max-age=31536000")) {
    fail(`${url}: HSTS should include max-age=31536000`);
  }

  if ((response.headers.get("x-content-type-options") || "") !== "nosniff") {
    fail(`${url}: x-content-type-options should be nosniff`);
  }
}

function assertPageCsp(response, html, url) {
  const csp = response.headers.get("content-security-policy") || "";
  const scriptSrc = cspDirective(csp, "script-src");
  const scriptSrcAttr = cspDirective(csp, "script-src-attr");

  if (!scriptSrc) {
    fail(`${url}: CSP is missing script-src`);
    return;
  }

  if (!scriptSrcAttr.split(/\s+/).includes("'none'")) {
    fail(`${url}: CSP script-src-attr must be 'none'`);
  }

  if (/\b'unsafe-inline'\b/.test(scriptSrc)) {
    fail(`${url}: CSP script-src must not allow unsafe-inline`);
  }

  if (!scriptSrc.includes("https://static.cloudflareinsights.com")) {
    fail(`${url}: CSP script-src missing Cloudflare Insights origin`);
  }

  for (const hash of executableInlineScriptHashes(html)) {
    if (!scriptSrc.includes(`'${hash}'`)) {
      fail(`${url}: CSP script-src missing '${hash}'`);
    }
  }

  for (const eventHandler of inlineEventHandlerAttributes(html)) {
    fail(
      `${url}: inline event handler ${eventHandler.attribute} found on <${eventHandler.tagName}>`,
    );
  }
}

function assertIndexableHeaders(response, url) {
  const robots = response.headers.get("x-robots-tag") || "";
  const language = response.headers.get("content-language") || "";

  if (robots !== INDEXABLE_ROBOTS) {
    fail(
      `${url}: X-Robots-Tag expected "${INDEXABLE_ROBOTS}", got "${robots}"`,
    );
  }

  if (language !== EXPECTED_CONTENT_LANGUAGE) {
    fail(
      `${url}: Content-Language expected "${EXPECTED_CONTENT_LANGUAGE}", got "${language || "(missing)"}"`,
    );
  }
}

function assertShortCache(response, url) {
  const cacheControl = response.headers.get("cache-control") || "";

  if (!cacheControl.includes("max-age=300")) {
    fail(`${url}: expected short HTML/utility cache, got "${cacheControl}"`);
  }

  const lastModified = response.headers.get("last-modified") || "";

  if (lastModified !== EXPECTED_LAST_MODIFIED) {
    fail(
      `${url}: expected Last-Modified "${EXPECTED_LAST_MODIFIED}", got "${lastModified || "(missing)"}"`,
    );
  }
}

function assertLongCache(response, url) {
  const cacheControl = response.headers.get("cache-control") || "";

  if (!cacheControl.includes("max-age=31536000")) {
    fail(`${url}: expected long-lived asset cache, got "${cacheControl}"`);
  }
}

async function auditRobots() {
  const url = `${SITE_ORIGIN}/robots.txt`;
  const { response, body } = await text(url, { accept: "text/plain" });

  if (response.status !== 200)
    fail(`${url}: expected 200, got ${response.status}`);
  assertSecurityHeaders(response, url);
  assertPageCsp(response, body, url);
  assertIndexableHeaders(response, url);
  assertShortCache(response, url);

  for (const sitemap of REQUIRED_SITEMAPS) {
    if (!body.includes(`Sitemap: ${sitemap}`)) {
      fail(`${url}: missing sitemap reference ${sitemap}`);
    }
  }

  for (const disallow of REQUIRED_ROBOTS_DISALLOWS) {
    if (!body.includes(`Disallow: ${disallow}`)) {
      fail(`${url}: missing Disallow: ${disallow}`);
    }
  }

  for (const allowedPath of ["/_astro/", "/images/", "/favicon/"]) {
    if (body.includes(`Disallow: ${allowedPath}`)) {
      fail(`${url}: blocks crawlable asset path ${allowedPath}`);
    }
  }

  return body;
}

async function auditSitemaps() {
  const indexUrl = `${SITE_ORIGIN}/sitemap-index.xml`;
  const sitemapUrl = `${SITE_ORIGIN}/sitemap-0.xml`;
  const imageSitemapUrl = `${SITE_ORIGIN}/image-sitemap.xml`;
  const [
    { response: indexResponse, body: index },
    { response, body: sitemap },
  ] = await Promise.all([
    text(indexUrl, { accept: "application/xml" }),
    text(sitemapUrl, { accept: "application/xml" }),
  ]);

  for (const [url, checkedResponse] of [
    [indexUrl, indexResponse],
    [sitemapUrl, response],
  ]) {
    if (checkedResponse.status !== 200) {
      fail(`${url}: expected 200, got ${checkedResponse.status}`);
    }

    assertSecurityHeaders(checkedResponse, url);
    assertIndexableHeaders(checkedResponse, url);
    assertShortCache(checkedResponse, url);
  }

  if (!extractLocs(index).includes(sitemapUrl)) {
    fail(`${indexUrl}: missing ${sitemapUrl}`);
  }

  const pages = extractLocs(sitemap);
  const seen = new Set();

  for (const page of pages) {
    const url = new URL(page);

    if (seen.has(page)) fail(`${sitemapUrl}: duplicate URL ${page}`);
    seen.add(page);

    if (url.origin !== SITE_ORIGIN)
      fail(`${sitemapUrl}: non-canonical URL ${page}`);
    if (!isCanonicalPageUrl(page))
      fail(`${sitemapUrl}: non-canonical page URL ${page}`);
    if (/\/(cohorts?|teams)(\/|$)/.test(url.pathname)) {
      fail(`${sitemapUrl}: legacy URL listed ${page}`);
    }
  }

  const { response: imageResponse, body: imageSitemap } = await text(
    imageSitemapUrl,
    { accept: "application/xml" },
  );

  if (imageResponse.status !== 200) {
    fail(`${imageSitemapUrl}: expected 200, got ${imageResponse.status}`);
  }

  const imageUrls = extractImageLocs(imageSitemap);

  for (const imageUrl of imageUrls) {
    if (!sameOrigin(imageUrl)) {
      fail(`${imageSitemapUrl}: non-canonical image URL ${imageUrl}`);
    }
  }

  return { imageUrls, pages };
}

async function auditFeed() {
  const url = `${SITE_ORIGIN}/feed.xml`;
  const { response, body } = await text(url, {
    accept: "application/atom+xml",
  });
  const contentType = response.headers.get("content-type") || "";

  if (response.status !== 200)
    fail(`${url}: expected 200, got ${response.status}`);
  assertSecurityHeaders(response, url);
  assertIndexableHeaders(response, url);
  assertShortCache(response, url);

  if (!contentType.includes("application/atom+xml")) {
    fail(`${url}: expected Atom content type, got "${contentType}"`);
  }

  if (!body.includes("<feed") || !body.includes(`${SITE_ORIGIN}/feed.xml`)) {
    fail(`${url}: missing Atom feed markers`);
  }
}

async function auditDiscoveryFiles(pages) {
  const discoveryFiles = [
    [`${SITE_ORIGIN}/llms.txt`, "short"],
    [`${SITE_ORIGIN}/llms-full.txt`, "full"],
  ];

  for (const [url, kind] of discoveryFiles) {
    const { response, body } = await text(url, { accept: "text/plain" });
    const contentType = response.headers.get("content-type") || "";

    if (response.status !== 200) {
      fail(`${url}: expected 200, got ${response.status}`);
      continue;
    }

    assertSecurityHeaders(response, url);
    assertIndexableHeaders(response, url);
    assertShortCache(response, url);

    if (!contentType.includes("text/plain")) {
      fail(`${url}: expected text/plain content type, got "${contentType}"`);
    }

    for (const expected of [
      "# LBS AI Lab",
      `${SITE_ORIGIN}/`,
      `${SITE_ORIGIN}/about/`,
      `${SITE_ORIGIN}/batches/`,
      `${SITE_ORIGIN}/batches/spring-2026/`,
      `${SITE_ORIGIN}/mentors/`,
      `${SITE_ORIGIN}/feed.xml`,
      "Google DeepMind",
    ]) {
      if (!body.includes(expected)) {
        fail(`${url}: missing ${expected}`);
      }
    }

    if (/\/(?:cohorts?|teams)(?:\/|$)/i.test(body)) {
      fail(`${url}: includes a legacy Cohort or Team URL`);
    }

    if (/\bmailto:|[a-z0-9._%+-]+@london\.edu\b/i.test(body)) {
      fail(`${url}: should not expose email contact data`);
    }

    const teamPages = pages.filter((page) =>
      /\/batches\/spring-2026\/[^/]+\/$/.test(new URL(page).pathname),
    );

    for (const teamPage of teamPages) {
      if (!body.includes(teamPage)) {
        fail(`${url}: missing Spring 2026 team page ${teamPage}`);
      }
    }

    if (kind === "full") {
      for (const expected of [
        "Kostis Christodoulou",
        "London Eats Pal",
        "Wayfinder",
        "Zentra",
        `${SITE_ORIGIN}/llms.txt`,
        `${SITE_ORIGIN}/llms-full.txt`,
        `${SITE_ORIGIN}/sitemap-index.xml`,
      ]) {
        if (!body.includes(expected)) {
          fail(`${url}: missing ${expected}`);
        }
      }
    }
  }
}

function extractPageLinks(html, pageUrl, sitemapPages) {
  const links = new Set();
  const assets = new Set();
  const externalLinks = new Set();
  const sameOriginNonPages = new Set();

  for (const tag of allTags(html, "a")) {
    const link = attrs(tag);
    const href = link.href || "";

    if (!href || href.startsWith("mailto:") || href.startsWith("tel:"))
      continue;
    if (href === "#" || href.startsWith("javascript:")) {
      fail(`${pageUrl}: non-crawlable link href "${href}"`);
      continue;
    }

    const normalized = normalizeUrl(href, pageUrl);
    if (!normalized) continue;

    if (!sameOrigin(normalized)) {
      const rel = link.rel || "";

      if (
        link.target === "_blank" &&
        (!/\bnoopener\b/.test(rel) || !/\bnoreferrer\b/.test(rel))
      ) {
        fail(
          `${pageUrl}: external new-tab link missing noopener noreferrer (${normalized})`,
        );
      }

      externalLinks.add(normalized);
      continue;
    }

    const parsed = new URL(normalized);

    if (sitemapPages.has(normalized)) {
      links.add(normalized);
    } else if (!parsed.pathname.endsWith("/")) {
      sameOriginNonPages.add(normalized);
    }
  }

  for (const tag of [
    ...allTags(html, "img"),
    ...allTags(html, "script"),
    ...allTags(html, "link"),
    ...allTags(html, "source"),
  ]) {
    const attributes = attrs(tag);
    const candidates = [
      attributes.src,
      attributes.href,
      attributes.srcset,
      attributes.imagesrcset,
    ].filter(Boolean);

    for (const candidate of candidates) {
      for (const item of candidate.split(",")) {
        const token = item.trim().split(/\s+/)[0];
        const normalized = normalizeUrl(token, pageUrl);

        if (normalized && sameOrigin(normalized)) {
          assets.add(normalized);
        }
      }
    }
  }

  return { links, assets, externalLinks, sameOriginNonPages };
}

function assertPageMetadata(html, url) {
  const canonicalLinks = linkAttrs(html, "canonical");
  const alternates = linkAttrs(html, "alternate");
  const manifestLinks = linkAttrs(html, "manifest");
  const iconLinks = linkAttrs(html, "icon");
  const appleTouchIcons = linkAttrs(html, "apple-touch-icon");
  const canonical = canonicalLinks[0]?.href || "";

  if (canonicalLinks.length !== 1) {
    fail(`${url}: expected one canonical link, found ${canonicalLinks.length}`);
  }

  if (canonical !== url) fail(`${url}: canonical mismatch "${canonical}"`);
  if (metaContent(html, "robots") !== INDEXABLE_META_ROBOTS) {
    fail(`${url}: meta robots is missing indexable preview directives`);
  }

  if (
    manifestLinks.length !== 1 ||
    manifestLinks[0].href !== "/site.webmanifest"
  ) {
    fail(`${url}: missing canonical web app manifest link`);
  }

  if (
    !iconLinks.some(
      (link) => link.href === "/favicon.svg" && link.type === "image/svg+xml",
    )
  ) {
    fail(`${url}: missing SVG favicon link`);
  }

  if (
    !iconLinks.some(
      (link) =>
        link.href === "/favicon/favicon-32x32.png" &&
        link.type === "image/png" &&
        link.sizes === "32x32",
    )
  ) {
    fail(`${url}: missing 32x32 PNG favicon link`);
  }

  if (
    !appleTouchIcons.some(
      (link) =>
        link.href === "/favicon/apple-touch-icon.png" &&
        link.sizes === "180x180",
    )
  ) {
    fail(`${url}: missing apple touch icon link`);
  }

  for (const required of [
    "description",
    "application-name",
    "apple-mobile-web-app-title",
    "og:title",
    "og:description",
    "og:url",
    "og:image",
    "og:image:secure_url",
    "og:image:width",
    "og:image:height",
    "og:image:type",
    "og:image:alt",
    "og:updated_time",
    "twitter:card",
    "twitter:title",
    "twitter:description",
    "twitter:image",
    "twitter:image:alt",
  ]) {
    if (!metaContent(html, required)) fail(`${url}: missing ${required}`);
  }

  if (metaContent(html, "og:url") !== url) {
    fail(`${url}: og:url does not match canonical URL`);
  }

  if (
    metaContent(html, "og:image:secure_url") !== metaContent(html, "og:image")
  ) {
    fail(`${url}: og:image:secure_url does not match og:image`);
  }

  if (metaContent(html, "og:updated_time") !== EXPECTED_UPDATED_TIME) {
    fail(`${url}: og:updated_time does not match site update time`);
  }

  for (const imageField of ["og:image", "twitter:image"]) {
    const imageUrl = metaContent(html, imageField);

    if (!imageUrl.startsWith(`${SITE_ORIGIN}/`)) {
      fail(`${url}: ${imageField} is not absolute on canonical origin`);
    }
  }

  if (
    !alternates.some(
      (link) => link.hreflang === "en-gb" && link.href === url,
    ) ||
    !alternates.some(
      (link) => link.hreflang === "x-default" && link.href === url,
    )
  ) {
    fail(`${url}: hreflang alternates do not match canonical URL`);
  }

  if (!/<script\s+type=["']application\/ld\+json["']/i.test(html)) {
    fail(`${url}: missing JSON-LD`);
  }

  const vitalsMonitors = [
    ...html.matchAll(
      /<script\b[^>]*data-vitals-monitor[^>]*>[\s\S]*?<\/script>/gi,
    ),
  ];

  if (vitalsMonitors.length !== 1) {
    fail(`${url}: expected one web vitals monitor script`);
    return;
  }

  for (const expected of [
    "PerformanceObserver",
    "/api/vitals",
    "sendBeacon",
    "TTFB",
    "FCP",
    "LCP",
    "CLS",
    "INP",
    "navigationType",
    "visibilityState",
  ]) {
    if (!vitalsMonitors[0][0].includes(expected)) {
      fail(`${url}: web vitals monitor missing ${expected}`);
    }
  }
}

function assertCanonicalLinkHeader(response, url) {
  const linkHeader = response.headers.get("link") || "";

  if (!linkHeader.includes(`<${url}>; rel="canonical"`)) {
    fail(`${url}: Link header is missing canonical URL`);
  }
}

function auditLiveContentIntegrity(html, pageUrl) {
  for (const tagName of FORBIDDEN_EMBED_TAGS) {
    if (new RegExp(`<${tagName}\\b`, "i").test(html)) {
      fail(`${pageUrl}: contains forbidden <${tagName}> tag`);
    }
  }

  if (/<meta\b[^>]*http-equiv\s*=\s*["']?refresh\b/i.test(html)) {
    fail(`${pageUrl}: contains meta refresh`);
  }

  for (const match of html.matchAll(/<[a-z][\w:-]*\b[^>]*>/gi)) {
    const tag = match[0];
    const tagName = tag.match(/^<([^\s>/]+)/i)?.[1]?.toLowerCase() || "tag";
    const attributes = attrs(tag);
    const relValues = (attributes.rel || "").toLowerCase().split(/\s+/);
    const resourceContext =
      tagName === "script" ||
      tagName === "img" ||
      tagName === "source" ||
      tagName === "video" ||
      tagName === "audio" ||
      (tagName === "link" &&
        relValues.some((rel) =>
          ["stylesheet", "preload", "modulepreload", "prefetch"].includes(rel),
        ));

    for (const attribute of Object.keys(attributes)) {
      if (/^on[a-z]+$/i.test(attribute)) {
        fail(`${pageUrl}: ${tagName} has inline event handler ${attribute}`);
      }
    }

    for (const attribute of LINK_ATTRIBUTES) {
      if (!(attribute in attributes)) continue;

      const value = decodeHtml(attributes[attribute]).trim();

      if (!value || value.startsWith("#")) continue;
      if (/^(mailto|tel):/i.test(value)) continue;

      if (/^javascript\s*:/i.test(value)) {
        fail(`${pageUrl}: ${tagName} ${attribute} uses javascript:`);
        continue;
      }

      if (isDangerousDataUrl(value)) {
        fail(`${pageUrl}: ${tagName} ${attribute} uses executable data URL`);
        continue;
      }

      const normalized = normalizeUrl(value, pageUrl);

      if (!normalized) {
        fail(`${pageUrl}: ${tagName} ${attribute} is not a valid URL`);
        continue;
      }

      const parsed = new URL(normalized);

      if (parsed.protocol === "http:") {
        fail(`${pageUrl}: ${tagName} ${attribute} uses insecure HTTP URL`);
      }

      if (!isExternalUrl(parsed)) continue;

      const allowedHosts = resourceContext
        ? ALLOWED_EXTERNAL_RESOURCE_HOSTS
        : ALLOWED_EXTERNAL_LINK_HOSTS;

      if (!allowedHosts.has(parsed.host)) {
        fail(
          `${pageUrl}: ${tagName} ${attribute} points to unexpected external host ${parsed.host}`,
        );
      }
    }
  }

  for (const anchor of fullTags(html, "a")) {
    const attributes = attrs(openingTag(anchor));

    if (attributes.href && isHiddenLink(attributes)) {
      fail(`${pageUrl}: hidden link points to ${attributes.href}`);
    }
  }

  const visibleText = textContent(html);

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(visibleText)) {
      fail(`${pageUrl}: visible text matches spam pattern ${pattern}`);
    }
  }
}

function parseJsonLdItems(html, url) {
  const items = [];
  const tags = fullTags(html, "script").filter((tag) => {
    const openTag = tag.match(/^<script\b[^>]*>/i)?.[0] || tag;
    const attributes = attrs(openTag);

    return (attributes.type || "").toLowerCase() === "application/ld+json";
  });

  if (!tags.length) {
    fail(`${url}: missing JSON-LD`);
    return items;
  }

  for (const tag of tags) {
    const json = tag
      .replace(/^<script\b[^>]*>/i, "")
      .replace(/<\/script>$/i, "");

    try {
      const parsed = JSON.parse(json);
      const parsedItems = Array.isArray(parsed) ? parsed : [parsed];

      for (const item of parsedItems) {
        if (Array.isArray(item?.["@graph"])) {
          items.push(...item["@graph"]);
        } else {
          items.push(item);
        }
      }
    } catch (error) {
      fail(`${url}: invalid JSON-LD (${error.message})`);
    }
  }

  for (const item of items) {
    if (item?.["@context"] && item["@context"] !== "https://schema.org") {
      fail(`${url}: JSON-LD uses unexpected @context ${item["@context"]}`);
    }

    if (!item?.["@type"]) {
      fail(`${url}: JSON-LD item is missing @type`);
    }
  }

  return items;
}

function auditBreadcrumbJsonLd(url, items) {
  const breadcrumb = items.find((item) => isJsonLdType(item, "BreadcrumbList"));

  if (!breadcrumb) {
    fail(`${url}: missing BreadcrumbList JSON-LD`);
    return;
  }

  const elements = Array.isArray(breadcrumb.itemListElement)
    ? breadcrumb.itemListElement
    : [];

  if (!elements.length) {
    fail(`${url}: BreadcrumbList is empty`);
    return;
  }

  elements.forEach((entry, index) => {
    if (entry?.["@type"] !== "ListItem") {
      fail(`${url}: breadcrumb entry ${index + 1} is not a ListItem`);
    }

    if (entry?.position !== index + 1) {
      fail(`${url}: breadcrumb entry ${index + 1} has wrong position`);
    }

    if (!entry?.name) {
      fail(`${url}: breadcrumb entry ${index + 1} is missing name`);
    }

    const itemUrl = normalizeUrl(entry?.item || "", url);

    if (!itemUrl || !sameOrigin(itemUrl)) {
      fail(`${url}: breadcrumb entry ${index + 1} is not same-origin`);
    }
  });

  const first = elements[0];
  const last = elements.at(-1);

  if (normalizeUrl(first?.item || "", url) !== `${SITE_ORIGIN}/`) {
    fail(`${url}: breadcrumb should start at site home`);
  }

  if (normalizeUrl(last?.item || "", url) !== url) {
    fail(`${url}: breadcrumb should end at canonical page URL`);
  }
}

function auditWebPageJsonLd(url, html, items) {
  const webPage = items.find(
    (item) =>
      isJsonLdType(item, "WebPage") &&
      item?.["@id"] === `${url}#webpage` &&
      item?.url === url,
  );

  if (!webPage) {
    fail(`${url}: missing canonical WebPage JSON-LD`);
    return;
  }

  if (!webPage.name) fail(`${url}: WebPage JSON-LD missing name`);

  const description = metaContent(html, "description");

  if (webPage.description !== description) {
    fail(`${url}: WebPage description does not match meta description`);
  }

  if (webPage.inLanguage !== "en-GB") {
    fail(`${url}: WebPage inLanguage should be en-GB`);
  }

  if (webPage.isPartOf?.["@id"] !== `${SITE_ORIGIN}/#website`) {
    fail(`${url}: WebPage missing site relationship`);
  }

  if (webPage.about?.["@id"] !== `${SITE_ORIGIN}/#organization`) {
    fail(`${url}: WebPage missing organization relationship`);
  }

  if (webPage.dateModified !== EXPECTED_DATE_MODIFIED) {
    fail(`${url}: WebPage dateModified does not match site update time`);
  }

  const ogImage = metaContent(html, "og:image");

  if (webPage.primaryImageOfPage?.url !== ogImage) {
    fail(`${url}: WebPage primary image does not match og:image`);
  }

  if (
    webPage.primaryImageOfPage?.width !== 1200 ||
    webPage.primaryImageOfPage?.height !== 630
  ) {
    fail(`${url}: WebPage primary image dimensions should be 1200x630`);
  }
}

function auditItemListJsonLd(url, items, sitemapPages) {
  const itemLists = items.filter((item) => isJsonLdType(item, "ItemList"));

  for (const itemList of itemLists) {
    const elements = Array.isArray(itemList.itemListElement)
      ? itemList.itemListElement
      : [];

    if (!itemList.name) {
      fail(`${url}: ItemList JSON-LD missing name`);
    }

    if (!elements.length) {
      fail(`${url}: ItemList JSON-LD is empty`);
      continue;
    }

    elements.forEach((entry, index) => {
      if (entry?.["@type"] !== "ListItem") {
        fail(`${url}: ItemList entry ${index + 1} is not a ListItem`);
      }

      if (entry?.position !== index + 1) {
        fail(`${url}: ItemList entry ${index + 1} has wrong position`);
      }

      const entryUrl = normalizeUrl(entry?.url || entry?.item?.url || "", url);

      if (!entryUrl) {
        fail(`${url}: ItemList entry ${index + 1} missing URL`);
      } else if (sameOrigin(entryUrl) && !sitemapPages.has(entryUrl)) {
        fail(`${url}: ItemList entry ${entryUrl} is not in the sitemap`);
      }
    });
  }

  const pathname = new URL(url).pathname;

  if (["/batches/", "/batches/spring-2026/"].includes(pathname)) {
    const teamList = itemLists.find((item) =>
      /Batch teams/i.test(item.name || ""),
    );
    const elements = Array.isArray(teamList?.itemListElement)
      ? teamList.itemListElement
      : [];

    if (elements.length !== 9) {
      fail(
        `${url}: expected 9 teams in batch ItemList, found ${elements.length}`,
      );
    }
  }

  if (pathname === "/mentors/") {
    const mentorList = itemLists.find(
      (item) => item.name === "LBS AI Lab mentors",
    );
    const elements = Array.isArray(mentorList?.itemListElement)
      ? mentorList.itemListElement
      : [];

    if (elements.length !== 5) {
      fail(
        `${url}: expected 5 people in mentors ItemList, found ${elements.length}`,
      );
    }
  }
}

function auditHomeJsonLd(url, items) {
  if (url !== `${SITE_ORIGIN}/`) return;

  const website = items.find(
    (item) =>
      isJsonLdType(item, "WebSite") &&
      item?.["@id"] === `${SITE_ORIGIN}/#website`,
  );
  const organization = items.find(
    (item) =>
      isJsonLdType(item, "EducationalOrganization") &&
      item?.["@id"] === `${SITE_ORIGIN}/#organization`,
  );

  if (!website) {
    fail(`${url}: missing WebSite JSON-LD`);
  } else {
    if (website.url !== `${SITE_ORIGIN}/`) {
      fail(`${url}: WebSite JSON-LD has wrong URL`);
    }

    if (website.publisher?.["@id"] !== `${SITE_ORIGIN}/#organization`) {
      fail(`${url}: WebSite JSON-LD missing publisher organization`);
    }
  }

  if (!organization) {
    fail(`${url}: missing EducationalOrganization JSON-LD`);
    return;
  }

  if (organization.url !== `${SITE_ORIGIN}/`) {
    fail(`${url}: organization JSON-LD has wrong URL`);
  }

  if (
    organization.logo?.url !== `${SITE_ORIGIN}/favicon/apple-touch-icon.png`
  ) {
    fail(`${url}: organization JSON-LD missing canonical logo`);
  }

  if (organization.logo?.width !== 180 || organization.logo?.height !== 180) {
    fail(`${url}: organization logo JSON-LD should include dimensions`);
  }

  if (organization.image?.url !== `${SITE_ORIGIN}/og-default.png`) {
    fail(`${url}: organization JSON-LD missing social image`);
  }

  const topics = Array.isArray(organization.knowsAbout)
    ? organization.knowsAbout
    : [];

  for (const topic of EXPECTED_ORGANIZATION_TOPICS) {
    if (!topics.includes(topic)) {
      fail(`${url}: organization JSON-LD missing knowsAbout "${topic}"`);
    }
  }
}

function auditPartnerJsonLd(url, items) {
  const pathname = new URL(url).pathname;

  if (!["/batches/", "/batches/spring-2026/"].includes(pathname)) return;

  const partner = items.find(
    (item) =>
      isJsonLdType(item, "Organization") &&
      item?.["@id"] === "https://deepmind.google/#organization",
  );

  if (!partner) {
    fail(`${url}: missing Google DeepMind partner Organization JSON-LD`);
    return;
  }

  if (
    partner.name !== "Google DeepMind" ||
    partner.url !== "https://deepmind.google/"
  ) {
    fail(`${url}: invalid Google DeepMind partner JSON-LD`);
  }
}

function auditMentorJsonLd(url, items) {
  if (new URL(url).pathname !== "/mentors/") return;

  const people = items.filter((item) => isJsonLdType(item, "Person"));

  if (people.length !== 5) {
    fail(
      `${url}: expected 5 mentor Person JSON-LD nodes, found ${people.length}`,
    );
  }

  for (const person of people) {
    if (!person.name || !person.description || !person.jobTitle) {
      fail(`${url}: mentor Person JSON-LD missing profile fields`);
    }

    if (!person.sameAs?.startsWith("https://")) {
      fail(`${url}: mentor Person JSON-LD missing HTTPS sameAs`);
    }

    if (person.worksFor?.["@id"] !== `${SITE_ORIGIN}/#organization`) {
      fail(`${url}: mentor Person JSON-LD missing worksFor`);
    }

    if (person.affiliation?.["@id"] !== `${SITE_ORIGIN}/#organization`) {
      fail(`${url}: mentor Person JSON-LD missing affiliation`);
    }

    if (
      !normalizeUrl(person.image || "", url)?.startsWith(
        `${SITE_ORIGIN}/mentors/`,
      )
    ) {
      fail(`${url}: mentor Person JSON-LD missing same-origin image`);
    }
  }
}

function isTeamPageUrl(url) {
  return /^\/batches\/spring-2026\/[^/]+\/$/.test(new URL(url).pathname);
}

function auditTeamJsonLd(url, html, items) {
  if (!isTeamPageUrl(url)) return;

  const team = items.find(
    (item) =>
      isJsonLdType(item, "Organization") &&
      item?.["@id"] === `${url}#team` &&
      item?.url === url,
  );

  if (!team) {
    fail(`${url}: missing team Organization JSON-LD`);
    return;
  }

  if (!team.name || !team.description || !team.knowsAbout) {
    fail(`${url}: team Organization JSON-LD missing core fields`);
  }

  if (team.parentOrganization?.["@id"] !== `${SITE_ORIGIN}/#organization`) {
    fail(`${url}: team Organization JSON-LD missing parent organization`);
  }

  const members = Array.isArray(team.member) ? team.member : [];

  if (!members.length) {
    fail(`${url}: team Organization JSON-LD missing members`);
  }

  for (const member of members) {
    if (!isJsonLdType(member, "Person") || !member.name || !member.jobTitle) {
      fail(`${url}: invalid team member Person JSON-LD`);
    }
  }

  const prototype = items.find(
    (item) =>
      isJsonLdType(item, "CreativeWork") &&
      item?.["@id"] === `${url}#prototype`,
  );
  const hasProductLink = html.includes("Open prototype");

  if (hasProductLink && !prototype) {
    fail(`${url}: missing prototype CreativeWork JSON-LD`);
    return;
  }

  if (!hasProductLink && prototype) {
    fail(`${url}: prototype CreativeWork JSON-LD present without product link`);
  }

  if (!prototype) return;

  if (!prototype.url?.startsWith("https://")) {
    fail(`${url}: prototype CreativeWork JSON-LD missing HTTPS URL`);
  }

  if (prototype.creator?.["@id"] !== `${url}#team`) {
    fail(`${url}: prototype CreativeWork JSON-LD missing team creator`);
  }
}

function auditJsonLd(url, html, sitemapPages) {
  const items = parseJsonLdItems(html, url);

  auditWebPageJsonLd(url, html, items);
  auditBreadcrumbJsonLd(url, items);
  auditItemListJsonLd(url, items, sitemapPages);
  auditHomeJsonLd(url, items);
  auditPartnerJsonLd(url, items);
  auditMentorJsonLd(url, items);
  auditTeamJsonLd(url, html, items);
}

function auditScriptHygiene(html, pageUrl) {
  for (const tag of allTags(html, "script")) {
    const script = attrs(tag);
    const src = script.src ? normalizeUrl(script.src, pageUrl) : "";

    if (!src) continue;

    if (!isNonBlockingScript(script)) {
      fail(`${pageUrl}: script should be async, defer, or module (${src})`);
    }

    if (sameOrigin(src)) continue;

    if (!isAllowedExternalScript(src)) {
      fail(`${pageUrl}: unapproved third-party script found (${src})`);
    }
  }
}

function socialImageUrls(html, pageUrl) {
  return [
    metaContent(html, "og:image"),
    metaContent(html, "og:image:secure_url"),
    metaContent(html, "twitter:image"),
  ]
    .map((imageUrl) => normalizeUrl(imageUrl, pageUrl))
    .filter((imageUrl) => imageUrl && sameOrigin(imageUrl));
}

async function auditPage(url, sitemapPages, inbound, assetUrls, socialImages) {
  const { response, body } = await text(url, { accept: "text/html" });
  const contentType = response.headers.get("content-type") || "";

  if (response.status !== 200)
    fail(`${url}: expected 200, got ${response.status}`);
  if (!contentType.includes("text/html")) {
    fail(`${url}: expected text/html, got "${contentType}"`);
  }

  assertSecurityHeaders(response, url);
  assertPageCsp(response, body, url);
  assertIndexableHeaders(response, url);
  assertShortCache(response, url);
  assertCanonicalLinkHeader(response, url);
  assertPageMetadata(body, url);
  auditLiveContentIntegrity(body, url);
  auditJsonLd(url, body, sitemapPages);
  auditScriptHygiene(body, url);

  const { links, assets, externalLinks, sameOriginNonPages } = extractPageLinks(
    body,
    url,
    sitemapPages,
  );

  for (const link of links) {
    if (!inbound.has(link)) inbound.set(link, new Set());
    inbound.get(link).add(url);
  }

  for (const asset of assets) assetUrls.add(asset);
  for (const socialImage of socialImageUrls(body, url)) {
    socialImages.add(socialImage);
  }
  for (const link of externalLinks) {
    if (!inbound.has(link)) inbound.set(link, new Set());
    inbound.get(link).add(url);
  }

  for (const linked of sameOriginNonPages) {
    const parsed = new URL(linked);

    if (
      parsed.pathname !== "/healthz" &&
      !parsed.pathname.endsWith(".txt") &&
      !parsed.pathname.startsWith("/api/")
    ) {
      assetUrls.add(linked);
    }
  }
}

async function auditImageResource(url, options = {}) {
  const { response, body } = await bytes(url, { accept: "image/*" });
  const contentType = response.headers.get("content-type") || "";

  if (response.status !== 200) {
    fail(`${url}: image asset expected 200, got ${response.status}`);
    return null;
  }

  assertSecurityHeaders(response, url);
  assertLongCache(response, url);

  if (!contentType.startsWith("image/")) {
    fail(`${url}: expected image content type, got "${contentType}"`);
  }

  if (options.contentType && !contentType.includes(options.contentType)) {
    fail(
      `${url}: expected ${options.contentType} content type, got "${contentType}"`,
    );
  }

  if (!body.length) {
    fail(`${url}: image asset body is empty`);
  }

  return { body, contentType };
}

async function auditSocialImages(socialImages) {
  for (const url of socialImages) {
    const resource = await auditImageResource(url, {
      contentType: "image/png",
    });

    if (!resource) continue;

    const dimensions = pngDimensions(resource.body);

    if (!dimensions) {
      fail(`${url}: social image is not a valid PNG`);
      continue;
    }

    if (dimensions.width !== 1200 || dimensions.height !== 630) {
      fail(
        `${url}: social image dimensions expected 1200x630, got ${dimensions.width}x${dimensions.height}`,
      );
    }
  }
}

async function auditImageSitemapAssets(imageUrls) {
  const uniqueImageUrls = new Set(imageUrls);

  for (const url of uniqueImageUrls) {
    await auditImageResource(url);
  }
}

async function auditWebManifest() {
  const url = `${SITE_ORIGIN}/site.webmanifest`;
  const { response, body } = await text(url, {
    accept: "application/manifest+json,application/json",
  });
  const contentType = response.headers.get("content-type") || "";
  let manifest;

  if (response.status !== 200) {
    fail(`${url}: expected 200, got ${response.status}`);
    return;
  }

  assertSecurityHeaders(response, url);
  assertLongCache(response, url);

  if (
    !contentType.includes("application/manifest+json") &&
    !contentType.includes("application/json")
  ) {
    fail(`${url}: expected manifest JSON content type, got "${contentType}"`);
  }

  try {
    manifest = JSON.parse(body);
  } catch (error) {
    fail(`${url}: invalid manifest JSON (${error.message})`);
    return;
  }

  if (manifest.name !== "LBS AI Lab") fail(`${url}: invalid manifest name`);
  if (manifest.short_name !== "LBS AI Lab") {
    fail(`${url}: invalid manifest short_name`);
  }
  if (!manifest.description) fail(`${url}: missing manifest description`);
  if (manifest.start_url !== "/") fail(`${url}: invalid manifest start_url`);
  if (manifest.display !== "standalone") {
    fail(`${url}: invalid manifest display`);
  }
  if (manifest.theme_color !== "#17145f") {
    fail(`${url}: invalid manifest theme_color`);
  }
  if (manifest.background_color !== "#fbfaf7") {
    fail(`${url}: invalid manifest background_color`);
  }

  if (!Array.isArray(manifest.icons)) {
    fail(`${url}: manifest icons must be an array`);
    return;
  }

  for (const expected of REQUIRED_MANIFEST_ICONS) {
    const icon = manifest.icons.find(
      (candidate) =>
        candidate.src === expected.src &&
        candidate.sizes === expected.sizes &&
        candidate.type === expected.type,
    );

    if (!icon) {
      fail(`${url}: missing icon ${expected.src}`);
      continue;
    }

    const iconUrl = new URL(icon.src, SITE_ORIGIN).toString();
    const resource = await auditImageResource(iconUrl, {
      contentType: "image/png",
    });

    if (!resource) continue;

    const dimensions = pngDimensions(resource.body);

    if (!dimensions) {
      fail(`${iconUrl}: manifest icon is not a valid PNG`);
      continue;
    }

    if (
      dimensions.width !== expected.width ||
      dimensions.height !== expected.height
    ) {
      fail(
        `${iconUrl}: manifest icon dimensions expected ${expected.width}x${expected.height}, got ${dimensions.width}x${dimensions.height}`,
      );
    }
  }
}

async function auditAssets(assetUrls) {
  const uniqueAssets = [...assetUrls].filter((url) => {
    const parsed = new URL(url);

    return (
      parsed.pathname !== "/" &&
      !parsed.pathname.endsWith("/") &&
      !parsed.pathname.startsWith("/api/")
    );
  });

  for (const url of uniqueAssets) {
    const response = await get(url);

    if (response.status !== 200) {
      fail(
        `${url}: linked internal asset expected 200, got ${response.status}`,
      );
      continue;
    }

    assertSecurityHeaders(response, url);

    const pathname = new URL(url).pathname;

    if (isLongCachePath(pathname)) {
      assertLongCache(response, url);
    }
  }
}

async function auditExternalLinks(inbound) {
  const externalLinks = [...inbound.keys()].filter((url) => !sameOrigin(url));

  for (const url of externalLinks) {
    const parsed = new URL(url);

    if (parsed.protocol !== "https:") {
      fail(`${url}: external link must use HTTPS`);
      continue;
    }

    const response = await get(url, {
      accept: "text/html,*/*",
      allowFetchFailure: true,
      redirect: "follow",
    });

    if (response.status >= 200 && response.status < 400) continue;

    if (
      isBotProtectedExternalHost(new URL(response.url || url).hostname) &&
      [401, 403, 429, 599, 999].includes(response.status)
    ) {
      continue;
    }

    const sources = [...(inbound.get(url) || [])].join(", ");
    fail(
      `${url}: external link returned ${response.status} from ${sources || "(unknown page)"}`,
    );
  }
}

async function auditRedirects() {
  for (const [source, expected] of CANONICAL_REDIRECTS) {
    await auditRedirectTarget(source, expected);
  }

  for (const [path, expected] of LEGACY_URLS) {
    const source = `${SITE_ORIGIN}${path}`;
    await auditRedirectTarget(source, expected);
  }
}

async function auditRedirectTarget(source, expected) {
  const hops = await redirectTrace(source);
  const first = hops[0];
  const last = hops.at(-1);

  if (first.status !== 301) {
    fail(`${source}: expected initial 301, got ${first.status}`);
  }

  if (hops.length > 2) {
    fail(`${source}: redirect chain has ${hops.length - 1} hops`);
  }

  const finalUrl =
    last.status >= 300 && last.status < 400 && last.location
      ? new URL(last.location, last.url).toString()
      : last.url;

  if (finalUrl !== expected) {
    fail(`${source}: expected redirect target ${expected}, got ${finalUrl}`);
  }
}

function canonicalDuplicateVariants(page) {
  const url = new URL(page);
  const variants = [
    `${page}?utm_source=seo-audit&gclid=seo-audit&preview=true`,
    new URL("index.html", page).toString(),
  ];

  if (url.pathname !== "/") {
    variants.push(`${SITE_ORIGIN}${url.pathname.replace(/\/$/, "")}`);
    variants.push(`${SITE_ORIGIN}${url.pathname.toUpperCase()}`);
  }

  return [...new Set(variants)].filter((variant) => variant !== page);
}

async function auditCanonicalDuplicateRedirects(pages) {
  for (const page of pages) {
    for (const variant of canonicalDuplicateVariants(page)) {
      await auditRedirectTarget(variant, page);
    }
  }
}

async function auditNoindexAndGone() {
  const healthUrl = `${SITE_ORIGIN}/healthz`;
  const { response } = await text(healthUrl, { accept: "application/json" });

  if (response.status !== 200) {
    fail(`${healthUrl}: expected 200, got ${response.status}`);
  }

  if ((response.headers.get("x-robots-tag") || "") !== NOINDEX_ROBOTS) {
    fail(`${healthUrl}: expected ${NOINDEX_ROBOTS} X-Robots-Tag`);
  }

  for (const path of GONE_URLS) {
    const url = `${SITE_ORIGIN}${path}`;
    const gone = await get(url);

    if (gone.status !== 410) fail(`${url}: expected 410, got ${gone.status}`);
    if ((gone.headers.get("x-robots-tag") || "") !== NOINDEX_ROBOTS) {
      fail(`${url}: expected ${NOINDEX_ROBOTS} X-Robots-Tag`);
    }
    if ((gone.headers.get("last-modified") || "") !== EXPECTED_LAST_MODIFIED) {
      fail(`${url}: expected ${EXPECTED_LAST_MODIFIED} Last-Modified`);
    }
  }

  const vitalsUrl = `${SITE_ORIGIN}/api/vitals`;
  const vitalsGet = await get(vitalsUrl, { accept: "application/json" });

  if (vitalsGet.status !== 200) {
    fail(`${vitalsUrl}: expected GET 200, got ${vitalsGet.status}`);
  }

  if ((vitalsGet.headers.get("x-robots-tag") || "") !== NOINDEX_ROBOTS) {
    fail(`${vitalsUrl}: expected ${NOINDEX_ROBOTS} X-Robots-Tag`);
  }

  if (!/no-store/i.test(vitalsGet.headers.get("cache-control") || "")) {
    fail(`${vitalsUrl}: expected no-store cache`);
  }

  const vitalsPost = await fetch(vitalsUrl, {
    body: JSON.stringify({
      metrics: [
        { name: "TTFB", value: 120 },
        { name: "FCP", value: 700 },
        { name: "LCP", value: 1200 },
        { name: "CLS", value: 0.01 },
        { name: "INP", value: 80 },
      ],
      navigationType: "navigate",
      path: "/seo-audit",
      visibilityState: "hidden",
    }),
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "lbsailab-seo-audit/1.0",
    },
    method: "POST",
  });

  if (vitalsPost.status !== 204) {
    fail(`${vitalsUrl}: expected POST 204, got ${vitalsPost.status}`);
  }

  if ((vitalsPost.headers.get("x-robots-tag") || "") !== NOINDEX_ROBOTS) {
    fail(`${vitalsUrl}: POST expected ${NOINDEX_ROBOTS} X-Robots-Tag`);
  }
}

async function auditMissingPage() {
  const url = `${SITE_ORIGIN}/missing-seo-audit-page/`;
  const { response, body } = await text(url, { accept: "text/html" });

  if (response.status !== 404) {
    fail(`${url}: expected hard 404, got ${response.status}`);
  }

  assertSecurityHeaders(response, url);
  assertShortCache(response, url);

  if ((response.headers.get("x-robots-tag") || "") !== NOINDEX_ROBOTS) {
    fail(`${url}: expected ${NOINDEX_ROBOTS} X-Robots-Tag`);
  }

  if (
    body.includes(INDEXABLE_META_ROBOTS) ||
    /<link\b[^>]*rel=["']canonical["']/i.test(body)
  ) {
    fail(`${url}: 404 body contains indexable page metadata`);
  }

  if (!body.includes("<h1>Page not found</h1>")) {
    fail(`${url}: 404 body should render the custom not-found document`);
  }

  if (!/<meta\b[^>]*name=["']robots["'][^>]*noindex,nofollow/i.test(body)) {
    fail(`${url}: 404 body is missing noindex,nofollow meta robots`);
  }

  for (const href of ['href="/"', 'href="/sitemap/"']) {
    if (!body.includes(href)) {
      fail(`${url}: 404 body missing recovery link ${href}`);
    }
  }
}

async function auditErrorDocumentDirect() {
  for (const path of ["/404.html", "/404/"]) {
    const url = `${SITE_ORIGIN}${path}`;
    const { response, body } = await text(url, { accept: "text/html" });

    if (response.status !== 200) {
      fail(
        `${url}: expected direct error document 200, got ${response.status}`,
      );
    }

    assertSecurityHeaders(response, url);
    assertShortCache(response, url);

    if ((response.headers.get("x-robots-tag") || "") !== NOINDEX_ROBOTS) {
      fail(`${url}: expected ${NOINDEX_ROBOTS} X-Robots-Tag`);
    }

    if (
      body.includes(INDEXABLE_META_ROBOTS) ||
      /<link\b[^>]*rel=["']canonical["']/i.test(body)
    ) {
      fail(`${url}: direct error document contains indexable page metadata`);
    }

    if (!/<meta\b[^>]*name=["']robots["'][^>]*noindex,nofollow/i.test(body)) {
      fail(
        `${url}: direct error document missing noindex,nofollow meta robots`,
      );
    }
  }
}

async function auditSecurityText() {
  const url = `${SITE_ORIGIN}/.well-known/security.txt`;
  const { response, body } = await text(url, { accept: "text/plain" });

  if (response.status !== 200) {
    fail(`${url}: expected 200, got ${response.status}`);
    return;
  }

  assertSecurityHeaders(response, url);
  assertShortCache(response, url);

  if ((response.headers.get("x-robots-tag") || "") !== NOINDEX_ROBOTS) {
    fail(`${url}: expected ${NOINDEX_ROBOTS} X-Robots-Tag`);
  }

  for (const field of ["Contact:", "Canonical:", "Expires:"]) {
    if (!body.includes(field)) fail(`${url}: missing ${field}`);
  }
}

async function auditReachability(pages) {
  const sitemapPages = new Set(pages);
  const inbound = new Map(pages.map((page) => [page, new Set()]));
  const assetUrls = new Set();
  const socialImages = new Set();

  for (const page of pages) {
    await auditPage(page, sitemapPages, inbound, assetUrls, socialImages);
  }

  for (const page of pages) {
    if (page === `${SITE_ORIGIN}/`) continue;

    const inboundLinks = inbound.get(page) || new Set();

    if (!inboundLinks.size) {
      fail(
        `${page}: sitemap page has no crawlable inbound link from another page`,
      );
    }
  }

  await auditAssets(assetUrls);
  await auditSocialImages(socialImages);
  await auditExternalLinks(inbound);
}

async function auditLiveSeo() {
  await auditRobots();
  const { imageUrls, pages } = await auditSitemaps();
  await auditFeed();
  await auditDiscoveryFiles(pages);
  await auditImageSitemapAssets(imageUrls);
  await auditWebManifest();
  await auditSecurityText();
  await auditRedirects();
  await auditCanonicalDuplicateRedirects(pages);
  await auditNoindexAndGone();
  await auditMissingPage();
  await auditErrorDocumentDirect();
  await auditReachability(pages);

  if (warnings.length) {
    console.warn("Live SEO audit warnings:");
    for (const warning of warnings) console.warn(`- ${warning}`);
  }

  if (failures.length) {
    console.error("Live SEO audit failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(
    `Live SEO audit passed for ${pages.length} canonical pages on ${SITE_HOST}.`,
  );
  process.exit(0);
}

auditLiveSeo().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
