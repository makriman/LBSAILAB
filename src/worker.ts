interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  GITHUB_BRANCH?: string;
  GITHUB_REPO?: string;
  GITHUB_SUBMISSIONS_PATH?: string;
  GITHUB_TOKEN?: string;
}

interface ApplicationSubmission {
  name: string;
  email: string;
  course: string;
  idea: string;
  consent: boolean;
}

interface GitHubFile {
  content: string;
  sha?: string;
}

interface WebVitalsPayload {
  metrics?: Array<{
    name?: unknown;
    value?: unknown;
  }>;
  navigationType?: unknown;
  path?: unknown;
  visibilityState?: unknown;
}

interface RequestWithCloudflareContext extends Request {
  cf?: {
    colo?: unknown;
    country?: unknown;
  };
}

const DEFAULT_BRANCH = "main";
const DEFAULT_REPO = "makriman/LBSAILAB";
const DEFAULT_SUBMISSIONS_PATH = "data/application-submissions.md";
const GITHUB_API = "https://api.github.com";
const INSERT_MARKER = "<!-- APPLICATIONS:START -->";
const END_MARKER = "<!-- APPLICATIONS:END -->";
const APPLICATION_RE = /<!-- application:(.*?) -->/gs;
const APPLICATIONS_CACHE_KEY_VERSION = "2026-05-23-prefill-csv-submissions";
const APPLICATIONS_CACHE_TTL_SECONDS = 60 * 60 * 24;
const MAX_VITALS_PAYLOAD_BYTES = 4096;
const CANONICAL_HOST = "lbsailab.com";
const INDEXNOW_KEY = "5e5bfddcc11447d381079b24b2d1e213";
const INDEXNOW_KEY_PATH = `/${INDEXNOW_KEY}.txt`;
const SECURITY_TXT_PATH = "/.well-known/security.txt";
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
    "default-src 'self'; base-uri 'self'; object-src 'none'; img-src 'self' data:; script-src 'self' 'sha256-gjeSSMIXG9BbI3JOaYbZjuKjgLQWtyZzrKeJWWpTW5w=' 'sha256-hOeIS+zI+pi2hvQgqdLeHjnvLrtBFskwEPrfv8fVKks=' 'sha256-7N/6kzpAEcU9XVA3Q1vOiFuNNeInJvanrCIhejjujMY=' https://static.cloudflareinsights.com; script-src-attr 'none'; style-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self' https://cloudflareinsights.com; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests",
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
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const response = await handleRequest(request, env, url);

    logSeoAccess(request, url, response);

    return response;
  },
};

async function handleRequest(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  const canonicalRedirect = canonicalRedirectResponse(request, url);

  if (canonicalRedirect) return canonicalRedirect;
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
  env: Env,
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
  env: Env,
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
  } else if (isHtmlResponse(headers)) {
    headers.set("X-Robots-Tag", INDEXABLE_ROBOTS);
  }

  if (pathname === "/feed.xml") {
    headers.set("Content-Type", "application/atom+xml; charset=utf-8");
  }

  if (shouldSetContentLanguage(pathname, headers, response.status)) {
    headers.set("Content-Language", CONTENT_LANGUAGE);
  }

  headers.set("Cache-Control", cacheControlFor(pathname, headers));

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

function cacheControlFor(pathname: string, headers: Headers): string {
  if (isLongLivedAsset(pathname)) return LONG_CACHE_CONTROL;
  if (isHtmlResponse(headers)) return SHORT_CACHE_CONTROL;

  return SHORT_CACHE_CONTROL;
}

function shouldSetLastModified(
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

function isLongLivedAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_astro/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/images/") ||
    /^\/mentors\/[^/]+\.(jpg|png|webp|avif)$/.test(pathname) ||
    pathname.startsWith("/favicon/") ||
    pathname === "/favicon.ico" ||
    pathname === "/favicon.svg" ||
    /^\/og-[^/]+\.png$/.test(pathname) ||
    /^\/google-deepmind-logo-[^/]+\.png$/.test(pathname) ||
    pathname === "/lbs-logo.svg" ||
    pathname === "/og-default.svg" ||
    pathname === "/site.webmanifest"
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
  env: Env,
): Promise<Response> {
  if (!env.GITHUB_TOKEN) {
    return json(
      {
        error:
          "Applications are not configured yet. Add GITHUB_TOKEN to the Worker environment.",
      },
      503,
    );
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
    const applications = await appendSubmission(env, submission);
    await writeCachedApplications(env, applications);
    return json({ ok: true }, 201);
  } catch (error) {
    return json({ error: errorMessage(error) }, 502);
  }
}

async function handleListApplications(env: Env): Promise<Response> {
  try {
    const cachedApplications = await readCachedApplications(env);
    if (cachedApplications) {
      return json({ applications: cachedApplications }, 200);
    }

    const file = await readSubmissionsFile(env, Boolean(env.GITHUB_TOKEN));
    const applications = parseApplications(file.content);
    await writeCachedApplications(env, applications);
    return json({ applications }, 200);
  } catch (error) {
    return json({ error: errorMessage(error), applications: [] }, 200);
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
        metrics,
        navigationType: sanitizeNavigationType(payload.navigationType),
        path: sanitizePath(payload.path),
        type: "web-vitals",
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

function sanitizeVisibilityState(value: unknown): string {
  const state = typeof value === "string" ? value : "hidden";
  return ["hidden", "visible"].includes(state) ? state : "hidden";
}

async function appendSubmission(
  env: Env,
  submission: ApplicationSubmission,
): Promise<unknown[]> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const file = await readSubmissionsFile(env, true);
    const nextContent = insertSubmission(file.content, submission);
    const response = await putSubmissionsFile(env, nextContent, file.sha);

    if (response.ok) return parseApplications(nextContent);

    if (response.status !== 409 || attempt === 1) {
      throw new Error(await githubError(response));
    }
  }

  throw new Error("Submission failed. Please try again.");
}

async function readCachedApplications(env: Env): Promise<unknown[] | null> {
  const cache = defaultCache();
  if (!cache) return null;

  try {
    const cached = await cache.match(applicationsCacheRequest(env));
    if (!cached) return null;

    const data = (await cached.json()) as { applications?: unknown[] };
    return Array.isArray(data.applications) ? data.applications : null;
  } catch {
    return null;
  }
}

async function writeCachedApplications(
  env: Env,
  applications: unknown[],
): Promise<void> {
  const cache = defaultCache();
  if (!cache) return;

  try {
    await cache.put(
      applicationsCacheRequest(env),
      new Response(JSON.stringify({ applications }), {
        headers: {
          "Cache-Control": `public, max-age=${APPLICATIONS_CACHE_TTL_SECONDS}`,
          "Content-Type": "application/json; charset=utf-8",
          Expires: new Date(
            Date.now() + APPLICATIONS_CACHE_TTL_SECONDS * 1000,
          ).toUTCString(),
        },
      }),
    );
  } catch {
    // The public GitHub file remains the source of truth if edge caching fails.
  }
}

function defaultCache(): Cache | null {
  if (typeof caches === "undefined") return null;

  return (caches as CacheStorage & { default?: Cache }).default || null;
}

async function readSubmissionsFile(
  env: Env,
  useAuth: boolean,
): Promise<GitHubFile> {
  const config = githubConfig(env);
  const response = await fetch(
    `${GITHUB_API}/repos/${config.repo}/contents/${config.path}?ref=${config.branch}`,
    {
      headers: githubHeaders(env, useAuth),
    },
  );

  if (response.status === 404) {
    return { content: initialSubmissionsFile() };
  }

  if (!response.ok) {
    throw new Error(await githubError(response));
  }

  const data = (await response.json()) as { content?: string; sha?: string };
  const content = data.content ? decodeBase64(data.content) : "";

  return {
    content: content || initialSubmissionsFile(),
    sha: data.sha,
  };
}

async function putSubmissionsFile(
  env: Env,
  content: string,
  sha?: string,
): Promise<Response> {
  const config = githubConfig(env);
  return fetch(`${GITHUB_API}/repos/${config.repo}/contents/${config.path}`, {
    method: "PUT",
    headers: githubHeaders(env, true),
    body: JSON.stringify({
      branch: config.branch,
      content: encodeBase64(content),
      message: "Add AI Lab application submission",
      sha,
    }),
  });
}

function insertSubmission(
  content: string,
  submission: ApplicationSubmission,
): string {
  const safeSubmission = {
    submittedAt: new Date().toISOString(),
    name: submission.name,
    email: submission.email,
    course: submission.course,
    idea: submission.idea,
  };
  const block = [
    `<!-- application:${JSON.stringify(safeSubmission)} -->`,
    `### ${escapeMarkdown(submission.name)} - ${escapeMarkdown(
      submission.course,
    )}`,
    "",
    escapeMarkdown(submission.idea),
    "",
    `[Contact ${escapeMarkdown(
      submission.name,
    )}](mailto:${submission.email}?subject=${encodeURIComponent(
      `LBS AI Lab: exploring your ${submission.course} build idea`,
    )})`,
    "",
  ].join("\n");

  const base = content.includes(INSERT_MARKER)
    ? content
    : initialSubmissionsFile();

  return base.replace(INSERT_MARKER, `${INSERT_MARKER}\n\n${block}`);
}

function parseApplications(content: string): unknown[] {
  return [...content.matchAll(APPLICATION_RE)]
    .map((match) => {
      try {
        return JSON.parse(match[1]) as {
          submittedAt?: string;
          name?: string;
          email?: string;
          course?: string;
          idea?: string;
        };
      } catch {
        return null;
      }
    })
    .filter((item): item is Record<string, string> =>
      Boolean(
        item &&
        item.name &&
        item.email &&
        item.course &&
        item.idea &&
        /^[^@\s]+@london\.edu$/.test(item.email),
      ),
    );
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

  return { name, email, course, idea, consent };
}

function githubConfig(env: Env): {
  branch: string;
  path: string;
  repo: string;
} {
  return {
    branch: env.GITHUB_BRANCH || DEFAULT_BRANCH,
    path: env.GITHUB_SUBMISSIONS_PATH || DEFAULT_SUBMISSIONS_PATH,
    repo: env.GITHUB_REPO || DEFAULT_REPO,
  };
}

function applicationsCacheRequest(env: Env): Request {
  const config = githubConfig(env);
  const url = new URL("https://lbs-ai-lab.worker-cache/applications");
  url.searchParams.set("branch", config.branch);
  url.searchParams.set("path", config.path);
  url.searchParams.set("repo", config.repo);
  url.searchParams.set("version", APPLICATIONS_CACHE_KEY_VERSION);

  return new Request(url.toString());
}

function githubHeaders(env: Env, useAuth: boolean): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github+json",
    "User-Agent": "lbs-ai-lab-worker",
    "X-GitHub-Api-Version": "2022-11-28",
  };

  if (useAuth && env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${env.GITHUB_TOKEN}`;
  }

  return headers;
}

function initialSubmissionsFile(): string {
  return [
    "# LBS AI Lab Application Submissions",
    "",
    "Public submissions from participants who opted in on the Apply page.",
    "",
    INSERT_MARKER,
    "",
    END_MARKER,
    "",
  ].join("\n");
}

function escapeMarkdown(value: string): string {
  return value.replace(/[\\[\]`*_{}()#+.!|-]/g, "\\$&");
}

async function githubError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as { message?: string };
    return data.message || `GitHub request failed with ${response.status}.`;
  } catch {
    return `GitHub request failed with ${response.status}.`;
  }
}

function decodeBase64(value: string): string {
  const binary = atob(value.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function encodeBase64(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
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
