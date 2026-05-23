interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  APPS_SCRIPT_TOKEN?: string;
  APPS_SCRIPT_URL?: string;
}

interface ApplicationSubmission {
  name: string;
  email: string;
  course: string;
  idea: string;
  consent: boolean;
}

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
  const setupError = validateAppsScriptSetup(env);
  if (setupError) return setupError;

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
    await callAppsScript(env, "create", submission);
    return json({ ok: true }, 201);
  } catch (error) {
    return json({ error: errorMessage(error) }, 502);
  }
}

async function handleListApplications(env: Env): Promise<Response> {
  const setupError = validateAppsScriptSetup(env);
  if (setupError) return setupError;

  try {
    const data = await callAppsScript(env, "list");
    return json({ applications: data.applications || [] }, 200);
  } catch (error) {
    return json({ error: errorMessage(error) }, 502);
  }
}

async function callAppsScript(
  env: Env,
  action: "create" | "list",
  payload?: ApplicationSubmission,
): Promise<{ applications?: unknown[] }> {
  const url = new URL(env.APPS_SCRIPT_URL || "");
  url.searchParams.set("token", env.APPS_SCRIPT_TOKEN || "");
  url.searchParams.set("action", action);

  const response = await fetch(url.toString(), {
    method: action === "create" ? "POST" : "GET",
    headers:
      action === "create"
        ? {
            "Content-Type": "text/plain;charset=utf-8",
          }
        : undefined,
    body:
      action === "create"
        ? JSON.stringify({
            name: payload?.name,
            email: payload?.email,
            course: payload?.course,
            idea: payload?.idea,
            publicConsent: payload?.consent ? "yes" : "no",
            source: "apply-page",
          })
        : undefined,
  });

  const data = (await response.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    applications?: unknown[];
  };

  if (!response.ok || data.ok === false) {
    throw new Error(
      data.error || `Applications endpoint failed with ${response.status}.`,
    );
  }

  return data;
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

function validateAppsScriptSetup(env: Env): Response | null {
  if (env.APPS_SCRIPT_URL && env.APPS_SCRIPT_TOKEN) {
    return null;
  }

  return json(
    {
      error:
        "Applications are not configured yet. Add APPS_SCRIPT_URL and APPS_SCRIPT_TOKEN to the Worker environment.",
    },
    503,
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
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}
