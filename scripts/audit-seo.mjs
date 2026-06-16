import { existsSync, readFileSync, readdirSync } from "node:fs";
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
const INDEXABLE_META_ROBOTS =
  "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1";
const EXPECTED_UPDATED_AT = "2026-06-16";
const EXPECTED_LASTMOD = `${EXPECTED_UPDATED_AT}T00:00:00.000Z`;

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

function distFiles(directory = DIST) {
  const files = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      files.push(...distFiles(fullPath));
    } else {
      files.push(fullPath);
    }
  }

  return files;
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

function decodeHtml(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
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

function pageTitle(html) {
  return html.match(/<title>([^<]+)<\/title>/i)?.[1] || "";
}

function textContent(markup) {
  return decodeHtml(
    markup
      .replace(/<script\b[\s\S]*?<\/script>/gi, "")
      .replace(/<style\b[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
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

function pageUrlForFile(file) {
  const relative = path.relative(DIST, file);

  if (relative === "index.html") return `${SITE_URL}/`;
  if (!relative.endsWith(`${path.sep}index.html`)) return null;

  const pathname = relative
    .slice(0, -"/index.html".length)
    .split(path.sep)
    .join("/");

  return `${SITE_URL}/${pathname}/`;
}

function assertEqual(actual, expected, label) {
  if (actual !== expected) {
    fail(`${label}: expected "${expected}", got "${actual || "(missing)"}"`);
  }
}

function assertTruthy(value, label) {
  if (!value) fail(`${label}: missing`);
}

function hasAccessibleName(tag) {
  const attributes = attrs(tag);
  const text = textContent(tag);

  return Boolean(
    text || attributes["aria-label"] || attributes["aria-labelledby"],
  );
}

function isExternalHttpUrl(href) {
  if (!/^https?:\/\//i.test(href)) return false;

  return new URL(href).origin !== SITE_URL;
}

function auditHtmlIntegrity(html, url) {
  if (!/<html\b[^>]*\blang=["']en["']/i.test(html)) {
    fail(`${url}: html lang should be en`);
  }

  if (!/<meta\b[^>]*name=["']viewport["'][^>]*>/i.test(html)) {
    fail(`${url}: missing viewport meta`);
  }

  if (!/<main\b[^>]*\bid=["']main-content["'][^>]*>/i.test(html)) {
    fail(`${url}: missing main landmark with #main-content`);
  }

  if (!/<a\b[^>]*href=["']#main-content["'][^>]*>/i.test(html)) {
    fail(`${url}: missing skip link to main content`);
  }

  const ids = new Map();

  for (const match of html.matchAll(/<[^>]+\bid\s*=\s*(["'])(.*?)\1[^>]*>/gi)) {
    const id = match[2];
    const existing = ids.get(id);

    if (existing) {
      fail(`${url}: duplicate id "${id}"`);
    }

    ids.set(id, true);
  }

  for (const match of html.matchAll(
    /<[^>]+\baria-labelledby\s*=\s*(["'])(.*?)\1[^>]*>/gi,
  )) {
    for (const id of match[2].split(/\s+/).filter(Boolean)) {
      if (!ids.has(id)) {
        fail(`${url}: aria-labelledby references missing id "${id}"`);
      }
    }
  }

  const headings = [...html.matchAll(/<h([1-6])\b[^>]*>[\s\S]*?<\/h\1>/gi)].map(
    (match) => ({
      level: Number(match[1]),
      text: textContent(match[0]),
    }),
  );
  const h1s = headings.filter((heading) => heading.level === 1);

  if (h1s.length !== 1) {
    fail(`${url}: expected exactly one h1, found ${h1s.length}`);
  }

  for (const heading of headings) {
    if (!heading.text) {
      fail(`${url}: empty h${heading.level}`);
    }
  }

  for (let index = 1; index < headings.length; index += 1) {
    const previous = headings[index - 1];
    const current = headings[index];

    if (current.level - previous.level > 1) {
      fail(
        `${url}: heading jumps from h${previous.level} to h${current.level}`,
      );
    }
  }

  for (const tag of fullTags(html, "a")) {
    const link = attrs(tag);
    const href = link.href || "";

    if (!href) {
      fail(`${url}: link is missing href`);
      continue;
    }

    if (!hasAccessibleName(tag)) {
      fail(`${url}: link has no accessible name (${href})`);
    }

    if (href.startsWith("#!")) {
      fail(`${url}: hashbang URL found (${href})`);
    }

    if (href.startsWith("http://")) {
      fail(`${url}: insecure external link found (${href})`);
    }

    if (isExternalHttpUrl(href) && link.target === "_blank") {
      const rel = link.rel || "";

      if (!/\b(noopener|noreferrer)\b/.test(rel)) {
        fail(
          `${url}: external new-tab link missing noopener/noreferrer (${href})`,
        );
      }
    }
  }

  for (const tag of fullTags(html, "button")) {
    if (!hasAccessibleName(tag)) {
      fail(`${url}: button has no accessible name`);
    }
  }

  auditFormLabels(html, url);
}

function auditFormLabels(html, url) {
  const labelTargets = new Set(
    allTags(html, "label")
      .map((tag) => attrs(tag).for)
      .filter(Boolean),
  );
  const wrappedLabelTargets = new Set();

  for (const label of fullTags(html, "label")) {
    const control = label.match(/<(input|textarea|select)\b[^>]*>/i)?.[0];

    if (!control) continue;

    const controlAttributes = attrs(control);

    if (controlAttributes.id) wrappedLabelTargets.add(controlAttributes.id);
    if (controlAttributes.name) wrappedLabelTargets.add(controlAttributes.name);
  }

  for (const tag of [
    ...allTags(html, "input"),
    ...allTags(html, "textarea"),
    ...allTags(html, "select"),
  ]) {
    const control = attrs(tag);
    const type = (control.type || "").toLowerCase();

    if (["hidden", "submit", "button"].includes(type)) continue;

    const labelKey = control.id || control.name || "";

    if (
      !control["aria-label"] &&
      !control["aria-labelledby"] &&
      !labelTargets.has(control.id) &&
      !wrappedLabelTargets.has(labelKey)
    ) {
      fail(`${url}: form control has no label (${control.name || control.id})`);
    }
  }
}

function recordUniqueMetadata(index, value, url, label) {
  const normalized = value.trim().replace(/\s+/g, " ");

  if (!normalized) return;

  const existing = index.get(normalized);

  if (existing) {
    fail(`${url}: duplicate ${label} also used by ${existing}`);
    return;
  }

  index.set(normalized, url);
}

function auditGeneratedPageCoverage(sitemapLocs) {
  const sitemapUrls = new Set(sitemapLocs);
  const generatedPageUrls = distFiles()
    .filter((file) => file.endsWith(`${path.sep}index.html`))
    .map(pageUrlForFile)
    .filter(Boolean);

  for (const url of generatedPageUrls) {
    if (!sitemapUrls.has(url)) {
      fail(`${url}: generated public page is missing from sitemap`);
    }
  }
}

function isTeamPage(url) {
  return /^https:\/\/lbsailab\.com\/batches\/spring-2026\/[^/]+\/$/.test(url);
}

function teamSlugFromUrl(url) {
  return url.match(/\/batches\/spring-2026\/([^/]+)\/$/)?.[1] || "";
}

function auditTeamSocialImage(url, html) {
  if (!isTeamPage(url)) return;

  const slug = teamSlugFromUrl(url);
  const expectedImage = `${SITE_URL}/og-team-${slug}.png`;

  assertEqual(metaContent(html, "og:image"), expectedImage, `${url}: og:image`);
  assertEqual(
    metaContent(html, "twitter:image"),
    expectedImage,
    `${url}: twitter:image`,
  );

  if (!existsSync(path.join(DIST, `og-team-${slug}.png`))) {
    fail(`${url}: generated team Open Graph image is missing`);
  }
}

function auditTeamJsonLd(url, items, html) {
  if (!isTeamPage(url)) return;

  const team = items.find(
    (item) =>
      item?.["@type"] === "Organization" &&
      item?.["@id"] === `${url}#team` &&
      item?.url === url,
  );

  if (!team) {
    fail(`${url}: missing team Organization JSON-LD`);
    return;
  }

  if (!team.description) {
    fail(`${url}: team Organization JSON-LD missing description`);
  }

  if (!team.knowsAbout) {
    fail(`${url}: team Organization JSON-LD missing knowsAbout`);
  }

  if (team.parentOrganization?.["@id"] !== `${SITE_URL}/#organization`) {
    fail(`${url}: team Organization JSON-LD missing parent organization`);
  }

  const members = Array.isArray(team.member) ? team.member : [];

  if (!members.length) {
    fail(`${url}: team Organization JSON-LD missing members`);
  }

  for (const member of members) {
    if (member?.["@type"] !== "Person" || !member.name || !member.jobTitle) {
      fail(`${url}: invalid team member Person JSON-LD`);
    }
  }

  const prototype = items.find(
    (item) =>
      item?.["@type"] === "CreativeWork" &&
      item?.["@id"] === `${url}#prototype`,
  );
  const hasProductLink = html.includes("Open prototype");

  if (!hasProductLink && prototype) {
    fail(`${url}: prototype CreativeWork JSON-LD present without product link`);
  }

  if (hasProductLink && !prototype) {
    fail(`${url}: missing prototype CreativeWork JSON-LD`);
    return;
  }

  if (!prototype) return;

  if (!prototype.url || !/^https:\/\//.test(prototype.url)) {
    fail(`${url}: prototype CreativeWork JSON-LD missing HTTPS URL`);
  }

  if (prototype.creator?.["@id"] !== `${url}#team`) {
    fail(`${url}: prototype CreativeWork JSON-LD missing team creator`);
  }
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

    if (!sitemap.includes(`<lastmod>${EXPECTED_LASTMOD}</lastmod>`)) {
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

    if (
      url.origin === SITE_URL &&
      !existsSync(path.join(DIST, decodeURIComponent(url.pathname.slice(1))))
    ) {
      fail(`Image sitemap references missing file: ${imageUrl}`);
    }
  }

  if (!feed.includes("<feed") || !feed.includes(`${SITE_URL}/feed.xml`)) {
    fail("feed.xml is missing Atom feed markers");
  }

  if (!feed.includes(`<updated>${EXPECTED_LASTMOD}</updated>`)) {
    fail("feed.xml is missing the current updated value");
  }
}

function auditErrorDocument() {
  const html = readDist("404.html");

  if (!html) return;

  if (!/<meta\b[^>]*name=["']robots["'][^>]*noindex,nofollow/i.test(html)) {
    fail("404.html is missing noindex,nofollow meta robots");
  }

  if (html.includes(INDEXABLE_META_ROBOTS)) {
    fail("404.html contains indexable robots metadata");
  }

  if (/<link\b[^>]*rel=["']canonical["']/i.test(html)) {
    fail("404.html must not include a canonical URL");
  }

  if (/<meta\b[^>]*(?:property|name)=["'](?:og:|twitter:)/i.test(html)) {
    fail("404.html must not include social preview metadata");
  }

  for (const href of ['href="/"', 'href="/sitemap/"']) {
    if (!html.includes(href)) {
      fail(`404.html missing recovery link ${href}`);
    }
  }
}

function auditPage(url, metadataIndex) {
  const relativeFile = pageFileForUrl(url);
  const html = readDist(relativeFile);
  const canonicalLinks = linkAttrs(html, "canonical");
  const alternates = linkAttrs(html, "alternate");
  const jsonLdScripts = [
    ...html.matchAll(
      /<script\s+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
    ),
  ];
  const jsonLdItems = [];

  if (!html) return;

  const title = pageTitle(html);
  const description = metaContent(html, "description");

  auditHtmlIntegrity(html, url);

  recordUniqueMetadata(metadataIndex.titles, title, url, "title");
  recordUniqueMetadata(
    metadataIndex.descriptions,
    description,
    url,
    "meta description",
  );

  if (canonicalLinks.length !== 1) {
    fail(`${url}: expected one canonical link, found ${canonicalLinks.length}`);
  } else {
    assertEqual(canonicalLinks[0].href, url, `${url}: canonical`);
  }

  assertTruthy(
    title.length >= 10 && title.length <= 70,
    `${url}: title length`,
  );
  assertTruthy(description, `${url}: meta description`);
  assertTruthy(
    description.length >= 50 && description.length <= 165,
    `${url}: meta description length`,
  );
  assertEqual(
    metaContent(html, "robots"),
    INDEXABLE_META_ROBOTS,
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
  assertEqual(metaContent(html, "og:title"), title, `${url}: og:title`);
  assertEqual(
    metaContent(html, "og:description"),
    description,
    `${url}: og:description`,
  );
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
  assertEqual(
    metaContent(html, "twitter:title"),
    title,
    `${url}: twitter:title`,
  );
  assertTruthy(
    metaContent(html, "twitter:description"),
    `${url}: twitter:description`,
  );
  assertEqual(
    metaContent(html, "twitter:description"),
    description,
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
  auditTeamSocialImage(url, html);

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
      const item = JSON.parse(json);
      jsonLdItems.push(item);

      if (item?.["@type"] === "WebPage") {
        assertEqual(
          item.dateModified,
          EXPECTED_UPDATED_AT,
          `${url}: WebPage dateModified`,
        );
      }
    } catch (error) {
      fail(`${url}: invalid JSON-LD (${error.message})`);
    }
  }

  auditTeamJsonLd(url, jsonLdItems, html);

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
  auditErrorDocument();

  const pages = auditSitemap();
  const metadataIndex = {
    descriptions: new Map(),
    titles: new Map(),
  };

  for (const page of pages) {
    auditPage(page, metadataIndex);
  }

  auditGeneratedPageCoverage(pages);

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
