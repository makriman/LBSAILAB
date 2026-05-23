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
const APPLICATIONS_CACHE_TTL_SECONDS = 300;

const jsonHeaders = {
  "Content-Type": "application/json; charset=utf-8",
  "Cache-Control": "no-store",
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/applications") {
      if (request.method === "GET") {
        return handleListApplications(env);
      }

      if (request.method === "POST") {
        return handleCreateApplication(request, env);
      }

      return json({ error: "Method not allowed" }, 405);
    }

    return env.ASSETS.fetch(request);
  },
};

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
    "Public submissions from students who opted in on the Apply page.",
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
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}
