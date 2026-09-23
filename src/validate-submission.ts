export interface ApplicationSubmission {
  name: string;
  email: string;
  course: string;
  idea: string;
}

export const APPLICATION_NAME_MAX_LENGTH = 120;
export const APPLICATION_EMAIL_MAX_LENGTH = 180;
export const APPLICATION_COURSE_MAX_LENGTH = 80;
export const APPLICATION_IDEA_MAX_LENGTH = 900;

export function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function validateSubmission(
  body: Record<string, unknown>,
): ApplicationSubmission | { error: string } {
  const name = asString(body.name).slice(0, APPLICATION_NAME_MAX_LENGTH);
  const email = asString(body.lbs_email)
    .toLowerCase()
    .slice(0, APPLICATION_EMAIL_MAX_LENGTH);
  const course = asString(body.course_name).slice(
    0,
    APPLICATION_COURSE_MAX_LENGTH,
  );
  const idea = asString(body.build_interest).slice(
    0,
    APPLICATION_IDEA_MAX_LENGTH,
  );
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
