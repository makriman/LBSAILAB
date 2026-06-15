import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const SITE_URL = "https://lbsailab.com";
const SITE_HOST = new URL(SITE_URL).host;
const INDEXNOW_KEY = "5e5bfddcc11447d381079b24b2d1e213";
const INDEXNOW_KEY_FILE = `${INDEXNOW_KEY}.txt`;
const REQUIRED_SITEMAPS = [
  `${SITE_URL}/sitemap-index.xml`,
  `${SITE_URL}/image-sitemap.xml`,
  `${SITE_URL}/feed.xml`,
];

const failures = [];

function fail(message) {
  failures.push(message);
}

function readDist(relativePath) {
  const fullPath = path.join(DIST, relativePath);

  if (!existsSync(fullPath)) {
    fail(`Missing dist/${relativePath}`);
    return "";
  }

  return readFileSync(fullPath, "utf8");
}

function allTags(html, tagName) {
  return [...html.matchAll(new RegExp(`<${tagName}\\b[^>]*>`, "gi"))].map(
    (match) => match[0],
  );
}

function attrs(tag) {
  const attributes = {};

  for (const match of tag.matchAll(/([\w:-]+)\s*=\s*(["'])(.*?)\2/g)) {
    attributes[match[1].toLowerCase()] = match[3];
  }

  return attributes;
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

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) =>
    match[1].trim(),
  );
}

function pageFileForUrl(url) {
  const { pathname } = new URL(url);

  if (pathname === "/") return "index.html";
  if (pathname.endsWith("/")) return path.join(pathname.slice(1), "index.html");

  return pathname.slice(1);
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected "${expected}", got "${actual || "(missing)"}"`);
  }
}

function assertTruthy(value, label) {
  if (!value) fail(`${label}: missing`);
}

function auditSitemap() {
  const sitemapIndex = readDist("sitemap-index.xml");
  const sitemap = readDist("sitemap-0.xml");
  const sitemapLocs = extractLocs(sitemap);
  const indexLocs = extractLocs(sitemapIndex);

  if (!indexLocs.includes(`${SITE_URL}/sitemap-0.xml`)) {
    fail("sitemap-index.xml does not reference sitemap-0.xml");
  }

  if (!sitemapLocs.length) {
    fail("sitemap-0.xml has no URLs");
  }

  const seen = new Set();

  for (const loc of sitemapLocs) {
    const url = new URL(loc);

    if (seen.has(loc)) fail(`Duplicate sitemap URL: ${loc}`);
    seen.add(loc);

    assertEqual(url.origin, SITE_URL, `Sitemap URL origin for ${loc}`);

    if (url.pathname !== "/" && !url.pathname.endsWith("/")) {
      fail(`Sitemap page URL is missing trailing slash: ${loc}`);
    }

    if (url.pathname !== url.pathname.toLowerCase()) {
      fail(`Sitemap page URL is not lowercase: ${loc}`);
    }

    if (/\/(cohorts?|teams)(\/|$)/.test(url.pathname)) {
      fail(`Legacy URL leaked into sitemap: ${loc}`);
    }

    if (!/<lastmod>2026-06-15T00:00:00\.000Z<\/lastmod>/.test(sitemap)) {
      fail("sitemap-0.xml is missing the current lastmod value");
      break;
    }
  }

  return sitemapLocs;
}

function auditRobots() {
  const robots = readDist("robots.txt");

  for (const sitemap of REQUIRED_SITEMAPS) {
    if (!robots.includes(`Sitemap: ${sitemap}`)) {
      fail(`robots.txt does not reference ${sitemap}`);
    }
  }

  for (const pathPrefix of [
    "/api/",
    "/admin/",
    "/login/",
    "/search/",
    "/cart/",
    "/checkout/",
    "/healthz",
    "/internal/",
    "/private/",
  ]) {
    if (!robots.includes(`Disallow: ${pathPrefix}`)) {
      fail(`robots.txt does not disallow ${pathPrefix}`);
    }
  }
}

function auditCrawlerFiles() {
  const imageSitemap = readDist("image-sitemap.xml");
  const feed = readDist("feed.xml");
  const key = readDist(INDEXNOW_KEY_FILE).trim();

  assertEqual(key, INDEXNOW_KEY, "IndexNow key file");

  for (const imageUrl of extractLocs(imageSitemap)) {
    const url = new URL(imageUrl);

    assertEqual(url.origin, SITE_URL, `Image sitemap origin for ${imageUrl}`);

    if (/\/images\/lbs-ai-lab-workshop-hero\.png$/.test(url.pathname)) {
      fail("Image sitemap references the retired PNG hero source");
    }
  }

  if (!feed.includes("<feed") || !feed.includes(`${SITE_URL}/feed.xml`)) {
    fail("feed.xml is missing Atom feed markers");
  }
}

function auditPage(url) {
  const relativeFile = pageFileForUrl(url);
  const html = readDist(relativeFile);
  const canonicalLinks = linkAttrs(html, "canonical");
  const alternates = linkAttrs(html, "alternate");
  const jsonLdScripts = [
    ...html.matchAll(
      /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];

  if (!html) return;

  if (canonicalLinks.length !== 1) {
    fail(`${url}: expected one canonical link, found ${canonicalLinks.length}`);
  } else {
    assertEqual(canonicalLinks[0].href, url, `${url}: canonical`);
  }

  assertTruthy(html.match(/<title>([^<]{10,70})<\/title>/), `${url}: title`);
  assertTruthy(metaContent(html, "description"), `${url}: meta description`);
  assertEqual(
    metaContent(html, "robots"),
    "index,follow,max-image-preview:large",
    `${url}: meta robots`,
  );
  assertEqual(metaContent(html, "og:type"), "website", `${url}: og:type`);
  assertEqual(metaContent(html, "og:locale"), "en_GB", `${url}: og:locale`);
  assertEqual(
    metaContent(html, "og:site_name"),
    "LBS AI Lab",
    `${url}: og:site_name`,
  );
  assertTruthy(metaContent(html, "og:title"), `${url}: og:title`);
  assertTruthy(metaContent(html, "og:description"), `${url}: og:description`);
  assertEqual(metaContent(html, "og:url"), url, `${url}: og:url`);
  assertTruthy(
    metaContent(html, "og:image").startsWith(`${SITE_URL}/`),
    `${url}: absolute og:image`,
  );
  assertEqual(
    metaContent(html, "og:image:width"),
    "1200",
    `${url}: og:image:width`,
  );
  assertEqual(
    metaContent(html, "og:image:height"),
    "630",
    `${url}: og:image:height`,
  );
  assertEqual(
    metaContent(html, "og:image:type"),
    "image/png",
    `${url}: og:image:type`,
  );
  assertTruthy(metaContent(html, "og:image:alt"), `${url}: og:image:alt`);
  assertEqual(
    metaContent(html, "twitter:card"),
    "summary_large_image",
    `${url}: twitter:card`,
  );
  assertTruthy(metaContent(html, "twitter:title"), `${url}: twitter:title`);
  assertTruthy(
    metaContent(html, "twitter:description"),
    `${url}: twitter:description`,
  );
  assertTruthy(
    metaContent(html, "twitter:image").startsWith(`${SITE_URL}/`),
    `${url}: absolute twitter:image`,
  );
  assertTruthy(
    metaContent(html, "twitter:image:alt"),
    `${url}: twitter:image:alt`,
  );

  if (
    !alternates.some((link) => link.hreflang === "en-gb" && link.href === url)
  ) {
    fail(`${url}: missing en-gb hreflang alternate`);
  }

  if (
    !alternates.some(
      (link) =>
        link.type === "application/atom+xml" &&
        link.href === `${SITE_URL}/feed.xml`,
    )
  ) {
    fail(`${url}: missing Atom feed alternate`);
  }

  if (!jsonLdScripts.length) {
    fail(`${url}: missing JSON-LD`);
  }

  for (const [, json] of jsonLdScripts) {
    try {
      JSON.parse(json);
    } catch (error) {
      fail(`${url}: invalid JSON-LD (${error.message})`);
    }
  }

  for (const tag of allTags(html, "img")) {
    const image = attrs(tag);
    const src = image.src || "(unknown image)";

    assertTruthy(image.alt !== undefined, `${url}: ${src} image alt`);
    assertTruthy(image.width, `${url}: ${src} image width`);
    assertTruthy(image.height, `${url}: ${src} image height`);
  }

  for (const tag of allTags(html, "a")) {
    const link = attrs(tag);
    const href = link.href || "";

    if (href === "#" || href.startsWith("javascript:")) {
      fail(`${url}: non-crawlable link href "${href}"`);
    }
  }

  if (
    html.includes("http://lbsailab.com") ||
    html.includes("www.lbsailab.com")
  ) {
    fail(`${url}: non-canonical domain reference found`);
  }

  if (/href=["']\/(?:cohorts?|teams)(?:\/|["'])/.test(html)) {
    fail(`${url}: legacy public URL linked from HTML`);
  }

  if (/\bCohort\b/.test(html)) {
    fail(`${url}: user-facing Cohort language found`);
  }
}

function audit() {
  if (!existsSync(DIST)) {
    throw new Error(
      "dist/ is missing. Run npm run build before npm run seo:audit.",
    );
  }

  auditRobots();
  auditCrawlerFiles();

  const pages = auditSitemap();

  for (const page of pages) {
    auditPage(page);
  }

  if (failures.length) {
    console.error("SEO audit failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(
    `SEO audit passed for ${pages.length} canonical pages on ${SITE_HOST}.`,
  );
}

audit();
