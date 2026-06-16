import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const SITE_ORIGIN = "https://lbsailab.com";
const SITE_HOST = new URL(SITE_ORIGIN).host;

const ALLOWED_EXTERNAL_LINK_HOSTS = new Set([
  "briefd.lbsailab.com",
  "compass.lbsailab.com",
  "deepmind.google",
  "funded.lbsailab.com",
  "lbsailab.com",
  "londoneatspal.lbsailab.com",
  "recruitsmart.lbsailab.com",
  "wayfinder.lbsailab.com",
  "www.emsplusplus.com",
  "www.linkedin.com",
  "www.london.edu",
  "zentra.lbsailab.com",
]);

const ALLOWED_EXTERNAL_RESOURCE_HOSTS = new Set([SITE_HOST]);

const FORBIDDEN_TAGS = ["iframe", "object", "embed", "applet", "base"];
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

const failures = [];

function fail(message) {
  failures.push(message);
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

function pageUrlForFile(file) {
  const relative = path.relative(DIST, file);

  if (relative === "index.html") return `${SITE_ORIGIN}/`;
  if (relative === "404.html") return `${SITE_ORIGIN}/404.html`;
  if (!relative.endsWith(`${path.sep}index.html`)) return null;

  const pathname = relative
    .slice(0, -"/index.html".length)
    .split(path.sep)
    .join("/");

  return `${SITE_ORIGIN}/${pathname}/`;
}

function allTags(html, tagName = "[a-z][\\w:-]*") {
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

function openingTag(tag) {
  return tag.match(/^<[^>]+>/i)?.[0] || tag;
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

function normalizeUrl(value, pageUrl) {
  const decoded = decodeHtml(value).trim();

  if (!decoded || decoded.startsWith("#")) return null;

  try {
    return new URL(decoded, pageUrl);
  } catch {
    return null;
  }
}

function isDangerousDataUrl(value) {
  return /^data\s*:\s*(?:text\/html|application\/javascript|text\/javascript)/i.test(
    value,
  );
}

function isExternal(url) {
  return url.protocol === "http:" || url.protocol === "https:"
    ? url.host !== SITE_HOST
    : false;
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

function auditInlineScript(script, pageUrl) {
  const type = attrs(openingTag(script)).type || "";

  if (/^(application|text)\/ld\+json$/i.test(type)) return;

  const body = script
    .replace(/^<script\b[^>]*>/i, "")
    .replace(/<\/script>$/i, "");

  const unsafePatterns = [
    { label: "eval()", pattern: /\beval\s*\(/ },
    { label: "new Function()", pattern: /\bnew\s+Function\s*\(/ },
    { label: "document.write()", pattern: /\bdocument\.write\s*\(/ },
    { label: "string setTimeout()", pattern: /\bsetTimeout\s*\(\s*["'`]/ },
    { label: "string setInterval()", pattern: /\bsetInterval\s*\(\s*["'`]/ },
  ];

  for (const { label, pattern } of unsafePatterns) {
    if (pattern.test(body)) {
      fail(`${pageUrl}: inline script uses ${label}`);
    }
  }
}

function auditUrlAttribute({
  attribute,
  rawValue,
  pageUrl,
  tagName,
  resourceContext,
}) {
  const value = decodeHtml(rawValue).trim();

  if (!value || value.startsWith("#")) return;
  if (/^(mailto|tel):/i.test(value)) return;

  if (/^javascript\s*:/i.test(value)) {
    fail(`${pageUrl}: ${tagName} ${attribute} uses javascript:`);
    return;
  }

  if (isDangerousDataUrl(value)) {
    fail(`${pageUrl}: ${tagName} ${attribute} uses executable data URL`);
    return;
  }

  const url = normalizeUrl(value, pageUrl);

  if (!url) {
    fail(`${pageUrl}: ${tagName} ${attribute} is not a valid URL`);
    return;
  }

  if (url.protocol === "http:") {
    fail(`${pageUrl}: ${tagName} ${attribute} uses insecure HTTP URL`);
  }

  if (!isExternal(url)) return;

  const allowedHosts = resourceContext
    ? ALLOWED_EXTERNAL_RESOURCE_HOSTS
    : ALLOWED_EXTERNAL_LINK_HOSTS;

  if (!allowedHosts.has(url.host)) {
    fail(
      `${pageUrl}: ${tagName} ${attribute} points to unexpected external host ${url.host}`,
    );
  }
}

function auditHtml(html, pageUrl) {
  for (const tagName of FORBIDDEN_TAGS) {
    if (new RegExp(`<${tagName}\\b`, "i").test(html)) {
      fail(`${pageUrl}: contains forbidden <${tagName}> tag`);
    }
  }

  if (/<meta\b[^>]*http-equiv\s*=\s*["']?refresh\b/i.test(html)) {
    fail(`${pageUrl}: contains meta refresh`);
  }

  for (const tag of allTags(html)) {
    const tagName = tag.match(/^<([^\s>/]+)/i)?.[1]?.toLowerCase() || "tag";
    const attributes = attrs(tag);

    for (const attribute of Object.keys(attributes)) {
      if (/^on[a-z]+$/i.test(attribute)) {
        fail(`${pageUrl}: ${tagName} has inline event handler ${attribute}`);
      }
    }

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

    for (const attribute of LINK_ATTRIBUTES) {
      if (attribute in attributes) {
        auditUrlAttribute({
          attribute,
          rawValue: attributes[attribute],
          pageUrl,
          tagName,
          resourceContext,
        });
      }
    }
  }

  for (const tag of fullTags(html, "script")) {
    const attributes = attrs(openingTag(tag));

    if (attributes.src) continue;
    auditInlineScript(tag, pageUrl);
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

function auditStaticTextFile(file) {
  const relative = path.relative(DIST, file).split(path.sep).join("/");
  const text = readFileSync(file, "utf8");

  for (const match of text.matchAll(/\bhttp:\/\/[^\s"'<>]+/gi)) {
    const url = new URL(match[0]);

    if (
      !["www.google.com", "www.sitemaps.org", "www.w3.org"].includes(url.host)
    ) {
      fail(`dist/${relative}: contains insecure HTTP URL ${url.href}`);
    }
  }

  for (const pattern of SPAM_PATTERNS) {
    if (pattern.test(text)) {
      fail(`dist/${relative}: text matches spam pattern ${pattern}`);
    }
  }
}

if (!existsSync(DIST)) {
  fail("Missing dist directory. Run npm run build first.");
} else {
  const files = distFiles();
  const htmlFiles = files.filter((file) => file.endsWith(".html"));
  const textFiles = files.filter((file) => /\.(xml|txt)$/i.test(file));

  for (const file of htmlFiles) {
    const pageUrl = pageUrlForFile(file) || `dist/${path.relative(DIST, file)}`;
    auditHtml(readFileSync(file, "utf8"), pageUrl);
  }

  for (const file of textFiles) {
    auditStaticTextFile(file);
  }

  if (failures.length === 0) {
    console.log(
      `Content integrity audit passed for ${htmlFiles.length} generated HTML pages and ${textFiles.length} text artifacts.`,
    );
  }
}

if (failures.length > 0) {
  console.error("Content integrity audit failed:");

  for (const failure of failures) {
    console.error(`- ${failure}`);
  }

  process.exit(1);
}
