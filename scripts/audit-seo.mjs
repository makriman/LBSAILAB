import { existsSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
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
const INDEXABLE_META_ROBOTS =
  "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1";
const EXPECTED_UPDATED_AT = "2026-06-16";
const EXPECTED_LASTMOD = `${EXPECTED_UPDATED_AT}T00:00:00.000Z`;
const EXPECTED_VIEWPORT = "width=device-width, initial-scale=1";
const EXPECTED_ORGANIZATION_TOPICS = [
  "AI product development",
  "AI-assisted application development",
  "London Business School workflows",
  "Product prototyping",
  "Applied AI education",
];
const EXPECTED_SITE_NAVIGATION_URLS = [
  `${SITE_URL}/about/`,
  `${SITE_URL}/batches/`,
  `${SITE_URL}/batches/spring-2026/`,
  `${SITE_URL}/mentors/`,
  `${SITE_URL}/apply/`,
  `${SITE_URL}/contact/`,
  `${SITE_URL}/sitemap/`,
];
const REQUIRED_WORKER_GONE_PATHS = [
  "/_headers",
  "/_headers/",
  "/_redirects",
  "/_redirects/",
  "/images/lbs-ai-lab-workshop-hero.png",
  "/mentors/rhea-bisaria.png",
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

function readDistBuffer(relativePath) {
  const fullPath = path.join(DIST, relativePath);

  if (!existsSync(fullPath)) {
    fail(`Missing dist/${relativePath}`);
    return Buffer.alloc(0);
  }

  return readFileSync(fullPath);
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
      .replace(/<svg\b[\s\S]*?<\/svg>/gi, "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function mainContentHtml(html) {
  return (
    html.match(
      /<main\b[^>]*\bid=["']main-content["'][^>]*>([\s\S]*?)<\/main>/i,
    )?.[1] || html
  );
}

function wordsForText(text) {
  return text
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);
}

function comparisonShingles(text, size = 5) {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word.length > 2);
  const shingles = new Set();

  for (let index = 0; index <= words.length - size; index += 1) {
    shingles.add(words.slice(index, index + size).join(" "));
  }

  return shingles;
}

function jaccardSimilarity(left, right) {
  if (!left.size && !right.size) return 0;

  let intersection = 0;

  for (const item of left) {
    if (right.has(item)) intersection += 1;
  }

  return intersection / new Set([...left, ...right]).size;
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

function extractImageLocs(xml) {
  return [...xml.matchAll(/<image:loc>(.*?)<\/image:loc>/g)].map((match) =>
    match[1].trim(),
  );
}

function extractLastmods(xml) {
  return [...xml.matchAll(/<lastmod>(.*?)<\/lastmod>/g)].map((match) =>
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

function normalizePageLink(href, baseUrl) {
  if (
    !href ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return null;
  }

  try {
    const url = new URL(decodeHtml(href), baseUrl);
    url.hash = "";

    if (url.origin !== SITE_URL || url.search) return null;
    if (!url.pathname.endsWith("/")) return null;

    return url.toString();
  } catch {
    return null;
  }
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

function fragmentTargets(html) {
  const targets = new Set();

  for (const tag of [...html.matchAll(/<[a-z][\w:-]*\b[^>]*>/gi)].map(
    (match) => match[0],
  )) {
    const attributes = attrs(tag);

    if (attributes.id) targets.add(attributes.id);
  }

  for (const anchor of allTags(html, "a")) {
    const name = attrs(anchor).name;

    if (name) targets.add(name);
  }

  return targets;
}

function decodeFragmentId(hash) {
  const raw = hash.replace(/^#/, "");

  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function fragmentReference(href, baseUrl) {
  if (
    !href ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:") ||
    href.startsWith("javascript:")
  ) {
    return null;
  }

  try {
    const target = new URL(decodeHtml(href), baseUrl);

    if (target.origin !== SITE_URL || !target.hash) return null;

    const fragment = decodeFragmentId(target.hash);
    target.hash = "";

    return fragment ? { fragment, url: target.toString() } : null;
  } catch {
    return null;
  }
}

function auditAnchorFragmentTarget(sourceUrl, href, sourceHtml, sitemapPages) {
  const reference = fragmentReference(href, sourceUrl);

  if (!reference) return;

  if (!sitemapPages.has(reference.url)) {
    fail(`${sourceUrl}: fragment link points outside sitemap ${href}`);
    return;
  }

  const targetHtml =
    reference.url === sourceUrl
      ? sourceHtml
      : readDist(pageFileForUrl(reference.url));

  if (!fragmentTargets(targetHtml).has(reference.fragment)) {
    fail(`${sourceUrl}: fragment link ${href} has no target`);
  }
}

function workerContentSecurityPolicy() {
  const worker = readFileSync(path.join(ROOT, "src", "worker.ts"), "utf8");
  const match = worker.match(/"Content-Security-Policy":\s*("[^"]+")/);

  if (!match) {
    fail("Worker is missing Content-Security-Policy header");
    return "";
  }

  return JSON.parse(match[1]);
}

function auditWorkerRetiredPaths() {
  const worker = readFileSync(path.join(ROOT, "src", "worker.ts"), "utf8");

  for (const pathname of REQUIRED_WORKER_GONE_PATHS) {
    if (!worker.includes(`"${pathname}"`)) {
      fail(`Worker GONE_PATHS is missing ${pathname}`);
    }
  }

  if (!worker.includes("if (GONE_PATHS.has(pathname)) return false;")) {
    fail("Worker should avoid trailing-slash redirects for GONE_PATHS");
  }

  if (
    !worker.includes("cacheControlFor(pathname, headers, response.status)") ||
    !worker.includes("if (status >= 400) return SHORT_CACHE_CONTROL;")
  ) {
    fail(
      "Worker should short-cache missing assets and other 4xx/5xx responses",
    );
  }

  if (!worker.includes("if (status >= 400) return true;")) {
    fail("Worker should set Last-Modified on 4xx/5xx responses");
  }
}

function auditWorkerSeoAccessLogging() {
  const worker = readFileSync(path.join(ROOT, "src", "worker.ts"), "utf8");

  for (const expected of [
    "SEO_CRAWLER_USER_AGENTS",
    'type: "seo-access"',
    "response.status >= 500",
    'response.headers.get("Cache-Control")',
    'response.headers.get("X-Robots-Tag")',
    "Content-Language",
    "Googlebot",
    "Bingbot",
    "DuckDuckBot",
    "LinkedInBot",
    "host: sanitizeHost(url.host)",
    "location: sanitizeHeaderValue",
    "sanitizePath(url.pathname)",
  ]) {
    if (!worker.includes(expected)) {
      fail(`Worker SEO access logging is missing ${expected}`);
    }
  }
}

function auditWorkerImageIndexingHeaders() {
  const worker = readFileSync(path.join(ROOT, "src", "worker.ts"), "utf8");

  for (const expected of [
    "isIndexableImageAsset(pathname)",
    "function isIndexableImageAsset",
    'pathname.startsWith("/images/")',
    'pathname.startsWith("/favicon/")',
    "/^\\/og-[^/]+\\.png$/.test(pathname)",
    "/^\\/google-deepmind-logo-[^/]+\\.png$/.test(pathname)",
    'pathname === "/og-default.svg"',
  ]) {
    if (!worker.includes(expected)) {
      fail(`Worker image indexing headers are missing ${expected}`);
    }
  }
}

function auditWorkerDiscoveryRedirects() {
  const worker = readFileSync(path.join(ROOT, "src", "worker.ts"), "utf8");

  for (const [source, target] of [
    ["/sitemap.xml", "/sitemap-index.xml"],
    ["/feed", "/feed.xml"],
    ["/rss", "/feed.xml"],
    ["/rss.xml", "/feed.xml"],
    ["/atom", "/feed.xml"],
    ["/atom.xml", "/feed.xml"],
  ]) {
    if (!worker.includes(`["${source}", "${target}"]`)) {
      fail(`Worker discovery redirects missing ${source} to ${target}`);
    }
  }
}

function auditSearchEngineVerificationSupport() {
  const layout = readFileSync(
    path.join(ROOT, "src", "layouts", "BaseLayout.astro"),
    "utf8",
  );
  const liveAudit = readFileSync(
    path.join(ROOT, "scripts", "audit-live-seo.mjs"),
    "utf8",
  );
  const workflow = readFileSync(
    path.join(ROOT, ".github", "workflows", "seo.yml"),
    "utf8",
  );
  const worker = readFileSync(path.join(ROOT, "src", "worker.ts"), "utf8");

  for (const expected of [
    "PUBLIC_GOOGLE_SITE_VERIFICATION",
    'name="google-site-verification"',
    "PUBLIC_BING_SITE_VERIFICATION",
    'name="msvalidate.01"',
  ]) {
    if (!layout.includes(expected)) {
      fail(`BaseLayout search verification support is missing ${expected}`);
    }
  }

  for (const expected of [
    "GOOGLE_SITE_VERIFICATION_FILE",
    "BING_SITE_VERIFICATION_TOKEN",
    'const BING_SITE_AUTH_PATH = "/BingSiteAuth.xml"',
    "google-site-verification:",
    "<users>",
    "function siteVerificationGoogleFileName",
    "function siteVerificationToken",
    "X-Robots-Tag",
    "NOINDEX_ROBOTS",
  ]) {
    if (!worker.includes(expected)) {
      fail(`Worker search verification support is missing ${expected}`);
    }
  }

  for (const expected of [
    "auditSearchVerificationFiles",
    "GOOGLE_SITE_VERIFICATION_FILE",
    "BING_SITE_VERIFICATION_TOKEN",
    "google-site-verification:",
    "/BingSiteAuth.xml",
  ]) {
    if (!liveAudit.includes(expected)) {
      fail(`Live SEO search verification audit is missing ${expected}`);
    }
  }

  for (const expected of [
    "BING_SITE_VERIFICATION_TOKEN: ${{ secrets.BING_SITE_VERIFICATION_TOKEN }}",
    "GOOGLE_SITE_VERIFICATION_FILE: ${{ secrets.GOOGLE_SITE_VERIFICATION_FILE }}",
  ]) {
    if (!workflow.includes(expected)) {
      fail(`SEO workflow search verification env is missing ${expected}`);
    }
  }
}

function auditExternalPerformanceMonitorConfig() {
  const packageJson = readFileSync(path.join(ROOT, "package.json"), "utf8");
  const workflow = readFileSync(
    path.join(ROOT, ".github", "workflows", "seo.yml"),
    "utf8",
  );
  const liveAudit = readFileSync(
    path.join(ROOT, "scripts", "audit-live-seo.mjs"),
    "utf8",
  );

  if (
    !packageJson.includes('"seo:pagespeed": "node scripts/audit-pagespeed.mjs"')
  ) {
    fail("package.json is missing the seo:pagespeed script");
  }

  if (!packageJson.includes("npm run seo:pagespeed")) {
    fail("seo:production should include PageSpeed Insights monitoring");
  }

  if (!packageJson.includes('"seo:crux": "node scripts/audit-crux.mjs"')) {
    fail("package.json is missing the seo:crux script");
  }

  if (!packageJson.includes("npm run seo:crux")) {
    fail("seo:production should include CrUX Core Web Vitals monitoring");
  }

  if (
    !packageJson.includes(
      '"seo:live": "npm run seo:monitor && npm run seo:audit:live"',
    )
  ) {
    fail("package.json is missing the seo:live production smoke script");
  }

  if (!packageJson.includes('"seo:production": "npm run seo:live')) {
    fail("seo:production should reuse the live SEO smoke suite");
  }

  if (!packageJson.includes("npx wrangler deploy --keep-vars")) {
    fail("deploy script should preserve dashboard-set Worker variables");
  }

  if (!packageJson.includes('"deploy": "npm run build')) {
    fail("deploy script should build before publishing");
  }

  if (!packageJson.includes("npm run seo:indexnow && npm run seo:live")) {
    fail("deploy script should ping IndexNow and run live SEO verification");
  }

  if (!workflow.includes("Run live SEO smoke suite")) {
    fail("SEO workflow should run the live SEO smoke suite on main pushes");
  }

  if (!workflow.includes("run: npm run seo:live")) {
    fail("SEO workflow should call npm run seo:live");
  }

  if (!liveAudit.includes("isCloudflareInsightsScript")) {
    fail("Live SEO audit should explicitly recognize Cloudflare Insights");
  }

  if (!workflow.includes("timeout-minutes: 25")) {
    fail("SEO workflow timeout should allow external performance monitoring");
  }

  if (
    !workflow.includes("PAGESPEED_API_KEY: ${{ secrets.PAGESPEED_API_KEY }}")
  ) {
    fail("SEO workflow should pass the optional PageSpeed API key secret");
  }

  if (!workflow.includes("CRUX_API_KEY: ${{ secrets.CRUX_API_KEY }}")) {
    fail("SEO workflow should pass the optional CrUX API key secret");
  }
}

function auditSeoMonitorConfig() {
  const monitor = readFileSync(
    path.join(ROOT, "scripts", "monitor-seo.mjs"),
    "utf8",
  );
  const liveAudit = readFileSync(
    path.join(ROOT, "scripts", "audit-live-seo.mjs"),
    "utf8",
  );

  for (const expected of [
    "Cloudflare",
    "Google",
    "resolve4",
    "resolve6",
    "recordsEqual(apexRecords, wwwRecords)",
    "checkCertificates",
    "checkHttpProtocols",
    "checkVitalsEndpoint",
    "connectionType",
    "viewport",
    "missing-seo-monitor-file.css",
    "missing-seo-monitor-script.js",
    "missing-seo-monitor-image.webp",
    "facebookexternalhit",
    "LinkedInBot",
    "Twitterbot",
  ]) {
    if (!monitor.includes(expected)) {
      fail(`SEO monitor is missing ${expected}`);
    }
  }

  for (const expected of [
    "assertSecurityHeaders(imageResponse, imageSitemapUrl)",
    "assertIndexableHeaders(imageResponse, imageSitemapUrl)",
    "assertShortCache(imageResponse, imageSitemapUrl)",
    "auditDuplicateOriginRedirects(pages)",
    "auditMissingFileResources",
    "missing-seo-audit-file.css",
    "missing-seo-audit-script.js",
    "missing-seo-audit-image.webp",
    "expected XML content type",
  ]) {
    if (!liveAudit.includes(expected)) {
      fail(`Live SEO audit image sitemap checks are missing ${expected}`);
    }
  }
}

function auditSeoLogAnalyzer() {
  const packageJson = readFileSync(path.join(ROOT, "package.json"), "utf8");
  const analyzerPath = path.join(ROOT, "scripts", "analyze-seo-logs.mjs");
  const analyzer = readFileSync(analyzerPath, "utf8");

  if (
    !packageJson.includes('"seo:logs": "node scripts/analyze-seo-logs.mjs"')
  ) {
    fail("package.json is missing the seo:logs script");
  }

  for (const expected of [
    "seo-access",
    "web-vitals",
    "crawler-facing",
    "EXPECTED_INDEXABLE_ROBOTS",
    "SEVERE_VITAL_LIMITS",
    "auditVitalsPercentiles",
    "isCanonicalRedirectTarget",
    "redirectTargets",
    "crawler-facing ${status} redirect",
    "vitalsByConnection",
    "vitalsByViewport",
    "p75",
    "SEO log analysis passed",
  ]) {
    if (!analyzer.includes(expected)) {
      fail(`SEO log analyzer is missing ${expected}`);
    }
  }

  const goodLogs = [
    JSON.stringify({
      cacheControl: "public, max-age=300, must-revalidate",
      contentType: "text/html",
      crawler: "Googlebot",
      host: "lbsailab.com",
      path: "/batches/spring-2026/",
      robots:
        "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1",
      status: 200,
      type: "seo-access",
    }),
    JSON.stringify({
      cacheControl: "public, max-age=300, must-revalidate",
      contentType: null,
      crawler: "Bingbot",
      host: "www.lbsailab.com",
      location: "https://lbsailab.com/about/",
      path: "/about",
      robots: null,
      status: 301,
      type: "seo-access",
    }),
    JSON.stringify({
      connectionType: "4g",
      metrics: [
        { name: "LCP", value: 1200 },
        { name: "CLS", value: 0.02 },
      ],
      path: "/",
      saveData: false,
      type: "web-vitals",
      viewport: "mobile",
    }),
  ].join("\n");
  const badLogs = JSON.stringify({
    cacheControl: "public, max-age=300, must-revalidate",
    contentType: "text/html",
    crawler: "Googlebot",
    path: "/missing-page/",
    robots: "noindex, nofollow",
    status: 404,
    type: "seo-access",
  });
  const badVitalsLogs = [
    JSON.stringify({
      connectionType: "3g",
      metrics: [
        { name: "LCP", value: 1200 },
        { name: "LCP", value: 2600 },
        { name: "LCP", value: 4200 },
        { name: "LCP", value: 4300 },
      ],
      path: "/",
      type: "web-vitals",
      viewport: "mobile",
    }),
  ].join("\n");
  const badRedirectLogs = JSON.stringify({
    cacheControl: "public, max-age=300, must-revalidate",
    contentType: null,
    crawler: "Bingbot",
    host: "lbsailab.com",
    location: "https://example.com/about/",
    path: "/about",
    status: 302,
    type: "seo-access",
  });
  const good = spawnSync(process.execPath, [analyzerPath], {
    encoding: "utf8",
    input: goodLogs,
  });
  const bad = spawnSync(process.execPath, [analyzerPath], {
    encoding: "utf8",
    input: badLogs,
  });
  const badVitals = spawnSync(process.execPath, [analyzerPath], {
    encoding: "utf8",
    input: badVitalsLogs,
  });
  const badRedirect = spawnSync(process.execPath, [analyzerPath], {
    encoding: "utf8",
    input: badRedirectLogs,
  });

  if (
    good.status !== 0 ||
    !good.stdout.includes("SEO log analysis passed") ||
    !good.stdout.includes('"p75"') ||
    !good.stdout.includes("Redirects") ||
    !good.stdout.includes("Vitals by viewport") ||
    !good.stdout.includes("Vitals by connection")
  ) {
    fail(
      `SEO log analyzer did not pass valid sample logs: ${good.stderr || good.stdout}`,
    );
  }

  if (bad.status === 0 || !bad.stderr.includes("crawler-facing 404")) {
    fail("SEO log analyzer did not fail crawler-facing 404 sample logs");
  }

  if (
    badVitals.status === 0 ||
    !badVitals.stderr.includes("web-vitals p75 LCP")
  ) {
    fail("SEO log analyzer did not fail severe p75 vitals sample logs");
  }

  if (
    badRedirect.status === 0 ||
    !badRedirect.stderr.includes("crawler-facing 302 redirect") ||
    !badRedirect.stderr.includes("non-canonical redirect target")
  ) {
    fail("SEO log analyzer did not fail temporary external redirect logs");
  }
}

function auditWorkerCsp(pages) {
  const csp = workerContentSecurityPolicy();
  const scriptSrc = cspDirective(csp, "script-src");
  const scriptSrcAttr = cspDirective(csp, "script-src-attr");
  const hashes = new Set();

  if (!scriptSrc) {
    fail("Worker CSP is missing script-src");
    return;
  }

  if (!scriptSrcAttr.split(/\s+/).includes("'none'")) {
    fail("Worker CSP script-src-attr must be 'none'");
  }

  if (/\b'unsafe-inline'\b/.test(scriptSrc)) {
    fail("Worker CSP script-src must not allow unsafe-inline");
  }

  if (!scriptSrc.includes("https://static.cloudflareinsights.com")) {
    fail("Worker CSP script-src must allow Cloudflare Insights script origin");
  }

  for (const page of pages) {
    for (const hash of executableInlineScriptHashes(
      readDist(pageFileForUrl(page)),
    )) {
      hashes.add(hash);
    }
  }

  for (const hash of hashes) {
    if (!scriptSrc.includes(`'${hash}'`)) {
      fail(`Worker CSP script-src is missing '${hash}'`);
    }
  }
}

function auditHtmlIntegrity(html, url) {
  for (const eventHandler of inlineEventHandlerAttributes(html)) {
    fail(
      `${url}: inline event handler ${eventHandler.attribute} found on <${eventHandler.tagName}>`,
    );
  }

  if (!/<html\b[^>]*\blang=["']en["']/i.test(html)) {
    fail(`${url}: html lang should be en`);
  }

  const viewport = metaContent(html, "viewport");

  if (viewport !== EXPECTED_VIEWPORT) {
    fail(
      `${url}: viewport meta expected "${EXPECTED_VIEWPORT}", got "${viewport || "(missing)"}"`,
    );
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

      if (!/\bnoopener\b/.test(rel) || !/\bnoreferrer\b/.test(rel)) {
        fail(
          `${url}: external new-tab link missing noopener noreferrer (${href})`,
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

function minimumMainWordCount(url) {
  const { pathname } = new URL(url);

  if (pathname === "/sitemap/") return 40;
  if (pathname === "/contact/") return 90;
  if (/^\/batches\/spring-2026\/[^/]+\/$/.test(pathname)) return 90;
  if (pathname === "/") return 250;

  return 110;
}

function auditContentQuality(url, html, metadataIndex) {
  const mainHtml = mainContentHtml(html);
  const mainText = textContent(mainHtml);
  const words = wordsForText(mainText);
  const minimumWords = minimumMainWordCount(url);

  if (words.length < minimumWords) {
    fail(
      `${url}: main content is thin (${words.length} words, expected at least ${minimumWords})`,
    );
  }

  if (/page not found|could not be found|404\b/i.test(mainText)) {
    fail(`${url}: canonical page appears to contain not-found copy`);
  }

  const uniqueWords = new Set(
    words
      .map((word) => word.toLowerCase().replace(/[^a-z0-9]/g, ""))
      .filter((word) => word.length > 2),
  );

  if (words.length >= 90 && uniqueWords.size < 35) {
    fail(`${url}: main content has too little vocabulary variety`);
  }

  metadataIndex.mainContent.set(url, {
    shingles: comparisonShingles(mainText),
    wordCount: words.length,
  });
}

function auditDuplicateMainContent(mainContentIndex) {
  const pages = [...mainContentIndex.entries()];

  for (let leftIndex = 0; leftIndex < pages.length; leftIndex += 1) {
    for (
      let rightIndex = leftIndex + 1;
      rightIndex < pages.length;
      rightIndex += 1
    ) {
      const [leftUrl, left] = pages[leftIndex];
      const [rightUrl, right] = pages[rightIndex];

      if (Math.min(left.wordCount, right.wordCount) < 90) continue;

      const similarity = jaccardSimilarity(left.shingles, right.shingles);

      if (similarity > 0.7) {
        fail(
          `${leftUrl} and ${rightUrl}: main content is too similar (${similarity.toFixed(2)})`,
        );
      }
    }
  }
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

function auditItemListJsonLd(url, items, sitemapPages) {
  const itemLists = items.filter((item) => item?.["@type"] === "ItemList");

  for (const itemList of itemLists) {
    const elements = Array.isArray(itemList.itemListElement)
      ? itemList.itemListElement
      : [];

    if (!itemList["@id"]?.startsWith(url)) {
      fail(`${url}: ItemList JSON-LD missing stable page-scoped @id`);
    }

    if (!itemList.name) {
      fail(`${url}: ItemList JSON-LD missing name`);
    }

    if (
      itemList.itemListOrder !== "https://schema.org/ItemListOrderAscending"
    ) {
      fail(`${url}: ItemList JSON-LD missing ascending list order`);
    }

    if (itemList.numberOfItems !== elements.length) {
      fail(`${url}: ItemList numberOfItems does not match list length`);
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

      const entryUrl = normalizePageLink(
        entry?.url || entry?.item?.url || "",
        url,
      );

      if (!entryUrl) {
        fail(`${url}: ItemList entry ${index + 1} missing canonical URL`);
      } else if (!sitemapPages.has(entryUrl)) {
        fail(`${url}: ItemList entry ${entryUrl} is not in the sitemap`);
      }
    });
  }
}

function auditMentorJsonLd(url, items) {
  if (url !== `${SITE_URL}/mentors/`) return;

  const expectedMentors = [
    {
      name: "Kostis Christodoulou",
      id: `${SITE_URL}/mentors/#academic-lead-kostis-christodoulou`,
      sameAsPrefix: "https://www.london.edu/",
    },
    {
      name: "Ramakrishnan Lokanathan",
      id: `${SITE_URL}/mentors/#mentor-ramakrishnan-lokanathan`,
      sameAsPrefix: "https://www.linkedin.com/",
    },
    {
      name: "Akshay Nagpal",
      id: `${SITE_URL}/mentors/#mentor-akshay-nagpal`,
      sameAsPrefix: "https://www.linkedin.com/",
    },
    {
      name: "Zara Mogadasi",
      id: `${SITE_URL}/mentors/#mentor-zara-mogadasi`,
      sameAsPrefix: "https://www.linkedin.com/",
    },
    {
      name: "Rhea Bisaria",
      id: `${SITE_URL}/mentors/#mentor-rhea-bisaria`,
      sameAsPrefix: "https://www.linkedin.com/",
    },
  ];
  const people = items.filter((item) => item?.["@type"] === "Person");
  const mentorList = items.find(
    (item) =>
      item?.["@type"] === "ItemList" && item?.name === "LBS AI Lab mentors",
  );

  if (people.length < expectedMentors.length) {
    fail(
      `${url}: expected ${expectedMentors.length} mentor Person JSON-LD nodes, found ${people.length}`,
    );
  }

  if (!mentorList) {
    fail(`${url}: missing mentors ItemList JSON-LD`);
  } else {
    const elements = Array.isArray(mentorList.itemListElement)
      ? mentorList.itemListElement
      : [];

    if (elements.length !== expectedMentors.length) {
      fail(
        `${url}: mentors ItemList should include ${expectedMentors.length} people`,
      );
    }

    for (const expected of expectedMentors) {
      const listEntry = elements.find(
        (entry) => entry?.item?.["@id"] === expected.id,
      );

      if (!listEntry) {
        fail(`${url}: mentors ItemList missing ${expected.name}`);
      }
    }
  }

  for (const expected of expectedMentors) {
    const person = people.find((item) => item?.["@id"] === expected.id);

    if (!person) {
      fail(`${url}: missing Person JSON-LD for ${expected.name}`);
      continue;
    }

    assertEqual(person.name, expected.name, `${url}: Person name`);

    if (!person.description) {
      fail(`${url}: ${expected.name} Person JSON-LD missing description`);
    }

    if (!person.jobTitle) {
      fail(`${url}: ${expected.name} Person JSON-LD missing jobTitle`);
    }

    if (
      !person.image ||
      !person.image.startsWith(`${SITE_URL}/mentors/`) ||
      !existsSync(
        path.join(
          DIST,
          decodeURIComponent(new URL(person.image).pathname.slice(1)),
        ),
      )
    ) {
      fail(`${url}: ${expected.name} Person JSON-LD missing valid image`);
    }

    if (!person.sameAs?.startsWith(expected.sameAsPrefix)) {
      fail(`${url}: ${expected.name} Person JSON-LD missing valid sameAs`);
    }

    if (person.worksFor?.["@id"] !== `${SITE_URL}/#organization`) {
      fail(`${url}: ${expected.name} Person JSON-LD missing worksFor`);
    }

    if (person.affiliation?.["@id"] !== `${SITE_URL}/#organization`) {
      fail(`${url}: ${expected.name} Person JSON-LD missing affiliation`);
    }
  }
}

function auditSiteIdentityJsonLd(url, items) {
  const organization = items.find(
    (item) =>
      item?.["@type"] === "EducationalOrganization" &&
      item?.["@id"] === `${SITE_URL}/#organization`,
  );
  const website = items.find(
    (item) =>
      item?.["@type"] === "WebSite" && item?.["@id"] === `${SITE_URL}/#website`,
  );

  if (!website) {
    fail(`${url}: missing WebSite JSON-LD`);
  } else {
    if (website.name !== "LBS AI Lab") {
      fail(`${url}: WebSite JSON-LD has wrong name`);
    }

    if (website.url !== `${SITE_URL}/`) {
      fail(`${url}: WebSite JSON-LD has wrong URL`);
    }

    if (website.inLanguage !== "en-GB") {
      fail(`${url}: WebSite JSON-LD should use en-GB`);
    }

    if (website.publisher?.["@id"] !== `${SITE_URL}/#organization`) {
      fail(`${url}: WebSite JSON-LD missing publisher organization`);
    }
  }

  if (!organization) {
    fail(`${url}: missing EducationalOrganization JSON-LD`);
    return;
  }

  if (organization.logo?.url !== `${SITE_URL}/favicon/apple-touch-icon.png`) {
    fail(`${url}: organization JSON-LD missing canonical logo`);
  }

  if (organization.logo?.width !== 180 || organization.logo?.height !== 180) {
    fail(`${url}: organization logo JSON-LD should include dimensions`);
  }

  if (organization.image?.url !== `${SITE_URL}/og-default.png`) {
    fail(`${url}: organization JSON-LD missing social image`);
  }

  if (
    organization.parentOrganization?.["@id"] !==
    "https://www.london.edu/#organization"
  ) {
    fail(`${url}: organization JSON-LD missing parent organization ID`);
  }

  if (
    organization.department?.["@id"] !==
    "https://www.london.edu/faculty-and-research/data-science-and-ai-initiative#organization"
  ) {
    fail(`${url}: organization JSON-LD missing DSAI organization ID`);
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

function auditHomeNavigationJsonLd(url, items) {
  if (url !== `${SITE_URL}/`) return;

  const navigation = items.find(
    (item) =>
      item?.["@type"] === "SiteNavigationElement" &&
      item?.["@id"] === `${SITE_URL}/#site-navigation`,
  );

  if (!navigation) {
    fail(`${url}: missing SiteNavigationElement JSON-LD`);
    return;
  }

  const navigationParts = Array.isArray(navigation.hasPart)
    ? navigation.hasPart
    : [];
  const navigationUrls = navigationParts.map((item) => item?.url);

  for (const expectedUrl of EXPECTED_SITE_NAVIGATION_URLS) {
    if (!navigationUrls.includes(expectedUrl)) {
      fail(`${url}: SiteNavigationElement missing ${expectedUrl}`);
    }
  }
}

function auditSitemap() {
  const sitemapIndex = readDist("sitemap-index.xml");
  const sitemap = readDist("sitemap-0.xml");
  const sitemapLocs = extractLocs(sitemap);
  const indexLocs = extractLocs(sitemapIndex);
  const indexLastmods = extractLastmods(sitemapIndex);

  if (!indexLocs.includes(`${SITE_URL}/sitemap-0.xml`)) {
    fail("sitemap-index.xml does not reference sitemap-0.xml");
  }

  if (indexLastmods.length !== indexLocs.length) {
    fail("sitemap-index.xml should include one lastmod per sitemap URL");
  }

  for (const lastmod of indexLastmods) {
    if (lastmod !== EXPECTED_LASTMOD) {
      fail(`sitemap-index.xml has unexpected lastmod ${lastmod}`);
    }
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

function robotsRulesForUserAgent(robots, userAgent = "*") {
  const rules = [];
  let groupAgents = [];
  let groupHasRules = false;

  for (const rawLine of robots.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*/, "").trim();
    const match = line.match(/^([a-z-]+)\s*:\s*(.*)$/i);

    if (!match) continue;

    const field = match[1].toLowerCase();
    const value = match[2].trim();

    if (field === "user-agent") {
      if (groupHasRules) {
        groupAgents = [];
        groupHasRules = false;
      }

      groupAgents.push(value.toLowerCase());
      continue;
    }

    if (field !== "allow" && field !== "disallow") continue;

    groupHasRules = true;

    if (
      groupAgents.includes("*") ||
      groupAgents.includes(userAgent.toLowerCase())
    ) {
      rules.push({ directive: field, pattern: value });
    }
  }

  return rules;
}

function robotsPatternMatches(pattern, pathname) {
  if (!pattern) return false;

  const anchored = pattern.endsWith("$");
  const rawPattern = anchored ? pattern.slice(0, -1) : pattern;
  const expression = rawPattern
    .split("*")
    .map((part) => part.replace(/[.+?^${}()|[\]\\]/g, "\\$&"))
    .join(".*");
  const regex = new RegExp(`^${expression}${anchored ? "$" : ""}`);

  return regex.test(pathname);
}

function isRobotsAllowed(robots, pathname, userAgent = "*") {
  const matches = robotsRulesForUserAgent(robots, userAgent)
    .filter((rule) => robotsPatternMatches(rule.pattern, pathname))
    .toSorted((left, right) => {
      const lengthDelta = right.pattern.length - left.pattern.length;

      if (lengthDelta) return lengthDelta;
      if (left.directive === right.directive) return 0;

      return left.directive === "allow" ? -1 : 1;
    });

  return matches[0]?.directive !== "disallow";
}

function auditRobotsBehavior(robots, label = "robots.txt") {
  const allowedPaths = [
    "/",
    "/about/",
    "/_astro/app.css",
    "/images/lbs-ai-lab-workshop-hero-960.webp",
    "/favicon/favicon-32x32.png",
    "/robots.txt",
    "/sitemap-index.xml",
    "/llms.txt",
  ];
  const disallowedPaths = [
    "/api/vitals",
    "/admin/",
    "/login/",
    "/search/",
    "/cart/",
    "/checkout/",
    "/healthz",
    "/internal/private",
    "/private/page",
  ];

  for (const pathname of allowedPaths) {
    if (!isRobotsAllowed(robots, pathname)) {
      fail(`${label}: blocks crawlable path ${pathname}`);
    }
  }

  for (const pathname of disallowedPaths) {
    if (isRobotsAllowed(robots, pathname)) {
      fail(`${label}: allows private or non-indexable path ${pathname}`);
    }
  }
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

  auditRobotsBehavior(robots);
}

function auditCrawlerFiles() {
  const imageSitemap = readDist("image-sitemap.xml");
  const feed = readDist("feed.xml");
  const llms = readDist("llms.txt");
  const llmsFull = readDist("llms-full.txt");
  const key = readDist(INDEXNOW_KEY_FILE).trim();

  assertEqual(key, INDEXNOW_KEY, "IndexNow key file");

  const imageSitemapPageLocs = extractLocs(imageSitemap);
  const imageSitemapImageLocs = extractImageLocs(imageSitemap);
  const imageSitemapLastmods = extractLastmods(imageSitemap);

  if (!imageSitemapPageLocs.length) {
    fail("image-sitemap.xml has no page URLs");
  }

  if (!imageSitemapImageLocs.length) {
    fail("image-sitemap.xml has no image URLs");
  }

  if (imageSitemapLastmods.length !== imageSitemapPageLocs.length) {
    fail("image-sitemap.xml should include one lastmod per page URL");
  }

  for (const lastmod of imageSitemapLastmods) {
    if (lastmod !== EXPECTED_LASTMOD) {
      fail(`image-sitemap.xml has unexpected lastmod ${lastmod}`);
    }
  }

  for (const pageUrl of imageSitemapPageLocs) {
    const url = new URL(pageUrl);

    assertEqual(
      url.origin,
      SITE_URL,
      `Image sitemap page origin for ${pageUrl}`,
    );

    if (!url.pathname.endsWith("/")) {
      fail(`Image sitemap page URL is missing trailing slash: ${pageUrl}`);
    }
  }

  for (const imageUrl of imageSitemapImageLocs) {
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

  for (const [fileName, content] of [
    ["llms.txt", llms],
    ["llms-full.txt", llmsFull],
  ]) {
    for (const expected of [
      "# LBS AI Lab",
      `${SITE_URL}/`,
      `${SITE_URL}/about/`,
      `${SITE_URL}/batches/`,
      `${SITE_URL}/batches/spring-2026/`,
      `${SITE_URL}/mentors/`,
      `${SITE_URL}/feed.xml`,
      "Google DeepMind",
    ]) {
      if (!content.includes(expected)) {
        fail(`${fileName} is missing ${expected}`);
      }
    }

    if (/\/(?:cohorts?|teams)(?:\/|$)/i.test(content)) {
      fail(`${fileName} includes a legacy Cohort or Team URL`);
    }

    if (/\bmailto:|[a-z0-9._%+-]+@london\.edu\b/i.test(content)) {
      fail(`${fileName} should not expose email contact data`);
    }
  }

  const teamUrls = distFiles()
    .map(pageUrlForFile)
    .filter((url) => /\/batches\/spring-2026\/[^/]+\/$/.test(url || ""));

  for (const teamUrl of teamUrls) {
    if (!llms.includes(teamUrl) || !llmsFull.includes(teamUrl)) {
      fail(`AI discovery files are missing team URL ${teamUrl}`);
    }
  }

  for (const expected of [
    "Kostis Christodoulou",
    "London Eats Pal",
    "Wayfinder",
    "Zentra",
    `${SITE_URL}/llms.txt`,
    `${SITE_URL}/llms-full.txt`,
    `${SITE_URL}/sitemap-index.xml`,
  ]) {
    if (!llmsFull.includes(expected)) {
      fail(`llms-full.txt is missing ${expected}`);
    }
  }
}

function auditSecurityTxt() {
  const security = readDist(".well-known/security.txt");

  for (const expected of [
    "Contact: https://lbsailab.com/contact/",
    "Expires: 2027-06-16T00:00:00.000Z",
    "Preferred-Languages: en",
    "Canonical: https://lbsailab.com/.well-known/security.txt",
    "Policy: https://lbsailab.com/contact/",
  ]) {
    if (!security.includes(expected)) {
      fail(`security.txt is missing ${expected}`);
    }
  }

  if (/\bmailto:|[a-z0-9._%+-]+@london\.edu\b/i.test(security)) {
    fail("security.txt should use the contact page instead of exposing email");
  }
}

function auditManifestAndIcons() {
  let manifest;

  try {
    manifest = JSON.parse(readDist("site.webmanifest"));
  } catch (error) {
    fail(`site.webmanifest is invalid JSON (${error.message})`);
    return;
  }

  assertEqual(manifest.name, "LBS AI Lab", "manifest name");
  assertEqual(manifest.short_name, "LBS AI Lab", "manifest short_name");
  assertTruthy(manifest.description, "manifest description");
  assertEqual(manifest.start_url, "/", "manifest start_url");
  assertEqual(manifest.display, "standalone", "manifest display");
  assertEqual(manifest.theme_color, "#17145f", "manifest theme_color");
  assertEqual(
    manifest.background_color,
    "#fbfaf7",
    "manifest background_color",
  );

  if (!Array.isArray(manifest.icons)) {
    fail("site.webmanifest icons must be an array");
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
      fail(`site.webmanifest missing icon ${expected.src}`);
      continue;
    }

    const bytes = readDistBuffer(expected.src.replace(/^\//, ""));
    const dimensions = pngDimensions(bytes);

    if (!dimensions) {
      fail(`${expected.src}: manifest icon is not a valid PNG`);
      continue;
    }

    if (
      dimensions.width !== expected.width ||
      dimensions.height !== expected.height
    ) {
      fail(
        `${expected.src}: manifest icon dimensions expected ${expected.width}x${expected.height}, got ${dimensions.width}x${dimensions.height}`,
      );
    }
  }

  for (const icon of manifest.icons) {
    if (!icon.src?.startsWith("/favicon/")) {
      fail(`site.webmanifest icon should be same-origin favicon asset`);
    }
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

  if (metaContent(html, "viewport") !== EXPECTED_VIEWPORT) {
    fail("404.html has an incomplete viewport meta tag");
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

function auditHomeHeroImages(url, html) {
  if (url !== `${SITE_URL}/`) return;

  const imagePreloads = linkAttrs(html, "preload").filter(
    (link) => link.as === "image",
  );
  const heroPreload = imagePreloads.find((link) =>
    (link.href || "").includes("/images/lbs-ai-lab-workshop-hero-"),
  );

  if (!heroPreload) {
    fail(`${url}: missing hero image preload`);
    return;
  }

  assertEqual(heroPreload.type, "image/avif", `${url}: hero preload type`);

  if (!heroPreload.imagesrcset?.includes(".avif")) {
    fail(`${url}: hero preload srcset should include AVIF variants`);
  }

  if (!/<source\b[^>]*type=["']image\/avif["']/i.test(html)) {
    fail(`${url}: hero picture is missing an AVIF source`);
  }

  for (const width of ["960", "1280", "1672"]) {
    if (
      !existsSync(
        path.join(DIST, `images/lbs-ai-lab-workshop-hero-${width}.avif`),
      )
    ) {
      fail(`${url}: missing generated ${width}px AVIF hero image`);
    }
  }
}

function auditVitalsMonitor(url, html) {
  const monitors = fullTags(html, "script").filter((script) =>
    /\bdata-vitals-monitor\b/.test(script),
  );

  if (monitors.length !== 1) {
    fail(
      `${url}: expected one web vitals monitor script, found ${monitors.length}`,
    );
    return;
  }

  const monitor = monitors[0];

  for (const expected of [
    "PerformanceObserver",
    "/api/vitals",
    "sendBeacon",
    "TTFB",
    "FCP",
    "LCP",
    "CLS",
    "INP",
    "connectionType",
    "navigationType",
    "saveData",
    "viewport",
    "visibilityState",
  ]) {
    if (!monitor.includes(expected)) {
      fail(`${url}: web vitals monitor missing ${expected}`);
    }
  }
}

function auditPage(url, metadataIndex, sitemapPages) {
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
  const internalPageLinks = new Set();

  auditHtmlIntegrity(html, url);
  auditContentQuality(url, html, metadataIndex);
  auditHomeHeroImages(url, html);
  auditVitalsMonitor(url, html);

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
  assertEqual(
    metaContent(html, "application-name"),
    "LBS AI Lab",
    `${url}: application-name`,
  );
  assertEqual(
    metaContent(html, "apple-mobile-web-app-title"),
    "LBS AI Lab",
    `${url}: apple-mobile-web-app-title`,
  );

  const manifestLinks = linkAttrs(html, "manifest");
  const iconLinks = linkAttrs(html, "icon");
  const appleTouchIcons = linkAttrs(html, "apple-touch-icon");

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
    metaContent(html, "og:image:secure_url"),
    metaContent(html, "og:image"),
    `${url}: og:image:secure_url`,
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
    metaContent(html, "og:updated_time"),
    EXPECTED_LASTMOD,
    `${url}: og:updated_time`,
  );
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
  auditItemListJsonLd(url, jsonLdItems, sitemapPages);
  auditMentorJsonLd(url, jsonLdItems);
  auditSiteIdentityJsonLd(url, jsonLdItems);
  auditHomeNavigationJsonLd(url, jsonLdItems);

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

    auditAnchorFragmentTarget(url, href, html, sitemapPages);

    const normalized = normalizePageLink(href, url);

    if (normalized) internalPageLinks.add(normalized);
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

  return internalPageLinks;
}

function auditStaticReachability(pages, pageLinks) {
  const sitemapPages = new Set(pages);
  const inbound = new Map(pages.map((page) => [page, new Set()]));

  for (const [source, links] of pageLinks) {
    for (const linked of links) {
      if (sitemapPages.has(linked)) {
        inbound.get(linked)?.add(source);
      } else if (linked.startsWith(`${SITE_URL}/`)) {
        fail(`${source}: links to same-origin page outside sitemap ${linked}`);
      }
    }
  }

  for (const page of pages) {
    if (page === `${SITE_URL}/`) continue;

    const sources = inbound.get(page) || new Set();

    if (!sources.size) {
      fail(`${page}: sitemap page has no crawlable inbound link`);
    }
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
  auditSecurityTxt();
  auditManifestAndIcons();
  auditErrorDocument();
  auditWorkerRetiredPaths();
  auditWorkerSeoAccessLogging();
  auditWorkerImageIndexingHeaders();
  auditWorkerDiscoveryRedirects();
  auditSearchEngineVerificationSupport();
  auditExternalPerformanceMonitorConfig();
  auditSeoMonitorConfig();
  auditSeoLogAnalyzer();

  const pages = auditSitemap();
  const metadataIndex = {
    descriptions: new Map(),
    mainContent: new Map(),
    titles: new Map(),
  };
  const pageLinks = new Map();
  const sitemapPages = new Set(pages);

  for (const page of pages) {
    pageLinks.set(
      page,
      auditPage(page, metadataIndex, sitemapPages) || new Set(),
    );
  }

  auditWorkerCsp(pages);
  auditStaticReachability(pages, pageLinks);
  auditDuplicateMainContent(metadataIndex.mainContent);
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
