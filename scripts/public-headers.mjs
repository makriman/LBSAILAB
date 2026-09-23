import { SITE_LAST_MODIFIED } from "../src/site-revision.mjs";

const INDEXABLE_ROBOTS =
  "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";
const SHORT_CACHE_CONTROL = "public, max-age=300, must-revalidate";
const LONG_CACHE_CONTROL = "public, max-age=31536000, immutable";

const SHORT_CACHE_PATHS = [
  "/",
  "/about/*",
  "/apply/*",
  "/batches/*",
  "/contact/*",
  "/mentors/",
  "/sitemap/*",
  "/image-sitemap.xml",
  "/llms.txt",
  "/llms-full.txt",
  "/feed.xml",
  "/sitemap-*.xml",
  "/robots.txt",
];

const LONG_CACHE_PATHS = [
  "/_astro/*",
  "/assets/*",
  "/images/*",
  "/mentors/*.jpg",
  "/mentors/*.png",
  "/favicon/*",
  "/favicon.ico",
  "/google-deepmind-logo-*.png",
  "/og-*.png",
  "/og-default.svg",
  "/site.webmanifest",
];

function rule(pathname, headers) {
  const lines = headers.map(([name, value]) => `  ${name}: ${value}`);
  return [`${pathname}`, ...lines].join("\n");
}

/**
 * Cloudflare Pages `_headers` fallback. The Worker returns 410 for `/_headers`
 * and sets the live CSP, HSTS, and `Last-Modified` values itself, so this
 * file does not change production responses.
 */
export function renderPublicHeaders() {
  const shortCache = SHORT_CACHE_PATHS.map((pathname) =>
    rule(pathname, [
      ["X-Robots-Tag", INDEXABLE_ROBOTS],
      ["Last-Modified", SITE_LAST_MODIFIED],
      ["Cache-Control", SHORT_CACHE_CONTROL],
    ]),
  );
  const longCache = LONG_CACHE_PATHS.map((pathname) =>
    rule(pathname, [["Cache-Control", LONG_CACHE_CONTROL]]),
  );

  return [
    "# Not the live response policy. src/worker.ts sets headers and returns",
    "# 410 for /_headers and /_redirects. Do not add CSP or HSTS here and",
    "# expect them to apply. Last-Modified comes from src/site-revision.mjs.",
    [
      rule("/*", [
        ["X-Frame-Options", "DENY"],
        ["X-Content-Type-Options", "nosniff"],
        ["Referrer-Policy", "strict-origin-when-cross-origin"],
        ["Permissions-Policy", "camera=(), microphone=(), geolocation=()"],
      ]),
      ...shortCache,
      ...longCache,
    ].join("\n\n"),
    "",
  ].join("\n");
}
