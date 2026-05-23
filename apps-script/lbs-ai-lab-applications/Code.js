const SHEET_NAME = "Submissions";

function configureApplicationToken(token) {
  if (!token || typeof token !== "string") {
    throw new Error("Token is required.");
  }

  PropertiesService.getScriptProperties().setProperty(
    "APPS_SCRIPT_TOKEN",
    token,
  );
  return "APPS_SCRIPT_TOKEN configured.";
}

function doGet(event) {
  if (!isAuthorized_(event)) {
    return json_({ ok: false, error: "Unauthorized" });
  }

  return json_({ ok: true, applications: listApplications_() });
}

function doPost(event) {
  if (isInitialConfigureRequest_(event)) {
    return configureInitialToken_(event);
  }

  if (!isAuthorized_(event)) {
    return json_({ ok: false, error: "Unauthorized" });
  }

  try {
    const payload = JSON.parse(event.postData.contents || "{}");
    const submission = validateSubmission_(payload);
    appendSubmission_(submission);
    return json_({ ok: true });
  } catch (error) {
    return json_({
      ok: false,
      error: error && error.message ? error.message : "Submission failed.",
    });
  }
}

function isInitialConfigureRequest_(event) {
  const existingToken =
    PropertiesService.getScriptProperties().getProperty("APPS_SCRIPT_TOKEN");
  return (
    !existingToken &&
    event &&
    event.parameter &&
    event.parameter.action === "configure"
  );
}

function configureInitialToken_(event) {
  try {
    const payload = JSON.parse(event.postData.contents || "{}");
    configureApplicationToken(payload.token);
    return json_({ ok: true });
  } catch (error) {
    return json_({
      ok: false,
      error:
        error && error.message ? error.message : "Token configuration failed.",
    });
  }
}

function listApplications_() {
  const sheet = getSheet_();
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) return [];

  const rows = sheet.getRange(2, 1, lastRow - 1, 7).getValues();

  return rows
    .map(([submittedAt, name, email, course, idea, publicConsent]) => ({
      submittedAt: normalizeCell_(submittedAt),
      name: normalizeCell_(name),
      email: normalizeCell_(email),
      course: normalizeCell_(course),
      idea: normalizeCell_(idea),
      publicConsent: normalizeCell_(publicConsent),
    }))
    .filter((row) => row.name && row.email && row.course && row.idea)
    .filter((row) => row.publicConsent === "yes")
    .map(({ submittedAt, name, email, course, idea }) => ({
      submittedAt,
      name,
      email,
      course,
      idea,
    }))
    .reverse();
}

function appendSubmission_(submission) {
  const sheet = getSheet_();
  ensureHeader_(sheet);
  sheet.appendRow([
    new Date().toISOString(),
    submission.name,
    submission.email,
    submission.course,
    submission.idea,
    "yes",
    submission.source || "apply-page",
  ]);
}

function validateSubmission_(payload) {
  const name = normalizeCell_(payload.name).slice(0, 120);
  const email = normalizeCell_(payload.email).toLowerCase().slice(0, 180);
  const course = normalizeCell_(payload.course).slice(0, 80);
  const idea = normalizeCell_(payload.idea).slice(0, 900);
  const publicConsent = normalizeCell_(payload.publicConsent);
  const source = normalizeCell_(payload.source).slice(0, 80);

  if (!name) throw new Error("Please enter your name.");
  if (!/^[^@\s]+@london\.edu$/.test(email)) {
    throw new Error("Please use your LBS email address.");
  }
  if (!course) throw new Error("Please enter your course.");
  if (!idea) throw new Error("Please share what you would like to build.");
  if (publicConsent !== "yes") {
    throw new Error("Please confirm that your submission can be shown.");
  }

  return { name, email, course, idea, source };
}

function getSheet_() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (sheet) return sheet;

  const createdSheet = spreadsheet.insertSheet(SHEET_NAME);
  ensureHeader_(createdSheet);
  return createdSheet;
}

function ensureHeader_(sheet) {
  const header = [
    "submitted_at",
    "name",
    "email",
    "course",
    "idea",
    "public_consent",
    "source",
  ];
  const existing = sheet.getRange(1, 1, 1, header.length).getValues()[0];
  const hasHeader = existing.every((value, index) => value === header[index]);

  if (!hasHeader) {
    sheet.getRange(1, 1, 1, header.length).setValues([header]);
    sheet.setFrozenRows(1);
  }
}

function isAuthorized_(event) {
  const expectedToken =
    PropertiesService.getScriptProperties().getProperty("APPS_SCRIPT_TOKEN");
  const actualToken = event && event.parameter && event.parameter.token;
  return Boolean(expectedToken && actualToken && expectedToken === actualToken);
}

function normalizeCell_(value) {
  return typeof value === "string" ? value.trim() : String(value || "").trim();
}

function json_(body) {
  return ContentService.createTextOutput(JSON.stringify(body)).setMimeType(
    ContentService.MimeType.JSON,
  );
}
