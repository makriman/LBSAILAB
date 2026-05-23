interface Env {
  ASSETS: {
    fetch(request: Request): Promise<Response>;
  };
  GOOGLE_PRIVATE_KEY?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SHEET_ID?: string;
  GOOGLE_SHEET_NAME?: string;
}

interface ApplicationSubmission {
  name: string;
  email: string;
  course: string;
  idea: string;
  consent: boolean;
}

const SHEETS_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const SHEETS_API = "https://sheets.googleapis.com/v4/spreadsheets";
const DEFAULT_SHEET_NAME = "Submissions";

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
  const setupError = validateGoogleSetup(env);
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
    await appendSubmission(env, submission);
    return json({ ok: true }, 201);
  } catch (error) {
    return json({ error: errorMessage(error) }, 502);
  }
}

async function handleListApplications(env: Env): Promise<Response> {
  const setupError = validateGoogleSetup(env);
  if (setupError) return setupError;

  try {
    const accessToken = await getAccessToken(env);
    const sheetName = env.GOOGLE_SHEET_NAME || DEFAULT_SHEET_NAME;
    const range = encodeURIComponent(`${quoteSheetName(sheetName)}!A2:G`);
    const response = await fetch(
      `${SHEETS_API}/${env.GOOGLE_SHEET_ID}/values/${range}?majorDimension=ROWS`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    if (!response.ok) {
      throw new Error(await googleError(response));
    }

    const data = (await response.json()) as { values?: string[][] };
    const applications = (data.values || [])
      .map(([submittedAt, name, email, course, idea, consent]) => ({
        submittedAt,
        name,
        email,
        course,
        idea,
        consent,
      }))
      .filter((row) => row.name && row.email && row.course && row.idea)
      .filter((row) => row.consent === "yes")
      .map(({ submittedAt, name, email, course, idea }) => ({
        submittedAt,
        name,
        email,
        course,
        idea,
      }))
      .reverse();

    return json({ applications }, 200);
  } catch (error) {
    return json({ error: errorMessage(error) }, 502);
  }
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

async function appendSubmission(
  env: Env,
  submission: ApplicationSubmission,
): Promise<void> {
  const accessToken = await getAccessToken(env);
  const sheetName = env.GOOGLE_SHEET_NAME || DEFAULT_SHEET_NAME;
  const range = encodeURIComponent(`${quoteSheetName(sheetName)}!A:G`);
  const response = await fetch(
    `${SHEETS_API}/${env.GOOGLE_SHEET_ID}/values/${range}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        values: [
          [
            new Date().toISOString(),
            submission.name,
            submission.email,
            submission.course,
            submission.idea,
            submission.consent ? "yes" : "no",
            "apply-page",
          ],
        ],
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await googleError(response));
  }
}

async function getAccessToken(env: Env): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    scope: SHEETS_SCOPE,
    aud: TOKEN_URL,
    exp: now + 3600,
    iat: now,
  };
  const unsignedToken = `${base64Url(JSON.stringify(header))}.${base64Url(
    JSON.stringify(claim),
  )}`;
  const key = await importPrivateKey(env.GOOGLE_PRIVATE_KEY || "");
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(unsignedToken),
  );
  const assertion = `${unsignedToken}.${base64Url(signature)}`;
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    throw new Error(await googleError(response));
  }

  const data = (await response.json()) as { access_token?: string };
  if (!data.access_token) {
    throw new Error("Google did not return an access token.");
  }

  return data.access_token;
}

async function importPrivateKey(privateKey: string): Promise<CryptoKey> {
  const pem = privateKey.replace(/\\n/g, "\n").trim();
  const encoded = pem
    .replace("-----BEGIN PRIVATE KEY-----", "")
    .replace("-----END PRIVATE KEY-----", "")
    .replace(/\s/g, "");
  const bytes = Uint8Array.from(atob(encoded), (char) => char.charCodeAt(0));

  return crypto.subtle.importKey(
    "pkcs8",
    bytes.buffer,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
}

function validateGoogleSetup(env: Env): Response | null {
  if (
    env.GOOGLE_PRIVATE_KEY &&
    env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
    env.GOOGLE_SHEET_ID
  ) {
    return null;
  }

  return json(
    {
      error:
        "Google Sheets is not configured yet. Add GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, and GOOGLE_PRIVATE_KEY to the Worker environment.",
    },
    503,
  );
}

function quoteSheetName(sheetName: string): string {
  return `'${sheetName.replace(/'/g, "''")}'`;
}

function base64Url(input: string | ArrayBuffer): string {
  const bytes =
    typeof input === "string"
      ? new TextEncoder().encode(input)
      : new Uint8Array(input);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function googleError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      error?: { message?: string };
      error_description?: string;
    };
    return (
      data.error?.message ||
      data.error_description ||
      `Google request failed with ${response.status}.`
    );
  } catch {
    return `Google request failed with ${response.status}.`;
  }
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
