import { lookup as systemLookup, setServers } from "node:dns";
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
  /^\/og-[^/]+\.png$/,
  /^\/google-deepmind-logo-[^/]+\.png$/,
  /^\/site\.webmanifest$/,
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
  [`${SITE_ORIGIN}/About`, `${SITE_ORIGIN}/about/`],
  [`${SITE_ORIGIN}/about`, `${SITE_ORIGIN}/about/`],
  [`${SITE_ORIGIN}/about/?utm_source=test&gclid=test`, `${SITE_ORIGIN}/about/`],
  [`${SITE_ORIGIN}/about/?preview=true&foo=bar`, `${SITE_ORIGIN}/about/`],
  ...DUPLICATE_ORIGINS.map((origin) => [
    `${origin}/about`,
    `${SITE_ORIGIN}/about/`,
  ]),
];
const GONE_URLS = ["/images/lbs-ai-lab-workshop-hero.png"];
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

function allTags(html, tagName) {
  return [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "gi"))].map(
    (match) => match[0],
  );
}

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) =>
    decodeHtml(match[1].trim()),
  );
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

function isCanonicalPageUrl(url) {
  const parsed = new URL(url);
  return sameOrigin(url) && parsed.pathname.endsWith("/") && !parsed.search;
}

function isLongCachePath(pathname) {
  return LONG_CACHE_PATHS.some((pattern) => pattern.test(pathname));
}

async function get(url, options = {}) {
  try {
    return await fetch(url, {
      redirect: options.redirect || "follow",
      headers: {
        "User-Agent": "lbsailab-seo-audit/1.0",
        Accept: options.accept || "*/*",
      },
    });
  } catch (error) {
    fail(
      `${url}: fetch failed (${error instanceof Error ? error.message : String(error)})`,
    );

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

function assertIndexableHeaders(response, url) {
  const robots = response.headers.get("x-robots-tag") || "";

  if (robots !== INDEXABLE_ROBOTS) {
    fail(
      `${url}: X-Robots-Tag expected "${INDEXABLE_ROBOTS}", got "${robots}"`,
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

  for (const imageUrl of extractLocs(imageSitemap)) {
    if (!sameOrigin(imageUrl)) {
      fail(`${imageSitemapUrl}: non-canonical image URL ${imageUrl}`);
    }
  }

  return pages;
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

function extractPageLinks(html, pageUrl, sitemapPages) {
  const links = new Set();
  const assets = new Set();
  const sameOriginNonPages = new Set();

  for (const tag of allTags(html, "a")) {
    const href = attrs(tag).href || "";

    if (!href || href.startsWith("mailto:") || href.startsWith("tel:"))
      continue;
    if (href === "#" || href.startsWith("javascript:")) {
      fail(`${pageUrl}: non-crawlable link href "${href}"`);
      continue;
    }

    const normalized = normalizeUrl(href, pageUrl);
    if (!normalized || !sameOrigin(normalized)) continue;

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

  return { links, assets, sameOriginNonPages };
}

function assertPageMetadata(html, url) {
  const canonicalLinks = linkAttrs(html, "canonical");
  const alternates = linkAttrs(html, "alternate");
  const canonical = canonicalLinks[0]?.href || "";

  if (canonicalLinks.length !== 1) {
    fail(`${url}: expected one canonical link, found ${canonicalLinks.length}`);
  }

  if (canonical !== url) fail(`${url}: canonical mismatch "${canonical}"`);
  if (metaContent(html, "robots") !== INDEXABLE_META_ROBOTS) {
    fail(`${url}: meta robots is missing indexable preview directives`);
  }

  for (const required of [
    "description",
    "og:title",
    "og:description",
    "og:url",
    "og:image",
    "og:image:width",
    "og:image:height",
    "og:image:type",
    "og:image:alt",
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
}

async function auditPage(url, sitemapPages, inbound, assetUrls) {
  const { response, body } = await text(url, { accept: "text/html" });
  const contentType = response.headers.get("content-type") || "";

  if (response.status !== 200)
    fail(`${url}: expected 200, got ${response.status}`);
  if (!contentType.includes("text/html")) {
    fail(`${url}: expected text/html, got "${contentType}"`);
  }

  assertSecurityHeaders(response, url);
  assertIndexableHeaders(response, url);
  assertShortCache(response, url);
  assertPageMetadata(body, url);

  const { links, assets, sameOriginNonPages } = extractPageLinks(
    body,
    url,
    sitemapPages,
  );

  for (const link of links) {
    if (!inbound.has(link)) inbound.set(link, new Set());
    inbound.get(link).add(url);
  }

  for (const asset of assets) assetUrls.add(asset);

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

async function auditRedirects() {
  for (const [source, expected] of CANONICAL_REDIRECTS) {
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

  for (const [path, expected] of LEGACY_URLS) {
    const source = `${SITE_ORIGIN}${path}`;
    const hops = await redirectTrace(source);
    const first = hops[0];
    const target = first.location
      ? new URL(first.location, first.url).toString()
      : first.url;

    if (first.status !== 301) {
      fail(`${source}: expected legacy 301, got ${first.status}`);
    }

    if (target !== expected) {
      fail(`${source}: expected ${expected}, got ${target}`);
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

  for (const page of pages) {
    await auditPage(page, sitemapPages, inbound, assetUrls);
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
}

async function auditLiveSeo() {
  await auditRobots();
  const pages = await auditSitemaps();
  await auditFeed();
  await auditSecurityText();
  await auditRedirects();
  await auditNoindexAndGone();
  await auditMissingPage();
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
