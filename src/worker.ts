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

const DEFAULT_BRANCH = "main";
const DEFAULT_REPO = "makriman/LBSAILAB";
const DEFAULT_SUBMISSIONS_PATH = "data/application-submissions.md";
const GITHUB_API = "https://api.github.com";
const INSERT_MARKER = "<!-- APPLICATIONS:START -->";
const END_MARKER = "<!-- APPLICATIONS:END -->";
const APPLICATION_RE = /<!-- application:(.*?) -->/gs;
const APPLICATIONS_CACHE_KEY_VERSION = "2026-05-23-prefill-csv-submissions";
const APPLICATIONS_CACHE_TTL_SECONDS = 60 * 60 * 24;
const CANONICAL_HOST = "lbsailab.com";
const INDEXNOW_KEY = "5e5bfddcc11447d381079b24b2d1e213";
const INDEXNOW_KEY_PATH = `/${INDEXNOW_KEY}.txt`;
const INDEXABLE_ROBOTS = "index, follow, max-image-preview:large";
const NOINDEX_ROBOTS = "noindex, nofollow";
const SHORT_CACHE_CONTROL = "public, max-age=300, must-revalidate";
const LONG_CACHE_CONTROL = "public, max-age=31536000, immutable";
const SECURITY_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  "Strict-Transport-Security": "max-age=31536000",
};
const GONE_PATHS = new Set([
  "/images/lbs-ai-lab-workshop-hero.png",
  "/mentors/rhea-bisaria.png",
]);
const NOINDEX_PATH_PREFIXES = [
  "/admin/",
  "/cart/",
  "/checkout/",
  "/healthz",
  "/internal/",
  "/login/",
  "/private/",
  "/search/",
];
const TRACKING_PARAM_NAMES = new Set([
  "dclid",
  "fbclid",
  "gclid",
  "igshid",
  "mc_cid",
  "mc_eid",
  "msclkid",
  "ref",
  "ref_src",
]);
const LEGACY_REDIRECTS = new Map([
  ["/home", "/"],
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
    const canonicalRedirect = canonicalRedirectResponse(request, url);

    if (canonicalRedirect) return canonicalRedirect;
    if (GONE_PATHS.has(url.pathname)) return gone();
    if (url.pathname === INDEXNOW_KEY_PATH) return indexNowKey();
    if (url.pathname === "/healthz") return healthCheck();

    if (url.pathname === "/api/applications") {
      if (request.method === "GET") {
        return handleListApplications(env);
      }

      if (request.method === "POST") {
        return handleCreateApplication(request, env);
      }

      return json({ error: "Method not allowed" }, 405);
    }

    return withSeoHeaders(await env.ASSETS.fetch(request), url.pathname);
  },
};

function canonicalRedirectResponse(
  request: Request,
  url: URL,
): Response | null {
  if (!["GET", "HEAD"].includes(request.method)) return null;
  if (url.pathname.startsWith("/api/")) return null;

  const legacyDestination = legacyRedirectDestination(url.pathname);
  const cleanedSearch = canonicalSearch(url.searchParams);

  if (legacyDestination) {
    const redirectUrl = canonicalUrl(url);
    redirectUrl.pathname = legacyDestination.pathname;
    redirectUrl.search = legacyDestination.search || cleanedSearch;
    redirectUrl.hash = legacyDestination.hash;
    return permanentRedirect(redirectUrl);
  }

  const redirectUrl = canonicalUrl(url);
  redirectUrl.search = cleanedSearch;

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

function canonicalSearch(searchParams: URLSearchParams): string {
  const cleanedParams = new URLSearchParams();

  for (const [name, value] of searchParams) {
    if (isTrackingParam(name)) continue;

    cleanedParams.append(name, value);
  }

  const cleaned = cleanedParams.toString();
  return cleaned ? `?${cleaned}` : "";
}

function isTrackingParam(name: string): boolean {
  const normalized = name.toLowerCase();

  return (
    normalized.startsWith("utm_") ||
    normalized.startsWith("_hs") ||
    TRACKING_PARAM_NAMES.has(normalized)
  );
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

  const lastSegment = pathname.split("/").at(-1) ?? "";
  return !lastSegment.includes(".");
}

function shouldNormalizePathCase(pathname: string): boolean {
  const lastSegment = pathname.split("/").at(-1) ?? "";
  return !lastSegment.includes(".");
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

  headers.set("Cache-Control", cacheControlFor(pathname, headers));

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

function isNoindexPath(pathname: string): boolean {
  const normalizedPath = pathname.toLowerCase();
  return NOINDEX_PATH_PREFIXES.some((prefix) =>
    normalizedPath.startsWith(prefix),
  );
}

function isCrawlerUtilityPath(pathname: string): boolean {
  return (
    pathname === "/robots.txt" ||
    pathname === "/feed.xml" ||
    pathname === "/image-sitemap.xml" ||
    pathname === "/sitemap-index.xml" ||
    /^\/sitemap-\d+\.xml$/.test(pathname)
  );
}

function isLongLivedAsset(pathname: string): boolean {
  return (
    pathname.startsWith("/_astro/") ||
    pathname.startsWith("/assets/") ||
    pathname.startsWith("/images/") ||
    /^\/mentors\/[^/]+\.(jpg|png|webp|avif)$/.test(pathname) ||
    pathname.startsWith("/favicon/") ||
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
