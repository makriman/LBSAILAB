const SITE_URL = process.env.SEO_SITE_URL || "https://lbsailab.com";
const SITE_ORIGIN = new URL(SITE_URL).origin;
const PAGESPEED_API =
  process.env.PAGESPEED_API ||
  "https://www.googleapis.com/pagespeedonline/v5/runPagespeed";
const DEFAULT_PATHS = ["/", "/batches/spring-2026/", "/mentors/"];
const DEFAULT_STRATEGIES = ["mobile", "desktop"];
const PAGESPEED_ATTEMPTS = Number(process.env.PAGESPEED_ATTEMPTS || "2");
const HAS_PAGESPEED_API_KEY = Boolean(process.env.PAGESPEED_API_KEY);
const ALLOW_UNKEYED_PAGESPEED = process.env.PAGESPEED_ALLOW_NO_KEY === "1";
const REQUIRE_PAGESPEED = process.env.PAGESPEED_REQUIRED === "1";
const MIN_CATEGORY_SCORES = {
  accessibility: 0.9,
  "best-practices": 0.95,
  performance: 0.85,
  seo: 1,
};
const MAX_METRICS = {
  "cumulative-layout-shift": 0.1,
  "largest-contentful-paint": 3000,
  "server-response-time": 800,
  "total-blocking-time": 200,
};
const failures = [];

function fail(message) {
  failures.push(message);
}

function auditUrls() {
  const urls = (process.env.PAGESPEED_URLS || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  return (urls.length ? urls : DEFAULT_PATHS).map((url) =>
    new URL(url, SITE_ORIGIN).toString(),
  );
}

function auditStrategies() {
  const strategies = (process.env.PAGESPEED_STRATEGIES || "")
    .split(",")
    .map((strategy) => strategy.trim().toLowerCase())
    .filter(Boolean);

  return [...new Set(strategies.length ? strategies : DEFAULT_STRATEGIES)].map(
    (strategy) => (strategy === "desktop" ? "desktop" : "mobile"),
  );
}

function pagespeedUrl(url, strategy) {
  const endpoint = new URL(PAGESPEED_API);
  endpoint.searchParams.set("url", url);
  endpoint.searchParams.set("strategy", strategy);
  endpoint.searchParams.set("locale", "en-GB");

  for (const category of Object.keys(MIN_CATEGORY_SCORES)) {
    endpoint.searchParams.append("category", category);
  }

  if (process.env.PAGESPEED_API_KEY) {
    endpoint.searchParams.set("key", process.env.PAGESPEED_API_KEY);
  }

  return endpoint;
}

async function fetchPagespeed(url, strategy) {
  const response = await fetch(pagespeedUrl(url, strategy), {
    headers: {
      Accept: "application/json",
      "User-Agent": "lbsailab-pagespeed-monitor/1.0",
    },
    signal: AbortSignal.timeout(
      Number(process.env.PAGESPEED_TIMEOUT_MS || "120000"),
    ),
  });
  const body = await response.text();

  if (!response.ok) {
    throw new Error(
      `PageSpeed API returned ${response.status}: ${body.slice(0, 400)}`,
    );
  }

  return JSON.parse(body);
}

function categoryScore(result, category) {
  return result.lighthouseResult?.categories?.[category]?.score;
}

function metric(result, auditId) {
  return result.lighthouseResult?.audits?.[auditId]?.numericValue;
}

function displayMetric(result, auditId) {
  return result.lighthouseResult?.audits?.[auditId]?.displayValue || "n/a";
}

function auditResult(result, url, strategy, attemptLabel = "") {
  const resultFailures = [];
  const summary = [];
  const recordFailure = (message) => resultFailures.push(message);

  if (result.id && new URL(result.id).origin !== SITE_ORIGIN) {
    recordFailure(
      `${url}: PageSpeed result id is not canonical (${result.id})`,
    );
  }

  for (const [category, minimum] of Object.entries(MIN_CATEGORY_SCORES)) {
    const actual = categoryScore(result, category);
    const percentage = Math.round((actual ?? 0) * 100);

    summary.push(`${category} ${percentage}`);

    if (typeof actual !== "number" || actual < minimum) {
      recordFailure(
        `${url} ${strategy}: PageSpeed ${category} score ${percentage} below ${minimum * 100}`,
      );
    }
  }

  for (const [auditId, maximum] of Object.entries(MAX_METRICS)) {
    const actual = metric(result, auditId);

    if (typeof actual !== "number") {
      recordFailure(`${url} ${strategy}: PageSpeed ${auditId} metric missing`);
      continue;
    }

    if (actual > maximum) {
      recordFailure(
        `${url} ${strategy}: PageSpeed ${auditId} ${displayMetric(result, auditId)} exceeds ${maximum}`,
      );
    }
  }

  console.log(
    `${url} ${strategy}${attemptLabel}: ${summary.join(", ")}; LCP ${displayMetric(
      result,
      "largest-contentful-paint",
    )}; CLS ${displayMetric(result, "cumulative-layout-shift")}; TBT ${displayMetric(
      result,
      "total-blocking-time",
    )}`,
  );

  return resultFailures;
}

async function auditPageSpeed() {
  if (!HAS_PAGESPEED_API_KEY && !ALLOW_UNKEYED_PAGESPEED) {
    const message =
      "PageSpeed Insights audit skipped because PAGESPEED_API_KEY is not configured. Set PAGESPEED_API_KEY for scheduled monitoring, or PAGESPEED_ALLOW_NO_KEY=1 for ad hoc no-key runs.";

    if (REQUIRE_PAGESPEED) {
      fail(message);
    } else {
      console.warn(message);
      return;
    }
  }

  for (const url of auditUrls()) {
    for (const strategy of auditStrategies()) {
      let finalFailures = [];

      for (let attempt = 1; attempt <= PAGESPEED_ATTEMPTS; attempt += 1) {
        try {
          const result = await fetchPagespeed(url, strategy);
          const attemptFailures = auditResult(
            result,
            url,
            strategy,
            PAGESPEED_ATTEMPTS > 1 ? ` attempt ${attempt}` : "",
          );

          finalFailures = attemptFailures;

          if (!attemptFailures.length) break;
        } catch (error) {
          finalFailures = [
            `${url} ${strategy}: ${error instanceof Error ? error.message : String(error)}`,
          ];
        }

        if (attempt < PAGESPEED_ATTEMPTS) {
          console.warn(
            `${url} ${strategy}: retrying PageSpeed after ${finalFailures.length} failed check(s)`,
          );
        }
      }

      for (const failure of finalFailures) fail(failure);
    }
  }

  if (failures.length) {
    console.error("PageSpeed Insights SEO audit failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log("PageSpeed Insights SEO audit passed.");
}

auditPageSpeed().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
