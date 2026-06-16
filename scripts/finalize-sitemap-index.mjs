import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITEMAP_INDEX = path.join(ROOT, "dist", "sitemap-index.xml");
const SITEMAP_LASTMOD = "2026-06-16T00:00:00.000Z";

if (!existsSync(SITEMAP_INDEX)) {
  console.error("dist/sitemap-index.xml is missing. Run astro build first.");
  process.exit(1);
}

const source = readFileSync(SITEMAP_INDEX, "utf8");
let sitemapCount = 0;
const updated = source.replace(
  /(<sitemap>\s*<loc>[^<]+<\/loc>)(?:\s*<lastmod>[^<]*<\/lastmod>)?/g,
  (_, loc) => {
    sitemapCount += 1;
    return `${loc}<lastmod>${SITEMAP_LASTMOD}</lastmod>`;
  },
);

if (!sitemapCount) {
  console.error("dist/sitemap-index.xml does not contain sitemap entries.");
  process.exit(1);
}

writeFileSync(SITEMAP_INDEX, updated);
console.log(`Finalized sitemap index with ${sitemapCount} lastmod value(s).`);
