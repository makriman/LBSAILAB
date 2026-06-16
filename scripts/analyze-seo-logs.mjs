import { readFileSync } from "node:fs";

const PUBLIC_PATH_PATTERNS = [
  /^\/$/,
  /^\/about\/$/,
  /^\/apply\/$/,
  /^\/batches\/$/,
  /^\/batches\/spring-2026\/$/,
  /^\/batches\/spring-2026\/[^/]+\/$/,
  /^\/contact\/$/,
  /^\/feed\.xml$/,
  /^\/image-sitemap\.xml$/,
  /^\/llms(?:-full)?\.txt$/,
  /^\/mentors\/$/,
  /^\/robots\.txt$/,
  /^\/sitemap\/$/,
  /^\/sitemap-index\.xml$/,
  /^\/sitemap-\d+\.xml$/,
];
const EXPECTED_INDEXABLE_ROBOTS =
  "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";
const EXPECTED_NOINDEX_ROBOTS = "noindex, nofollow";
const SEVERE_VITAL_LIMITS = {
  CLS: 0.25,
  FCP: 3000,
  INP: 500,
  LCP: 4000,
  TTFB: 1800,
};
const NEEDS_IMPROVEMENT_VITAL_LIMITS = {
  CLS: 0.1,
  FCP: 1800,
  INP: 200,
  LCP: 2500,
  TTFB: 800,
};

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function readInput() {
  const [filePath] = process.argv.slice(2).filter((arg) => arg !== "--json");

  if (filePath) return readFileSync(filePath, "utf8");

  try {
    return readFileSync(0, "utf8");
  } catch {
    return "";
  }
}

function parseJsonFromLine(line) {
  const trimmed = line.trim();

  if (!trimmed) return [];

  for (const candidate of [trimmed, extractJsonObject(trimmed)]) {
    if (!candidate) continue;

    try {
      return flattenLogItem(JSON.parse(candidate));
    } catch {
      // Try the next candidate.
    }
  }

  return [];
}

function extractJsonObject(value) {
  const first = value.indexOf("{");
  const last = value.lastIndexOf("}");

  if (first === -1 || last === -1 || last <= first) return "";

  return value.slice(first, last + 1);
}

function flattenLogItem(item) {
  const logs = [];

  if (isSeoLog(item)) logs.push(item);

  if (Array.isArray(item?.logs)) {
    for (const log of item.logs) {
      logs.push(...flattenLogItem(log));
    }
  }

  if (Array.isArray(item?.message)) {
    for (const message of item.message) {
      if (typeof message === "string") {
        logs.push(...parseJsonFromLine(message));
      } else {
        logs.push(...flattenLogItem(message));
      }
    }
  }

  if (typeof item?.message === "string") {
    logs.push(...parseJsonFromLine(item.message));
  }

  return logs;
}

function isSeoLog(item) {
  return item?.type === "seo-access" || item?.type === "web-vitals";
}

function statusBucket(status) {
  if (!Number.isFinite(status)) return "unknown";
  return `${Math.trunc(status / 100)}xx`;
}

function isPublicPath(path) {
  return PUBLIC_PATH_PATTERNS.some((pattern) => pattern.test(path));
}

function isNoindexPath(path) {
  return /^\/(?:api|admin|cart|checkout|healthz|internal|login|private|search)(?:\/|$)/.test(
    path,
  );
}

function canonicalPathIssue(path) {
  if (!path || !path.startsWith("/")) return "path is missing or invalid";
  if (path !== "/" && /[A-Z]/.test(path)) return "path is not lowercase";
  if (path !== "/" && !path.includes(".") && !path.endsWith("/")) {
    return "path is missing a trailing slash";
  }

  return "";
}

function analyzeSeoAccess(log, summary) {
  const status = Number(log.status);
  const path = typeof log.path === "string" ? log.path : "/";
  const crawler = typeof log.crawler === "string" ? log.crawler : "Unknown";
  const robots = typeof log.robots === "string" ? log.robots : "";
  const cacheControl =
    typeof log.cacheControl === "string" ? log.cacheControl : "";
  const contentType =
    typeof log.contentType === "string" ? log.contentType : "";

  summary.seoAccess += 1;
  summary.statusBuckets[statusBucket(status)] =
    (summary.statusBuckets[statusBucket(status)] || 0) + 1;
  summary.crawlers[crawler] = (summary.crawlers[crawler] || 0) + 1;
  summary.paths[path] = (summary.paths[path] || 0) + 1;

  if (status >= 500) {
    fail(`${crawler} saw ${status} on ${path}`);
  } else if (crawler !== "Unknown" && status >= 400) {
    fail(`${crawler} saw crawler-facing ${status} on ${path}`);
  }

  if (isPublicPath(path) && robots !== EXPECTED_INDEXABLE_ROBOTS) {
    fail(`${path} logged robots "${robots || "(missing)"}" for a public path`);
  }

  if (isNoindexPath(path) && robots !== EXPECTED_NOINDEX_ROBOTS) {
    fail(`${path} logged robots "${robots || "(missing)"}" for a noindex path`);
  }

  if (isPublicPath(path) && /^no-store\b/i.test(cacheControl)) {
    fail(`${path} logged no-store cache policy for a public path`);
  }

  if (isPublicPath(path) && !contentType) {
    warn(`${path} logged without a content type`);
  }

  const pathIssue = canonicalPathIssue(path);
  if (pathIssue) warn(`${path}: ${pathIssue}`);
}

function analyzeWebVitals(log, summary) {
  const path = typeof log.path === "string" ? log.path : "/";
  const metrics = Array.isArray(log.metrics) ? log.metrics : [];

  summary.webVitals += 1;

  for (const metric of metrics) {
    const name = typeof metric.name === "string" ? metric.name : "";
    const value = Number(metric.value);

    if (!Number.isFinite(value)) continue;

    summary.vitals[name] ||= {
      count: 0,
      max: Number.NEGATIVE_INFINITY,
      sum: 0,
    };
    summary.vitals[name].count += 1;
    summary.vitals[name].max = Math.max(summary.vitals[name].max, value);
    summary.vitals[name].sum += value;

    if (value > SEVERE_VITAL_LIMITS[name]) {
      fail(`${path} logged severe ${name} ${value}`);
    } else if (value > NEEDS_IMPROVEMENT_VITAL_LIMITS[name]) {
      warn(`${path} logged needs-improvement ${name} ${value}`);
    }
  }
}

function analyze(logs) {
  const summary = {
    crawlers: {},
    paths: {},
    seoAccess: 0,
    statusBuckets: {},
    vitals: {},
    webVitals: 0,
  };

  for (const log of logs) {
    if (log.type === "seo-access") analyzeSeoAccess(log, summary);
    if (log.type === "web-vitals") analyzeWebVitals(log, summary);
  }

  if (!summary.seoAccess && !summary.webVitals) {
    fail("No seo-access or web-vitals records found in the supplied logs");
  }

  return summary;
}

function printableSummary(summary) {
  const vitals = Object.fromEntries(
    Object.entries(summary.vitals).map(([name, metric]) => [
      name,
      {
        average: Number((metric.sum / metric.count).toFixed(3)),
        count: metric.count,
        max: Number(metric.max.toFixed(3)),
      },
    ]),
  );

  return {
    crawlers: summary.crawlers,
    paths: summary.paths,
    seoAccess: summary.seoAccess,
    statusBuckets: summary.statusBuckets,
    vitals,
    warnings,
    webVitals: summary.webVitals,
  };
}

function main() {
  const input = readInput();
  const logs = input.split(/\r?\n/).flatMap(parseJsonFromLine).filter(isSeoLog);
  const summary = analyze(logs);
  const report = printableSummary(summary);

  if (process.argv.includes("--json")) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(
      `SEO log analysis scanned ${summary.seoAccess} crawler records and ${summary.webVitals} web-vitals records.`,
    );

    if (Object.keys(summary.crawlers).length) {
      console.log(`Crawlers: ${JSON.stringify(summary.crawlers)}`);
    }

    if (Object.keys(report.vitals).length) {
      console.log(`Vitals: ${JSON.stringify(report.vitals)}`);
    }
  }

  for (const warning of warnings) console.warn(`Warning: ${warning}`);

  if (failures.length) {
    console.error("SEO log analysis failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log("SEO log analysis passed.");
}

main();
