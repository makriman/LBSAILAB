import { lookup as systemLookup, setServers } from "node:dns";
import { createHash } from "node:crypto";
import { Resolver } from "node:dns/promises";
import { readFileSync } from "node:fs";
import http from "node:http";
import https from "node:https";

const SITE_URL = process.env.SEO_SITE_URL || "https://lbsailab.com";
const SITE = new URL(SITE_URL);
const SITE_ORIGIN = SITE.origin;
const SITE_HOST = SITE.host;
const GOOGLE_SITE_VERIFICATION_FILE = (
  process.env.GOOGLE_SITE_VERIFICATION_FILE || ""
).trim();
const REDIRECTS_FILE = new URL("../public/_redirects", import.meta.url);
const BING_SITE_VERIFICATION_TOKEN = (
  process.env.BING_SITE_VERIFICATION_TOKEN || ""
).trim();
const INDEXABLE_ROBOTS =
  "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";
const INDEXABLE_META_ROBOTS =
  "index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1";
const NOINDEX_ROBOTS = "noindex, nofollow";
const EXPECTED_LAST_MODIFIED = "Tue, 16 Jun 2026 00:00:00 GMT";
const EXPECTED_DATE_MODIFIED = "2026-06-16";
const EXPECTED_UPDATED_TIME = "2026-06-16T00:00:00.000Z";
const EXPECTED_CONTENT_LANGUAGE = "en-GB";
const EXPECTED_VIEWPORT = "width=device-width, initial-scale=1";
const EXPECTED_ORGANIZATION_TOPICS = [
  "AI product development",
  "AI-assisted application development",
  "London Business School workflows",
  "Product prototyping",
  "Applied AI education",
];
const EXPECTED_SITE_NAVIGATION_URLS = [
  `${SITE_ORIGIN}/about/`,
  `${SITE_ORIGIN}/batches/`,
  `${SITE_ORIGIN}/batches/spring-2026/`,
  `${SITE_ORIGIN}/mentors/`,
  `${SITE_ORIGIN}/apply/`,
  `${SITE_ORIGIN}/contact/`,
  `${SITE_ORIGIN}/sitemap/`,
];
const JSON_LD_URL_FIELDS = new Set([
  "@id",
  "url",
  "sameAs",
  "image",
  "logo",
  "item",
  "contentUrl",
  "embedUrl",
  "thumbnailUrl",
]);
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
    sha256: "85449457abbe6abac5b4a9c6cc0ba44926c3de01f9db9ac6515350e61be32cd2",
  },
  {
    src: "/favicon/favicon-32x32.png",
    sizes: "32x32",
    type: "image/png",
    width: 32,
    height: 32,
    sha256: "d71dbc6a6e50209120993d8d6ec47cd4605c86c607943692bcd0ebcab3831fb8",
  },
  {
    src: "/favicon/apple-touch-icon.png",
    sizes: "180x180",
    type: "image/png",
    width: 180,
    height: 180,
    sha256: "e0edbe3fcc3aa5cbdee6a0c659d4303449bcfb9d91cd720d3be5e76771f5ab06",
  },
  {
    src: "/favicon/icon-192.png",
    sizes: "192x192",
    type: "image/png",
    width: 192,
    height: 192,
    sha256: "51b5422036d968e4bc773c697d1a9c4724b741ae0a582ad6181c9f009fa71ba3",
  },
  {
    src: "/favicon/icon-512.png",
    sizes: "512x512",
    type: "image/png",
    width: 512,
    height: 512,
    sha256: "e1cec157004f66f08e6439a98ca5e0354620f6ed00c0a55baf4d15954d1312cb",
  },
];
const REQUIRED_FAVICON_ASSETS = [
  ...REQUIRED_MANIFEST_ICONS,
  {
    src: "/favicon.ico",
    sha256: "9f52cbf0b9573e3bb4f23ea869dbd1b17b4a616861ad3c99d75c3706a00eb204",
  },
  {
    src: "/favicon/favicon.ico",
    sha256: "9f52cbf0b9573e3bb4f23ea869dbd1b17b4a616861ad3c99d75c3706a00eb204",
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
const MAX_DOM_ELEMENTS = 500;
const MAX_DOM_DEPTH = 18;
const VOID_HTML_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);
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

function extractLastmods(xml) {
  return [...xml.matchAll(/<lastmod>(.*?)<\/lastmod>/g)].map((match) =>
    decodeHtml(match[1].trim()),
  );
}

function extractFeedEntries(xml) {
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map(
    (match, index) => {
      const entry = match[1];
      const link =
        entry.match(/<link\b[^>]*\bhref=(["'])(.*?)\1[^>]*\/?>/i)?.[2] || "";
      const id = entry.match(/<id>([\s\S]*?)<\/id>/i)?.[1] || "";
      const title = entry.match(/<title>([\s\S]*?)<\/title>/i)?.[1] || "";
      const updated = entry.match(/<updated>([\s\S]*?)<\/updated>/i)?.[1] || "";

      return {
        id: decodeHtml(id.trim()),
        index: index + 1,
        link: decodeHtml(link.trim()),
        title: decodeHtml(title.trim()),
        updated: decodeHtml(updated.trim()),
      };
    },
  );
}

function auditFeedCanonicalEntries(feed, pages, label) {
  const entries = extractFeedEntries(feed);
  const sitemapPages = new Set(pages);
  const expectedFeedPages = pages.filter(
    (page) => new URL(page).pathname !== "/sitemap/",
  );
  const seen = new Set();

  if (!entries.length) {
    fail(`${label}: has no Atom entries`);
    return;
  }

  for (const entry of entries) {
    if (!entry.link) {
      fail(`${label}: entry ${entry.index} is missing link href`);
      continue;
    }

    let entryUrl;

    try {
      entryUrl = new URL(entry.link);
    } catch {
      fail(`${label}: entry ${entry.index} has invalid URL ${entry.link}`);
      continue;
    }

    const canonicalEntryUrl = entryUrl.toString();

    if (entryUrl.origin !== SITE_ORIGIN) {
      fail(`${label}: entry ${entry.index} is not on canonical origin`);
    }

    if (entryUrl.search || entryUrl.hash) {
      fail(`${label}: entry ${entry.index} includes search or hash`);
    }

    if (entryUrl.pathname !== "/" && !entryUrl.pathname.endsWith("/")) {
      fail(`${label}: entry ${entry.index} is missing trailing slash`);
    }

    if (entryUrl.pathname !== entryUrl.pathname.toLowerCase()) {
      fail(`${label}: entry ${entry.index} is not lowercase`);
    }

    if (/\/(?:cohorts?|teams)(?:\/|$)/i.test(entryUrl.pathname)) {
      fail(`${label}: entry ${entry.index} references a legacy URL`);
    }

    if (!sitemapPages.has(canonicalEntryUrl)) {
      fail(`${label}: entry ${canonicalEntryUrl} is not in the sitemap`);
    }

    if (seen.has(canonicalEntryUrl)) {
      fail(`${label}: duplicates entry ${canonicalEntryUrl}`);
    }

    seen.add(canonicalEntryUrl);

    if (entry.id !== canonicalEntryUrl) {
      fail(`${label}: entry ${canonicalEntryUrl} id does not match link`);
    }

    if (!entry.title) {
      fail(`${label}: entry ${canonicalEntryUrl} is missing title`);
    }

    if (!entry.updated || Number.isNaN(Date.parse(entry.updated))) {
      fail(
        `${label}: entry ${canonicalEntryUrl} has invalid updated timestamp`,
      );
    }
  }

  for (const expectedUrl of expectedFeedPages) {
    if (!seen.has(expectedUrl)) {
      fail(`${label}: missing canonical page entry ${expectedUrl}`);
    }
  }
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

function domStats(html) {
  const sanitizedHtml = htmlWithoutRawTextBlocks(html);
  let elements = 0;
  let depth = 0;
  let maxDepth = 0;

  for (const match of sanitizedHtml.matchAll(/<\/?([a-z][\w:-]*)\b[^>]*>/gi)) {
    const tag = match[0];
    const tagName = match[1].toLowerCase();

    if (tag.startsWith("</")) {
      depth = Math.max(0, depth - 1);
      continue;
    }

    elements += 1;

    if (VOID_HTML_ELEMENTS.has(tagName) || /\/\s*>$/.test(tag)) {
      continue;
    }

    depth += 1;
    maxDepth = Math.max(maxDepth, depth);
  }

  return { elements, maxDepth };
}

function auditDomBudget(html, url) {
  const { elements, maxDepth } = domStats(html);

  if (elements > MAX_DOM_ELEMENTS) {
    fail(`${url}: DOM has ${elements} elements, exceeding ${MAX_DOM_ELEMENTS}`);
  }

  if (maxDepth > MAX_DOM_DEPTH) {
    fail(
      `${url}: DOM nesting depth is ${maxDepth}, exceeding ${MAX_DOM_DEPTH}`,
    );
  }
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

    if (target.origin !== SITE_ORIGIN || !target.hash) return null;

    const fragment = decodeFragmentId(target.hash);
    target.hash = "";

    return fragment ? { fragment, url: target.toString() } : null;
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

function auditCanonicalInternalPageHref(href, sourceUrl) {
  if (
    !href ||
    href.startsWith("#") ||
    href.startsWith("mailto:") ||
    href.startsWith("tel:")
  ) {
    return;
  }

  const normalized = normalizeUrl(href, sourceUrl);

  if (!normalized) {
    fail(`${sourceUrl}: internal page link is not a valid URL (${href})`);
    return;
  }

  if (!sameOrigin(normalized)) return;

  const parsed = new URL(normalized);

  if (parsed.pathname.startsWith("/api/")) return;
  if (parsed.pathname === "/healthz") return;

  const lastSegment = parsed.pathname.split("/").at(-1) || "";
  if (lastSegment.includes(".")) return;

  if (parsed.search) {
    fail(`${sourceUrl}: internal page link has query parameters (${href})`);
  }

  if (parsed.pathname !== parsed.pathname.toLowerCase()) {
    fail(`${sourceUrl}: internal page link is not lowercase (${href})`);
  }

  if (!parsed.pathname.endsWith("/")) {
    fail(
      `${sourceUrl}: internal page link is missing trailing slash (${href})`,
    );
  }
}

function isLongCachePath(pathname) {
  return LONG_CACHE_PATHS.some((pattern) => pattern.test(pathname));
}

function isAllowedExternalScript(url) {
  return ALLOWED_EXTERNAL_SCRIPT_PATTERNS.some((pattern) => pattern.test(url));
}

function isCloudflareInsightsScript(url) {
  return /^https:\/\/static\.cloudflareinsights\.com\/beacon\.min\.js(?:\/|$)/.test(
    url,
  );
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

function assertIndexableRobotsHeader(response, url) {
  const robots = response.headers.get("x-robots-tag") || "";

  if (robots !== INDEXABLE_ROBOTS) {
    fail(
      `${url}: X-Robots-Tag expected "${INDEXABLE_ROBOTS}", got "${robots || "(missing)"}"`,
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

function auditRobotsBehavior(robots, url) {
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
      fail(`${url}: blocks crawlable path ${pathname}`);
    }
  }

  for (const pathname of disallowedPaths) {
    if (isRobotsAllowed(robots, pathname)) {
      fail(`${url}: allows private or non-indexable path ${pathname}`);
    }
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

  auditRobotsBehavior(body, url);

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

  const indexLocs = extractLocs(index);
  const indexLastmods = extractLastmods(index);

  if (indexLastmods.length !== indexLocs.length) {
    fail(`${indexUrl}: expected one lastmod per sitemap URL`);
  }

  for (const lastmod of indexLastmods) {
    if (lastmod !== EXPECTED_UPDATED_TIME) {
      fail(`${indexUrl}: unexpected lastmod ${lastmod}`);
    }
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
  const imageContentType = imageResponse.headers.get("content-type") || "";

  if (imageResponse.status !== 200) {
    fail(`${imageSitemapUrl}: expected 200, got ${imageResponse.status}`);
  }

  assertSecurityHeaders(imageResponse, imageSitemapUrl);
  assertIndexableHeaders(imageResponse, imageSitemapUrl);
  assertShortCache(imageResponse, imageSitemapUrl);

  if (!imageContentType.includes("application/xml")) {
    fail(
      `${imageSitemapUrl}: expected XML content type, got "${imageContentType}"`,
    );
  }

  const imageUrls = extractImageLocs(imageSitemap);
  const imagePageUrls = extractLocs(imageSitemap);
  const imageLastmods = extractLastmods(imageSitemap);

  if (!imagePageUrls.length) {
    fail(`${imageSitemapUrl}: missing page URLs`);
  }

  if (!imageUrls.length) {
    fail(`${imageSitemapUrl}: missing image URLs`);
  }

  if (imageLastmods.length !== imagePageUrls.length) {
    fail(`${imageSitemapUrl}: expected one lastmod per page URL`);
  }

  for (const lastmod of imageLastmods) {
    if (lastmod !== EXPECTED_UPDATED_TIME) {
      fail(`${imageSitemapUrl}: unexpected lastmod ${lastmod}`);
    }
  }

  for (const imagePageUrl of imagePageUrls) {
    if (!isCanonicalPageUrl(imagePageUrl)) {
      fail(`${imageSitemapUrl}: non-canonical page URL ${imagePageUrl}`);
    }
  }

  for (const imageUrl of imageUrls) {
    if (!sameOrigin(imageUrl)) {
      fail(`${imageSitemapUrl}: non-canonical image URL ${imageUrl}`);
    }
  }

  return { imageUrls, pages };
}

async function auditFeed(pages) {
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

  auditFeedCanonicalEntries(body, pages, url);
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

    auditCanonicalInternalPageHref(href, pageUrl);

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
  if (metaContent(html, "viewport") !== EXPECTED_VIEWPORT) {
    fail(`${url}: viewport meta should be "${EXPECTED_VIEWPORT}"`);
  }
  if (metaContent(html, "robots") !== INDEXABLE_META_ROBOTS) {
    fail(`${url}: meta robots is missing indexable preview directives`);
  }

  if (!/<html\b[^>]*\blang=["']en-GB["']/i.test(html)) {
    fail(`${url}: html lang should be en-GB`);
  }

  if (
    manifestLinks.length !== 1 ||
    manifestLinks[0].href !== "/site.webmanifest"
  ) {
    fail(`${url}: missing canonical web app manifest link`);
  }

  if (iconLinks.some((link) => link.href === "/favicon.svg")) {
    fail(`${url}: stale SVG favicon link should not be advertised`);
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
    "connectionType",
    "navigationType",
    "saveData",
    "viewport",
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
      if (isCloudflareInsightsScript(normalized)) continue;

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

function jsonLdTypeLabel(value) {
  if (Array.isArray(value)) return value.join(",");
  return value || "unknown";
}

function collectJsonLdUrlValues(value, sourcePath = [], values = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectJsonLdUrlValues(item, [...sourcePath, String(index)], values),
    );
    return values;
  }

  if (!value || typeof value !== "object") return values;

  for (const [key, child] of Object.entries(value)) {
    const childPath = [...sourcePath, key];

    if (JSON_LD_URL_FIELDS.has(key) && typeof child === "string") {
      values.push({ path: childPath.join("."), value: child });
      continue;
    }

    if (JSON_LD_URL_FIELDS.has(key) && Array.isArray(child)) {
      child.forEach((item, index) => {
        if (typeof item === "string") {
          values.push({
            path: [...childPath, String(index)].join("."),
            value: item,
          });
        } else {
          collectJsonLdUrlValues(item, [...childPath, String(index)], values);
        }
      });
      continue;
    }

    collectJsonLdUrlValues(child, childPath, values);
  }

  return values;
}

function collectJsonLdDeclaredIds(value, sourcePath = [], ids = []) {
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      collectJsonLdDeclaredIds(item, [...sourcePath, String(index)], ids),
    );
    return ids;
  }

  if (!value || typeof value !== "object") return ids;

  if (typeof value["@id"] === "string" && value["@type"]) {
    ids.push({
      id: value["@id"],
      path: sourcePath.join(".") || "$",
      type: jsonLdTypeLabel(value["@type"]),
    });
  }

  for (const [key, child] of Object.entries(value)) {
    collectJsonLdDeclaredIds(child, [...sourcePath, key], ids);
  }

  return ids;
}

function auditJsonLdGraphHygiene(url, items, sitemapPages) {
  const declaredIds = new Map();

  for (const node of collectJsonLdDeclaredIds(items)) {
    const key = `${node.id}::${node.type}`;
    const existing = declaredIds.get(key);

    if (existing) {
      fail(
        `${url}: duplicate JSON-LD @id ${node.id} for ${node.type} at ${existing} and ${node.path}`,
      );
    } else {
      declaredIds.set(key, node.path);
    }
  }

  for (const { path, value } of collectJsonLdUrlValues(items)) {
    let parsed;

    try {
      parsed = new URL(value);
    } catch {
      fail(`${url}: JSON-LD ${path} is not a valid absolute URL`);
      continue;
    }

    if (parsed.protocol !== "https:") {
      fail(`${url}: JSON-LD ${path} is not HTTPS (${value})`);
    }

    if (parsed.host === `www.${SITE_HOST}`) {
      fail(`${url}: JSON-LD ${path} uses non-canonical www domain`);
    }

    if (parsed.origin !== SITE_ORIGIN) continue;

    if (parsed.search) {
      fail(`${url}: JSON-LD ${path} includes URL parameters`);
    }

    if (parsed.pathname !== parsed.pathname.toLowerCase()) {
      fail(`${url}: JSON-LD ${path} path is not lowercase`);
    }

    if (/\/(?:cohorts?|teams)(?:\/|$)/i.test(parsed.pathname)) {
      fail(`${url}: JSON-LD ${path} references a legacy URL`);
    }

    if (parsed.pathname === "/" || parsed.pathname.endsWith("/")) {
      const pageUrl = `${parsed.origin}${parsed.pathname}`;

      if (!sitemapPages.has(pageUrl)) {
        fail(`${url}: JSON-LD ${path} page URL is not in the sitemap`);
      }
    }
  }
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

  if (webPage.publisher?.["@id"] !== `${SITE_ORIGIN}/#organization`) {
    fail(`${url}: WebPage missing publisher organization`);
  }

  if (webPage.copyrightHolder?.["@id"] !== `${SITE_ORIGIN}/#organization`) {
    fail(`${url}: WebPage missing copyright holder organization`);
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

    if (!itemList["@id"]?.startsWith(url)) {
      fail(`${url}: ItemList JSON-LD missing stable page-scoped @id`);
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

function auditSiteIdentityJsonLd(url, items) {
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
    if (website.name !== "LBS AI Lab") {
      fail(`${url}: WebSite JSON-LD has wrong name`);
    }

    if (website.url !== `${SITE_ORIGIN}/`) {
      fail(`${url}: WebSite JSON-LD has wrong URL`);
    }

    if (website.inLanguage !== "en-GB") {
      fail(`${url}: WebSite JSON-LD should use en-GB`);
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

function auditHomeNavigationJsonLd(url, items) {
  if (url !== `${SITE_ORIGIN}/`) return;

  const navigation = items.find(
    (item) =>
      isJsonLdType(item, "SiteNavigationElement") &&
      item?.["@id"] === `${SITE_ORIGIN}/#site-navigation`,
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

  auditJsonLdGraphHygiene(url, items, sitemapPages);
  auditWebPageJsonLd(url, html, items);
  auditBreadcrumbJsonLd(url, items);
  auditItemListJsonLd(url, items, sitemapPages);
  auditSiteIdentityJsonLd(url, items);
  auditHomeNavigationJsonLd(url, items);
  auditPartnerJsonLd(url, items);
  auditMentorJsonLd(url, items);
  auditTeamJsonLd(url, html, items);
}

function auditScriptHygiene(html, pageUrl) {
  for (const tag of allTags(html, "script")) {
    const script = attrs(tag);
    const src = script.src ? normalizeUrl(script.src, pageUrl) : "";

    if (!src) continue;

    if (!isCloudflareInsightsScript(src) && !isNonBlockingScript(script)) {
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

async function auditPage(
  url,
  sitemapPages,
  inbound,
  assetUrls,
  socialImages,
  pageBodies,
) {
  const { response, body } = await text(url, { accept: "text/html" });
  const contentType = response.headers.get("content-type") || "";

  pageBodies.set(url, body);

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
  auditDomBudget(body, url);
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
  assertIndexableRobotsHeader(response, url);

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
    const sha256 = createHash("sha256").update(resource.body).digest("hex");

    if (sha256 !== expected.sha256) {
      fail(`${iconUrl}: favicon does not match London Business School asset`);
    }

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

  for (const expected of REQUIRED_FAVICON_ASSETS) {
    const iconUrl = new URL(expected.src, SITE_ORIGIN).toString();
    const resource = await auditImageResource(iconUrl);

    if (!resource) continue;

    const sha256 = createHash("sha256").update(resource.body).digest("hex");

    if (sha256 !== expected.sha256) {
      fail(`${iconUrl}: favicon does not match London Business School asset`);
    }
  }

  const staleSvgUrl = `${SITE_ORIGIN}/favicon.svg`;
  const staleSvg = await get(staleSvgUrl, { accept: "image/svg+xml" });

  if (staleSvg.status !== 404) {
    fail(`${staleSvgUrl}: stale SVG favicon should not be served`);
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

  for (const { source, target } of manifestRedirects()) {
    await auditRedirectTarget(source, target);
  }
}

function manifestRedirects() {
  const redirects = [];
  const manifest = readFileSync(REDIRECTS_FILE, "utf8");

  for (const [index, rawLine] of manifest.split(/\r?\n/).entries()) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) continue;

    const [source, target, status = "301"] = line.split(/\s+/);

    if (!source || !target) {
      fail(`public/_redirects line ${index + 1}: missing source or target`);
      continue;
    }

    if (status !== "301") {
      fail(`public/_redirects line ${index + 1}: expected 301, got ${status}`);
      continue;
    }

    if (source.includes(":") || target.includes(":")) continue;

    redirects.push({
      source: new URL(source, SITE_ORIGIN).toString(),
      target: new URL(target, SITE_ORIGIN).toString(),
    });
  }

  return redirects;
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

async function auditDuplicateOriginRedirects(pages) {
  for (const origin of DUPLICATE_ORIGINS) {
    for (const page of pages) {
      const canonical = new URL(page);
      const duplicate = new URL(origin);

      duplicate.pathname = canonical.pathname;
      duplicate.search = canonical.search;
      duplicate.hash = canonical.hash;

      await auditRedirectTarget(duplicate.toString(), page);
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
      connectionType: "4g",
      metrics: [
        { name: "TTFB", value: 120 },
        { name: "FCP", value: 700 },
        { name: "LCP", value: 1200 },
        { name: "CLS", value: 0.01 },
        { name: "INP", value: 80 },
      ],
      navigationType: "navigate",
      path: "/seo-audit",
      saveData: false,
      viewport: "desktop",
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

  if (metaContent(body, "viewport") !== EXPECTED_VIEWPORT) {
    fail(`${url}: 404 body has an incomplete viewport meta tag`);
  }

  if (!body.includes("<h1>Page not found</h1>")) {
    fail(`${url}: 404 body should render the custom not-found document`);
  }

  if (!/<html\b[^>]*\blang=["']en-GB["']/i.test(body)) {
    fail(`${url}: 404 body html lang should be en-GB`);
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

async function auditMissingFileResources() {
  for (const path of [
    "/missing-seo-audit-file.css",
    "/missing-seo-audit-script.js",
    "/images/missing-seo-audit-image.webp",
  ]) {
    const url = `${SITE_ORIGIN}${path}`;
    const { response, body } = await text(url);

    if (response.status !== 404) {
      fail(
        `${url}: expected missing file resource 404, got ${response.status}`,
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
      fail(`${url}: missing file resource contains indexable page metadata`);
    }

    if (body.includes("<h1>Page not found</h1>")) {
      fail(`${url}: missing file resource should not render custom page body`);
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

    if (metaContent(body, "viewport") !== EXPECTED_VIEWPORT) {
      fail(`${url}: direct error document has an incomplete viewport meta tag`);
    }

    if (!/<html\b[^>]*\blang=["']en-GB["']/i.test(body)) {
      fail(`${url}: direct error document html lang should be en-GB`);
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

  if ((response.headers.get("content-language") || "") !== "en-GB") {
    fail(`${url}: expected en-GB Content-Language`);
  }

  for (const expected of [
    `Contact: ${SITE_ORIGIN}/contact/`,
    "Expires: 2027-06-16T00:00:00.000Z",
    "Preferred-Languages: en",
    `Canonical: ${SITE_ORIGIN}/.well-known/security.txt`,
    `Policy: ${SITE_ORIGIN}/contact/`,
  ]) {
    if (!body.includes(expected)) fail(`${url}: missing ${expected}`);
  }

  if (/\bmailto:|[a-z0-9._%+-]+@london\.edu\b/i.test(body)) {
    fail(`${url}: should use the contact page instead of exposing email`);
  }
}

async function auditSearchVerificationFiles() {
  if (GOOGLE_SITE_VERIFICATION_FILE) {
    if (!/^google[a-z0-9_-]+\.html$/i.test(GOOGLE_SITE_VERIFICATION_FILE)) {
      fail(
        "GOOGLE_SITE_VERIFICATION_FILE should be a Google verification HTML filename",
      );
    } else {
      const url = `${SITE_ORIGIN}/${GOOGLE_SITE_VERIFICATION_FILE}`;
      const { response, body } = await text(url, { accept: "text/plain" });

      if (response.status !== 200) {
        fail(`${url}: expected 200, got ${response.status}`);
      }

      assertSecurityHeaders(response, url);
      assertShortCache(response, url);

      if ((response.headers.get("x-robots-tag") || "") !== NOINDEX_ROBOTS) {
        fail(`${url}: expected ${NOINDEX_ROBOTS} X-Robots-Tag`);
      }

      if (
        body.trim() !==
        `google-site-verification: ${GOOGLE_SITE_VERIFICATION_FILE}`
      ) {
        fail(`${url}: unexpected Google verification body`);
      }
    }
  }

  if (BING_SITE_VERIFICATION_TOKEN) {
    if (!/^[a-z0-9_-]{8,160}$/i.test(BING_SITE_VERIFICATION_TOKEN)) {
      fail("BING_SITE_VERIFICATION_TOKEN has an unexpected format");
    } else {
      const url = `${SITE_ORIGIN}/BingSiteAuth.xml`;
      const { response, body } = await text(url, { accept: "application/xml" });
      const contentType = response.headers.get("content-type") || "";

      if (response.status !== 200) {
        fail(`${url}: expected 200, got ${response.status}`);
      }

      assertSecurityHeaders(response, url);
      assertShortCache(response, url);

      if ((response.headers.get("x-robots-tag") || "") !== NOINDEX_ROBOTS) {
        fail(`${url}: expected ${NOINDEX_ROBOTS} X-Robots-Tag`);
      }

      if (!contentType.includes("application/xml")) {
        fail(`${url}: expected XML content type, got "${contentType}"`);
      }

      if (!body.includes(`<user>${BING_SITE_VERIFICATION_TOKEN}</user>`)) {
        fail(`${url}: missing Bing verification token`);
      }
    }
  }
}

function auditFragmentTargets(pageBodies, sitemapPages) {
  for (const [sourceUrl, html] of pageBodies) {
    for (const tag of allTags(html, "a")) {
      const href = attrs(tag).href || "";
      const reference = fragmentReference(href, sourceUrl);

      if (!reference) continue;

      if (!sitemapPages.has(reference.url)) {
        fail(`${sourceUrl}: fragment link points outside sitemap ${href}`);
        continue;
      }

      const targetHtml = pageBodies.get(reference.url);

      if (!targetHtml) {
        fail(`${sourceUrl}: fragment link target page was not audited ${href}`);
        continue;
      }

      if (!fragmentTargets(targetHtml).has(reference.fragment)) {
        fail(`${sourceUrl}: fragment link ${href} has no target`);
      }
    }
  }
}

async function auditReachability(pages) {
  const sitemapPages = new Set(pages);
  const inbound = new Map(pages.map((page) => [page, new Set()]));
  const assetUrls = new Set();
  const pageBodies = new Map();
  const socialImages = new Set();

  for (const page of pages) {
    await auditPage(
      page,
      sitemapPages,
      inbound,
      assetUrls,
      socialImages,
      pageBodies,
    );
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

  auditFragmentTargets(pageBodies, sitemapPages);
  await auditAssets(assetUrls);
  await auditSocialImages(socialImages);
  await auditExternalLinks(inbound);
}

async function auditLiveSeo() {
  await auditRobots();
  const { imageUrls, pages } = await auditSitemaps();
  await auditFeed(pages);
  await auditDiscoveryFiles(pages);
  await auditImageSitemapAssets(imageUrls);
  await auditWebManifest();
  await auditSecurityText();
  await auditRedirects();
  await auditCanonicalDuplicateRedirects(pages);
  await auditDuplicateOriginRedirects(pages);
  await auditNoindexAndGone();
  await auditMissingPage();
  await auditMissingFileResources();
  await auditErrorDocumentDirect();
  await auditSearchVerificationFiles();
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
