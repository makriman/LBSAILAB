import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

const SITE_URL = process.env.SEO_SITE_URL || "https://lbsailab.com";
const SITE_ORIGIN = new URL(SITE_URL).origin;
const DEFAULT_PATHS = ["/", "/batches/spring-2026/", "/mentors/"];
const LIGHTHOUSE_VERSION = "13.4.0";
const MIN_CATEGORY_SCORES = {
  accessibility: 0.9,
  "best-practices": 0.95,
  performance: 0.75,
  seo: 1,
};
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

function auditReport(report, url) {
  const summary = [];

  for (const [category, minimum] of Object.entries(MIN_CATEGORY_SCORES)) {
    const actual = score(report, category);
    const percentage = Math.round((actual ?? 0) * 100);

    summary.push(`${category} ${percentage}`);

    if (typeof actual !== "number" || actual < minimum) {
      fail(
        `${url}: Lighthouse ${category} score ${percentage} below ${minimum * 100}`,
      );
    }
  }

  for (const [auditId, maximum] of Object.entries(MAX_METRICS)) {
    const actual = metric(report, auditId);

    if (typeof actual !== "number") {
      fail(`${url}: Lighthouse ${auditId} metric missing`);
      continue;
    }

    if (actual > maximum) {
      fail(
        `${url}: Lighthouse ${auditId} ${displayMetric(report, auditId)} exceeds ${maximum}`,
      );
    }
  }

  for (const auditId of OBSERVED_METRICS) {
    if (typeof metric(report, auditId) !== "number") {
      fail(`${url}: Lighthouse ${auditId} metric missing`);
    }
  }

  console.log(
    `${url}: ${summary.join(", ")}; LCP ${displayMetric(
      report,
      "largest-contentful-paint",
    )}; CLS ${displayMetric(report, "cumulative-layout-shift")}; TBT ${displayMetric(
      report,
      "total-blocking-time",
    )}`,
  );
}

async function auditLighthouse() {
  const temporaryDirectory = await mkdtemp(join(tmpdir(), "lbs-lighthouse-"));

  try {
    for (const [index, url] of auditUrls().entries()) {
      const outputPath = join(temporaryDirectory, `report-${index}.json`);
      const report = await runLighthouse(url, outputPath);
      auditReport(report, url);
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
