type WorkerEnv = Env & {
  GOOGLE_SITE_VERIFICATION_FILE?: string;
  BING_SITE_VERIFICATION_TOKEN?: string;
};

interface ApplicationSubmission {
  name: string;
  email: string;
  course: string;
  idea: string;
}

interface PublicApplication {
  submittedAt: string;
  name: string;
  course: string;
  idea: string;
}

interface WebVitalsPayload {
  connectionType?: unknown;
  metrics?: Array<{
    name?: unknown;
    value?: unknown;
  }>;
  navigationType?: unknown;
  path?: unknown;
  saveData?: unknown;
  viewport?: unknown;
  visibilityState?: unknown;
}

interface RequestWithCloudflareContext extends Request {
  cf?: {
    colo?: unknown;
    country?: unknown;
  };
}

const APPLICATIONS_QUERY_LIMIT = 500;
const MAX_APPLICATION_PAYLOAD_BYTES = 8192;
const MAX_VITALS_PAYLOAD_BYTES = 4096;
const CANONICAL_HOST = "lbsailab.com";
const INDEXNOW_KEY = "5e5bfddcc11447d381079b24b2d1e213";
const INDEXNOW_KEY_PATH = `/${INDEXNOW_KEY}.txt`;
const SECURITY_TXT_PATH = "/.well-known/security.txt";
const BING_SITE_AUTH_PATH = "/BingSiteAuth.xml";
const ERROR_DOCUMENT_PATHS = new Set(["/404.html", "/404/"]);
const INDEXABLE_ROBOTS =
  "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1";
const NOINDEX_ROBOTS = "noindex, nofollow";
const CONTENT_LANGUAGE = "en-GB";
const SITE_UPDATED_AT = "2026-06-16T00:00:00.000Z";
const LAST_MODIFIED = new Date(SITE_UPDATED_AT).toUTCString();
const SHORT_CACHE_CONTROL = "public, max-age=300, must-revalidate";
const LONG_CACHE_CONTROL = "public, max-age=31536000, immutable";
const SECURITY_HEADERS = {
  "Content-Security-Policy":
    "default-src 'self'; base-uri 'self'; object-src 'none'; img-src 'self' data:; script-src 'self' 'sha256-gjeSSMIXG9BbI3JOaYbZjuKjgLQWtyZzrKeJWWpTW5w=' 'sha256-2VsAOLriGmzau9euyTar/WJk/JxKiuqkiONHcwQ2igg=' 'sha256-gSidlGkk2DWAtd/eo/XrAM4C8DD8+ek8QceN9+p88cE=' https://static.cloudflareinsights.com; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self' https://cloudflareinsights.com; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
  "Cross-Origin-Opener-Policy": "same-origin",
  "Origin-Agent-Cluster": "?1",
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "X-DNS-Prefetch-Control": "off",
  "X-Permitted-Cross-Domain-Policies": "none",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000",
};
const GONE_PATHS = new Set([
  "/_headers",
  "/_headers/",
  "/_redirects",
  "/_redirects/",
  "/images/lbs-ai-lab-workshop-hero.png",
  "/mentors/rhea-bisaria.png",
]);
const NOINDEX_PATH_PREFIXES = [
  "/admin/",
  "/api/",
  "/cart/",
  "/checkout/",
  "/healthz",
  "/internal/",
  "/login/",
  "/private/",
  "/search/",
];
const SEO_CRAWLER_USER_AGENTS = [
  { label: "Googlebot-Image", pattern: /\bgooglebot-image\b/i },
  { label: "Googlebot", pattern: /\bgooglebot\b/i },
  { label: "Bingbot", pattern: /\bbingbot\b/i },
  { label: "DuckDuckBot", pattern: /\bduckduckbot\b/i },
  { label: "YandexBot", pattern: /\byandexbot\b/i },
  { label: "Baiduspider", pattern: /\bbaiduspider\b/i },
  { label: "Applebot", pattern: /\bapplebot\b/i },
  { label: "FacebookExternalHit", pattern: /\bfacebookexternalhit\b/i },
  { label: "LinkedInBot", pattern: /\blinkedinbot\b/i },
  { label: "Twitterbot", pattern: /\btwitterbot\b/i },
  { label: "GenericBot", pattern: /\b(?:bot|crawler|spider|slurp)\b/i },
];
const LEGACY_REDIRECTS = new Map([
  ["/home", "/"],
  ["/sitemap.xml", "/sitemap-index.xml"],
  ["/feed", "/feed.xml"],
  ["/rss", "/feed.xml"],
  ["/rss.xml", "/feed.xml"],
  ["/atom", "/feed.xml"],
  ["/atom.xml", "/feed.xml"],
  ["/cohort", "/batches/"],
  ["/cohorts", "/batches/"],
  ["/cohort-01", "/batches/spring-2026/"],
  ["/cohorts/cohort-01", "/batches/spring-2026/"],
  ["/cohorts/cohort-02", "/batches/#autumn-2026"],
  ["/teams", "/batches/spring-2026/"],
  ["/teams/recruitsmart", "/batches/spring-2026/recruitsmart-lbs/"],
  ["/teams/cafe-smart", "/batches/spring-2026/london-eats-pal/"],
  ["/teams/cafesmart", "/batches/spring-2026/london-eats-pal/"],
  ["/teams/campus-collective", "/batches/spring-2026/london-eats-pal/"],
  [
    "/teams/cafe-smart-campus-collective",
    "/batches/spring-2026/london-eats-pal/",
  ],
  ["/teams/wayfinder", "/batches/spring-2026/wayfinder/"],
  ["/teams/wayfinders", "/batches/spring-2026/wayfinder/"],
  ["/batches/spring-2026/cafe-smart", "/batches/spring-2026/london-eats-pal/"],
  ["/batches/spring-2026/cafesmart", "/batches/spring-2026/london-eats-pal/"],
  [
    "/batches/spring-2026/campus-collective",
    "/batches/spring-2026/london-eats-pal/",
  ],
  [
    "/batches/spring-2026/cafe-smart-campus-collective",
    "/batches/spring-2026/london-eats-pal/",
  ],
  ["/batches/spring-2026/the-wayfinders", "/batches/spring-2026/wayfinder/"],
]);

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
  "X-Robots-Tag": NOINDEX_ROBOTS,
};

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);
    const response = await handleRequest(request, env, url);

    logSeoAccess(request, url, response);

    return response;
  },
};

async function handleRequest(
  request: Request,
  env: WorkerEnv,
  url: URL,
): Promise<Response> {
  const canonicalRedirect = canonicalRedirectResponse(request, url);

  if (canonicalRedirect) return canonicalRedirect;
  const verificationResponse = siteVerificationResponse(url, env);
  if (verificationResponse) return verificationResponse;
  if (GONE_PATHS.has(url.pathname)) return gone();
  if (url.pathname === INDEXNOW_KEY_PATH) return indexNowKey();
  if (url.pathname === "/healthz") return healthCheck();
  if (ERROR_DOCUMENT_PATHS.has(url.pathname)) {
    return withSeoHeaders(
      await errorDocumentResponse(request, env, 200),
      url.pathname,
    );
  }

  if (url.pathname === "/api/applications") {
    if (request.method === "GET") {
      return handleListApplications(env);
    }

    if (request.method === "POST") {
      return handleCreateApplication(request, env);
    }

    return json({ error: "Method not allowed" }, 405);
  }

  if (url.pathname === "/api/vitals") {
    if (request.method === "POST") {
      return handleVitals(request);
    }

    if (["GET", "HEAD"].includes(request.method)) {
      return json({ ok: true, service: "web-vitals" }, 200);
    }

    return noContent(405, { Allow: "GET, HEAD, POST" });
  }

  const assetResponse = await env.ASSETS.fetch(request);
  return withSeoHeaders(
    await notFoundPageResponse(request, env, assetResponse, url.pathname),
    url.pathname,
  );
}

function canonicalRedirectResponse(
  request: Request,
  url: URL,
): Response | null {
  if (!["GET", "HEAD"].includes(request.method)) return null;
  if (url.pathname.startsWith("/api/")) return null;

  const indexCleanedPathname = cleanIndexDocumentPath(url.pathname);
  const legacyDestination = legacyRedirectDestination(indexCleanedPathname);
  const cleanedSearch = canonicalSearch();

  if (legacyDestination) {
    const redirectUrl = canonicalUrl(url);
    redirectUrl.pathname = legacyDestination.pathname;
    redirectUrl.search = legacyDestination.search || cleanedSearch;
    redirectUrl.hash = legacyDestination.hash;
    return permanentRedirect(redirectUrl);
  }

  const redirectUrl = canonicalUrl(url);
  redirectUrl.search = cleanedSearch;
  redirectUrl.pathname = indexCleanedPathname;

  if (shouldNormalizePathCase(redirectUrl.pathname)) {
    const lowercasePath = redirectUrl.pathname.toLowerCase();
    redirectUrl.pathname = lowercasePath;
  }

  if (shouldAddTrailingSlash(redirectUrl.pathname)) {
    redirectUrl.pathname = `${redirectUrl.pathname}/`;
  }

  return redirectUrl.toString() === url.toString()
    ? null
    : permanentRedirect(redirectUrl);
}

function cleanIndexDocumentPath(pathname: string): string {
  if (!/\/index\.html$/i.test(pathname)) return pathname;

  return pathname.replace(/\/index\.html$/i, "/") || "/";
}

function permanentRedirect(url: URL): Response {
  const headers = new Headers({
    Location: url.toString(),
    "Cache-Control": SHORT_CACHE_CONTROL,
  });

  setHeaders(headers, SECURITY_HEADERS);

  return new Response(null, {
    status: 301,
    statusText: "Moved Permanently",
    headers,
  });
}

function canonicalSearch(): string {
  return "";
}

function canonicalUrl(url: URL): URL {
  const nextUrl = new URL(url);

  if (!isLocalHost(nextUrl.hostname)) {
    nextUrl.protocol = "https:";
    nextUrl.hostname = CANONICAL_HOST;
    nextUrl.port = "";
  }

  return nextUrl;
}

function legacyRedirectDestination(pathname: string): URL | null {
  const normalizedPath = pathname
    .replace(/\/+$/, "")
    .toLowerCase()
    .replace(/^$/, "/");
  const destination = LEGACY_REDIRECTS.get(normalizedPath);

  if (destination) return new URL(destination, `https://${CANONICAL_HOST}`);

  const oldTeamMatch = normalizedPath.match(/^\/teams\/([^/]+)$/);
  if (!oldTeamMatch) return null;

  return new URL(
    `/batches/spring-2026/${oldTeamMatch[1]}/`,
    `https://${CANONICAL_HOST}`,
  );
}

function shouldAddTrailingSlash(pathname: string): boolean {
  if (pathname === "/" || pathname.endsWith("/")) return false;
  if (pathname === "/healthz") return false;
  if (GONE_PATHS.has(pathname)) return false;

  const lastSegment = pathname.split("/").at(-1) ?? "";
  return !lastSegment.includes(".");
}

function shouldNormalizePathCase(pathname: string): boolean {
  const lastSegment = pathname.split("/").at(-1) ?? "";
  return !lastSegment.includes(".");
}

async function notFoundPageResponse(
  request: Request,
  env: WorkerEnv,
  response: Response,
  pathname: string,
): Promise<Response> {
  if (response.status !== 404 || !shouldServeNotFoundPage(request, pathname)) {
    return response;
  }

  const pageUrl = new URL("/404.html", request.url);
  return errorDocumentResponse(request, env, 404, response, pageUrl);
}

function shouldServeNotFoundPage(request: Request, pathname: string): boolean {
  if (!["GET", "HEAD"].includes(request.method)) return false;

  const lastSegment = pathname.split("/").at(-1) ?? "";
  if (lastSegment.includes(".")) return false;

  const accept = request.headers.get("Accept") || "";
  return (
    request.method === "HEAD" ||
    !accept ||
    accept.includes("text/html") ||
    accept.includes("*/*")
  );
}

async function errorDocumentResponse(
  request: Request,
  env: WorkerEnv,
  status: number,
  fallback?: Response,
  pageUrl = new URL("/404.html", request.url),
): Promise<Response> {
  const pageRequest = new Request(pageUrl, {
    headers: {
      Accept: "text/html",
    },
    method: "GET",
  });
  const page = await env.ASSETS.fetch(pageRequest);

  if (page.status !== 200) return fallback ?? page;

  return new Response(request.method === "HEAD" ? null : page.body, {
    headers: page.headers,
    status,
    statusText: status === 404 ? "Not Found" : "OK",
  });
}

function isLocalHost(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "::1" ||
    hostname.endsWith(".localhost")
  );
}

function withSeoHeaders(response: Response, pathname: string): Response {
  const headers = new Headers(response.headers);

  setHeaders(headers, SECURITY_HEADERS);

  if (
    response.status === 404 ||
    response.status === 410 ||
    isNoindexPath(pathname)
  ) {
    headers.set("X-Robots-Tag", NOINDEX_ROBOTS);
  } else if (isCrawlerUtilityPath(pathname)) {
    headers.set("X-Robots-Tag", INDEXABLE_ROBOTS);
  } else if (isIndexableImageAsset(pathname)) {
    headers.set("X-Robots-Tag", INDEXABLE_ROBOTS);
  } else if (isHtmlResponse(headers)) {
    headers.set("X-Robots-Tag", INDEXABLE_ROBOTS);
  }

  if (pathname === "/feed.xml") {
    headers.set("Content-Type", "application/atom+xml; charset=utf-8");
  }

  if (shouldSetContentLanguage(pathname, headers, response.status)) {
    headers.set("Content-Language", CONTENT_LANGUAGE);
  }

  headers.set(
    "Cache-Control",
    cacheControlFor(pathname, headers, response.status),
  );

  if (shouldSetLastModified(pathname, headers, response.status)) {
    headers.set("Last-Modified", LAST_MODIFIED);
  }

  if (shouldSetCanonicalHeader(pathname, headers, response.status)) {
    headers.append(
      "Link",
      `<${canonicalHeaderUrl(pathname)}>; rel="canonical"`,
    );
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function setHeaders(headers: Headers, values: Record<string, string>): void {
  for (const [name, value] of Object.entries(values)) {
    headers.set(name, value);
  }
}

function cacheControlFor(
  pathname: string,
  headers: Headers,
  status: number,
): string {
  if (status >= 400) return SHORT_CACHE_CONTROL;
  if (isLongLivedAsset(pathname)) return LONG_CACHE_CONTROL;
  if (isHtmlResponse(headers)) return SHORT_CACHE_CONTROL;

  return SHORT_CACHE_CONTROL;
}

function shouldSetLastModified(
  pathname: string,
  headers: Headers,
  status: number,
): boolean {
  if (status >= 400) return true;
  if (isLongLivedAsset(pathname)) return false;

  return (
    isHtmlResponse(headers) ||
    isCrawlerUtilityPath(pathname) ||
    isNoindexPath(pathname)
  );
}

function shouldSetContentLanguage(
  pathname: string,
  headers: Headers,
  status: number,
): boolean {
  if (isLongLivedAsset(pathname)) return false;

  return (
    status === 404 ||
    status === 410 ||
    isHtmlResponse(headers) ||
    isCrawlerUtilityPath(pathname) ||
    isNoindexPath(pathname)
  );
}

function shouldSetCanonicalHeader(
  pathname: string,
  headers: Headers,
  status: number,
): boolean {
  return status === 200 && isHtmlResponse(headers) && !isNoindexPath(pathname);
}

function canonicalHeaderUrl(pathname: string): string {
  const url = new URL(`https://${CANONICAL_HOST}`);
  url.pathname = cleanIndexDocumentPath(pathname);

  if (shouldNormalizePathCase(url.pathname)) {
    url.pathname = url.pathname.toLowerCase();
  }

  if (shouldAddTrailingSlash(url.pathname)) {
    url.pathname = `${url.pathname}/`;
  }

  return url.toString();
}

function isNoindexPath(pathname: string): boolean {
  const normalizedPath = pathname.toLowerCase();
  return (
    ERROR_DOCUMENT_PATHS.has(normalizedPath) ||
    normalizedPath === SECURITY_TXT_PATH ||
    NOINDEX_PATH_PREFIXES.some((prefix) => normalizedPath.startsWith(prefix))
  );
}

function isCrawlerUtilityPath(pathname: string): boolean {
  return (
    pathname === "/robots.txt" ||
    pathname === "/feed.xml" ||
    pathname === "/image-sitemap.xml" ||
    pathname === "/llms.txt" ||
    pathname === "/llms-full.txt" ||
    pathname === "/sitemap-index.xml" ||
    /^\/sitemap-\d+\.xml$/.test(pathname)
  );
}

function crawlerLabel(userAgent: string): string | null {
  for (const crawler of SEO_CRAWLER_USER_AGENTS) {
    if (crawler.pattern.test(userAgent)) return crawler.label;
  }

  return null;
}

function logSeoAccess(request: Request, url: URL, response: Response): void {
  const userAgent = request.headers.get("User-Agent") || "";
  const crawler = crawlerLabel(userAgent);
  const shouldLog =
    Boolean(crawler) ||
    response.status >= 500 ||
    (response.status >= 400 && isCrawlerUtilityPath(url.pathname));

  if (!shouldLog) return;

  const cf = (request as RequestWithCloudflareContext).cf;

  console.log(
    JSON.stringify({
      cacheControl: response.headers.get("Cache-Control") || null,
      cfColo: sanitizeCfValue(cf?.colo),
      cfCountry: sanitizeCfValue(cf?.country),
      contentType:
        response.headers.get("Content-Type")?.split(";")[0]?.trim() || null,
      crawler,
      host: sanitizeHost(url.host),
      location: sanitizeHeaderValue(response.headers.get("Location")),
      method: request.method,
      path: sanitizePath(url.pathname),
      robots: response.headers.get("X-Robots-Tag") || null,
      status: response.status,
      type: "seo-access",
    }),
  );
}

function sanitizeCfValue(value: unknown): string | null {
  return typeof value === "string" && value ? value.slice(0, 32) : null;
}

function sanitizeHost(value: unknown): string | null {
  return typeof value === "string" && value
    ? value.toLowerCase().slice(0, 120)
    : null;
}

function sanitizeHeaderValue(value: unknown): string | null {
  return typeof value === "string" && value ? value.slice(0, 240) : null;
}

function isLongLivedAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_astro/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/images/") ||
    /^\/mentors\/[^/]+\.(jpg|png|webp|avif)$/.test(pathname) ||
    pathname.startsWith("/favicon/") ||
    pathname === "/favicon.ico" ||
    /^\/og-[^/]+\.png$/.test(pathname) ||
    /^\/google-deepmind-logo-[^/]+\.png$/.test(pathname) ||
    pathname === "/lbs-logo.svg" ||
    pathname === "/og-default.svg" ||
    pathname === "/site.webmanifest"
  );
}

function isIndexableImageAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/images/") ||
    /^\/mentors\/[^/]+\.(jpg|png|webp|avif)$/i.test(pathname) ||
    pathname.startsWith("/favicon/") ||
    pathname === "/favicon.ico" ||
    /^\/og-[^/]+\.png$/.test(pathname) ||
    /^\/google-deepmind-logo-[^/]+\.png$/.test(pathname) ||
    pathname === "/lbs-logo.svg" ||
    pathname === "/og-default.svg"
  );
}

function isHtmlResponse(headers: Headers): boolean {
  return headers.get("Content-Type")?.includes("text/html") ?? false;
}

function gone(): Response {
  const headers = new Headers({
    "Cache-Control": SHORT_CACHE_CONTROL,
    "Last-Modified": LAST_MODIFIED,
    "X-Robots-Tag": NOINDEX_ROBOTS,
  });

  setHeaders(headers, SECURITY_HEADERS);

  return new Response(null, {
    status: 410,
    statusText: "Gone",
    headers,
  });
}

function healthCheck(): Response {
  return json(
    {
      ok: true,
      service: "lbsailab",
      checkedAt: new Date().toISOString(),
    },
    200,
  );
}

function siteVerificationResponse(url: URL, env: WorkerEnv): Response | null {
  const googleFileName = siteVerificationGoogleFileName(
    env.GOOGLE_SITE_VERIFICATION_FILE,
  );

  if (googleFileName && url.pathname === `/${googleFileName}`) {
    return verificationText(`google-site-verification: ${googleFileName}\n`);
  }

  const bingToken = siteVerificationToken(env.BING_SITE_VERIFICATION_TOKEN);

  if (bingToken && url.pathname === BING_SITE_AUTH_PATH) {
    return verificationXml(
      `<?xml version="1.0"?>\n<users>\n  <user>${bingToken}</user>\n</users>\n`,
    );
  }

  return null;
}

function siteVerificationGoogleFileName(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const fileName = value.trim();

  return /^google[a-z0-9_-]+\.html$/i.test(fileName) ? fileName : null;
}

function siteVerificationToken(value: unknown): string | null {
  if (typeof value !== "string") return null;

  const token = value.trim();

  return /^[a-z0-9_-]{8,160}$/i.test(token) ? token : null;
}

function verificationText(body: string): Response {
  return verificationResponse(body, "text/plain; charset=utf-8");
}

function verificationXml(body: string): Response {
  return verificationResponse(body, "application/xml; charset=utf-8");
}

function verificationResponse(body: string, contentType: string): Response {
  const headers = new Headers({
    "Cache-Control": SHORT_CACHE_CONTROL,
    "Content-Language": CONTENT_LANGUAGE,
    "Content-Type": contentType,
    "Last-Modified": LAST_MODIFIED,
    "X-Robots-Tag": NOINDEX_ROBOTS,
  });

  setHeaders(headers, SECURITY_HEADERS);

  return new Response(body, {
    status: 200,
    headers,
  });
}

function indexNowKey(): Response {
  const headers = new Headers({
    "Cache-Control": SHORT_CACHE_CONTROL,
    "Content-Type": "text/plain; charset=utf-8",
    "Last-Modified": LAST_MODIFIED,
    "X-Robots-Tag": NOINDEX_ROBOTS,
  });

  setHeaders(headers, SECURITY_HEADERS);

  return new Response(INDEXNOW_KEY, {
    status: 200,
    headers,
  });
}

async function handleCreateApplication(
  request: Request,
  env: WorkerEnv,
): Promise<Response> {
  const contentLength = Number(request.headers.get("Content-Length") || "0");

  if (contentLength > MAX_APPLICATION_PAYLOAD_BYTES) {
    return json({ error: "Please submit the form again." }, 413);
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return json({ error: "Please submit the form again." }, 400);
  }

  if (asString(body.website)) {
    return json({ ok: true }, 202);
  }

  const submission = validateSubmission(body);
  if ("error" in submission) {
    return json({ error: submission.error }, 400);
  }

  try {
    await env.APPLICATIONS_DB.prepare(
      `INSERT INTO applications (submitted_at, name, email, course, idea)
       VALUES (?1, ?2, ?3, ?4, ?5)`,
    )
      .bind(
        new Date().toISOString(),
        submission.name,
        submission.email,
        submission.course,
        submission.idea,
      )
      .run();

    return json({ ok: true }, 201);
  } catch (error) {
    logApplicationStorageError("write", error);
    return json(
      { error: "Applications are temporarily unavailable. Please try again." },
      503,
    );
  }
}

function toPublicApplication(row: PublicApplication): PublicApplication {
  return {
    submittedAt: row.submittedAt,
    name: row.name,
    course: row.course,
    idea: row.idea,
  };
}

async function handleListApplications(env: WorkerEnv): Promise<Response> {
  try {
    const result = await env.APPLICATIONS_DB.prepare(
      `SELECT submitted_at AS "submittedAt", name, course, idea
       FROM applications
       ORDER BY submitted_at DESC, id ASC
       LIMIT ?1`,
    )
      .bind(APPLICATIONS_QUERY_LIMIT)
      .all<PublicApplication>();

    return json(
      {
        applications: result.results.map((row) => toPublicApplication(row)),
      },
      200,
    );
  } catch (error) {
    logApplicationStorageError("read", error);
    return json(
      {
        error: "Submissions are temporarily unavailable. Please try again.",
        applications: [],
      },
      503,
    );
  }
}

async function handleVitals(request: Request): Promise<Response> {
  const contentLength = Number(request.headers.get("Content-Length") || "0");

  if (contentLength > MAX_VITALS_PAYLOAD_BYTES) {
    return noContent();
  }

  let payload: WebVitalsPayload;

  try {
    payload = (await request.json()) as WebVitalsPayload;
  } catch {
    return noContent();
  }

  const metrics = sanitizeVitals(payload.metrics);

  if (metrics.length) {
    console.log(
      JSON.stringify({
        connectionType: sanitizeConnectionType(payload.connectionType),
        metrics,
        navigationType: sanitizeNavigationType(payload.navigationType),
        path: sanitizePath(payload.path),
        saveData: sanitizeSaveData(payload.saveData),
        type: "web-vitals",
        viewport: sanitizeViewport(payload.viewport),
        visibilityState: sanitizeVisibilityState(payload.visibilityState),
      }),
    );
  }

  return noContent();
}

function sanitizeVitals(metrics: WebVitalsPayload["metrics"]) {
  if (!Array.isArray(metrics)) return [];

  const allowedNames = new Set(["CLS", "FCP", "INP", "LCP", "TTFB"]);

  return metrics
    .map((metric) => ({
      name: typeof metric.name === "string" ? metric.name : "",
      value: typeof metric.value === "number" ? metric.value : Number.NaN,
    }))
    .filter(
      (metric) =>
        allowedNames.has(metric.name) &&
        Number.isFinite(metric.value) &&
        metric.value >= 0 &&
        metric.value < 120000,
    )
    .slice(0, 5);
}

function sanitizePath(path: unknown): string {
  const value = typeof path === "string" ? path : "/";

  return value.startsWith("/") && !value.startsWith("//")
    ? value.slice(0, 160)
    : "/";
}

function sanitizeNavigationType(value: unknown): string {
  const type = typeof value === "string" ? value : "navigate";
  return ["back_forward", "navigate", "prerender", "reload"].includes(type)
    ? type
    : "navigate";
}

function sanitizeConnectionType(value: unknown): string {
  const type = typeof value === "string" ? value : "unknown";
  return ["slow-2g", "2g", "3g", "4g", "unknown"].includes(type)
    ? type
    : "unknown";
}

function sanitizeSaveData(value: unknown): boolean {
  return value === true;
}

function sanitizeViewport(value: unknown): string {
  const viewport = typeof value === "string" ? value : "unknown";
  return ["mobile", "tablet", "desktop", "unknown"].includes(viewport)
    ? viewport
    : "unknown";
}

function sanitizeVisibilityState(value: unknown): string {
  const state = typeof value === "string" ? value : "hidden";
  return ["hidden", "visible"].includes(state) ? state : "hidden";
}

function validateSubmission(
  body: Record<string, unknown>,
): ApplicationSubmission | { error: string } {
  const name = asString(body.name).slice(0, 120);
  const email = asString(body.lbs_email).toLowerCase().slice(0, 180);
  const course = asString(body.course_name).slice(0, 80);
  const idea = asString(body.build_interest).slice(0, 900);
  const consent = body.public_consent === "yes";

  if (!name) return { error: "Please enter your name." };
  if (!/^[^@\s]+@london\.edu$/.test(email)) {
    return { error: "Please use your LBS email address." };
  }
  if (!course) return { error: "Please enter your course." };
  if (!idea) return { error: "Please share what you would like to build." };
  if (!consent) {
    return {
      error:
        "Please confirm that your name, course, and idea can be shown to other LBS builders.",
    };
  }

  return { name, email, course, idea };
}

function logApplicationStorageError(
  operation: "read" | "write",
  error: unknown,
): void {
  console.error(
    JSON.stringify({
      error: errorMessage(error).slice(0, 240),
      operation,
      type: "application-storage-error",
    }),
  );
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : "Something went wrong. Please try again.";
}

function json(body: unknown, status = 200): Response {
  const headers = new Headers(jsonHeaders);
  setHeaders(headers, SECURITY_HEADERS);

  return new Response(JSON.stringify(body), {
    status,
    headers,
  });
}

function noContent(
  status = 204,
  headerValues: Record<string, string> = {},
): Response {
  const headers = new Headers({
    "Cache-Control": "no-store",
    "X-Robots-Tag": NOINDEX_ROBOTS,
    ...headerValues,
  });
  setHeaders(headers, SECURITY_HEADERS);

  return new Response(null, {
    status,
    headers,
  });
}
