import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SITE_URL = process.env.SEO_SITE_URL || "https://lbsailab.com";
const SITE_ORIGIN = new URL(SITE_URL).origin;
const DEFAULT_PATHS = ["/", "/batches/spring-2026/", "/mentors/"];
const LIGHTHOUSE_VERSION = "13.4.0";
const LIGHTHOUSE_ATTEMPTS = Number(process.env.LIGHTHOUSE_ATTEMPTS || "2");
const MIN_CATEGORY_SCORES = {
  accessibility: 0.9,
  "best-practices": 0.95,
  seo: 1,
};
const OBSERVED_CATEGORIES = ["performance"];
const MAX_METRICS = {
  "cumulative-layout-shift": 0.1,
  "largest-contentful-paint": 3000,
  "server-response-time": 800,
};
const OBSERVED_METRICS = ["total-blocking-time"];
const MAC_CHROME_PATH =
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const failures = [];

function fail(message) {
  failures.push(message);
}

function auditUrls() {
  const urls = (process.env.LIGHTHOUSE_URLS || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  return (urls.length ? urls : DEFAULT_PATHS).map((url) =>
    new URL(url, SITE_ORIGIN).toString(),
  );
}

function lighthouseEnv() {
  if (process.env.CHROME_PATH || !existsSync(MAC_CHROME_PATH)) {
    return process.env;
  }

  return {
    ...process.env,
    CHROME_PATH: MAC_CHROME_PATH,
  };
}

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      env: lighthouseEnv(),
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve({ stderr, stdout });
        return;
      }

      reject(
        new Error(
          `${command} ${args.join(" ")} exited ${code}\n${stdout}\n${stderr}`,
        ),
      );
    });
  });
}

async function runLighthouse(url, outputPath) {
  await run("npx", [
    "--yes",
    `lighthouse@${LIGHTHOUSE_VERSION}`,
    url,
    "--quiet",
    "--only-categories=performance,accessibility,best-practices,seo",
    "--chrome-flags=--headless=new --no-sandbox --disable-dev-shm-usage",
    "--output=json",
    `--output-path=${outputPath}`,
  ]);

  return JSON.parse(await readFile(outputPath, "utf8"));
}

function score(report, category) {
  return report.categories?.[category]?.score;
}

function metric(report, auditId) {
  return report.audits?.[auditId]?.numericValue;
}

function displayMetric(report, auditId) {
  return report.audits?.[auditId]?.displayValue || "n/a";
}

function auditReport(report, url, attemptLabel = "") {
  const reportFailures = [];
  const summary = [];
  const recordFailure = (message) => reportFailures.push(message);

  const categories = [
    ...Object.keys(MIN_CATEGORY_SCORES),
    ...OBSERVED_CATEGORIES,
  ];

  for (const category of categories) {
    const actual = score(report, category);
    const percentage = Math.round((actual ?? 0) * 100);

    summary.push(`${category} ${percentage}`);

    const minimum = MIN_CATEGORY_SCORES[category];

    if (
      typeof minimum === "number" &&
      (typeof actual !== "number" || actual < minimum)
    ) {
      recordFailure(
        `${url}: Lighthouse ${category} score ${percentage} below ${minimum * 100}`,
      );
    }
  }

  for (const [auditId, maximum] of Object.entries(MAX_METRICS)) {
    const actual = metric(report, auditId);

    if (typeof actual !== "number") {
      recordFailure(`${url}: Lighthouse ${auditId} metric missing`);
      continue;
    }

    if (actual > maximum) {
      recordFailure(
        `${url}: Lighthouse ${auditId} ${displayMetric(report, auditId)} exceeds ${maximum}`,
      );
    }
  }

  for (const auditId of OBSERVED_METRICS) {
    if (typeof metric(report, auditId) !== "number") {
      recordFailure(`${url}: Lighthouse ${auditId} metric missing`);
    }
  }

  console.log(
    `${url}${attemptLabel}: ${summary.join(", ")}; LCP ${displayMetric(
      report,
      "largest-contentful-paint",
    )}; CLS ${displayMetric(report, "cumulative-layout-shift")}; TBT ${displayMetric(
      report,
      "total-blocking-time",
    )}`,
  );

  return reportFailures;
}

async function auditLighthouse() {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "lbs-lighthouse-"));

  try {
    for (const [urlIndex, url] of auditUrls().entries()) {
      let finalFailures = [];

      for (let attempt = 1; attempt <= LIGHTHOUSE_ATTEMPTS; attempt += 1) {
        const outputPath = join(
          temporaryDirectory,
          `report-${urlIndex}-${attempt}.json`,
        );
        const report = await runLighthouse(url, outputPath);
        const attemptFailures = auditReport(
          report,
          url,
          LIGHTHOUSE_ATTEMPTS > 1 ? ` attempt ${attempt}` : "",
        );

        finalFailures = attemptFailures;

        if (!attemptFailures.length) break;

        if (attempt < LIGHTHOUSE_ATTEMPTS) {
          console.warn(
            `${url}: retrying Lighthouse after ${attemptFailures.length} failed check(s)`,
          );
        }
      }

      for (const failure of finalFailures) fail(failure);
    }
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }

  if (failures.length) {
    console.error("Lighthouse SEO audit failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log("Lighthouse SEO audit passed.");
}

auditLighthouse().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
