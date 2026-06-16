import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIST = path.join(ROOT, "dist");
const SITE_URL = "https://lbsailab.com";
const SITE_HOST = new URL(SITE_URL).host;
const INDEXNOW_KEY = "5e5bfddcc11447d381079b24b2d1e213";
const INDEXNOW_KEY_LOCATION = `${SITE_URL}/${INDEXNOW_KEY}.txt`;
const INDEXNOW_ENDPOINT =
  process.env.INDEXNOW_ENDPOINT || "https://api.indexnow.org/indexnow";
const DISCOVERY_URLS = [`${SITE_URL}/llms.txt`, `${SITE_URL}/llms-full.txt`];
const DRY_RUN =
  process.argv.includes("--dry-run") || process.env.INDEXNOW_DRY_RUN === "1";

function readDist(relativePath) {
  const fullPath = path.join(DIST, relativePath);

  if (!existsSync(fullPath)) {
    throw new Error(`Missing dist/${relativePath}. Run npm run build first.`);
  }

  return readFileSync(fullPath, "utf8");
}

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((match) =>
    match[1].trim(),
  );
}

function canonicalUrls() {
  const urls = extractLocs(readDist("sitemap-0.xml")).filter((loc) => {
    const url = new URL(loc);
    return (
      url.origin === SITE_URL && !/\/(cohorts?|teams)(\/|$)/.test(url.pathname)
    );
  });

  return [...new Set([...urls, ...DISCOVERY_URLS])];
}

async function submitIndexNow() {
  const keyFile = readDist(`${INDEXNOW_KEY}.txt`).trim();

  if (keyFile !== INDEXNOW_KEY) {
    throw new Error("IndexNow key file does not match configured key.");
  }

  const urlList = canonicalUrls();
  const body = {
    host: SITE_HOST,
    key: INDEXNOW_KEY,
    keyLocation: INDEXNOW_KEY_LOCATION,
    urlList,
  };

  if (DRY_RUN) {
    console.log(JSON.stringify({ endpoint: INDEXNOW_ENDPOINT, body }, null, 2));
    return;
  }

  const response = await fetch(INDEXNOW_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json; charset=utf-8",
    },
    body: JSON.stringify(body),
  });

  if (![200, 202].includes(response.status)) {
    const detail = await response.text();
    throw new Error(
      `IndexNow submission failed with ${response.status}: ${detail}`,
    );
  }

  console.log(
    `IndexNow accepted ${urlList.length} URL${urlList.length === 1 ? "" : "s"} with status ${response.status}.`,
  );
}

submitIndexNow().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
