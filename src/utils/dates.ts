const longFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

const compactFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
});

const monthFormatter = new Intl.DateTimeFormat("en-GB", {
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function parseDate(value: string) {
  if (/^\d{4}-\d{2}$/.test(value)) {
    return new Date(`${value}-01T00:00:00.000Z`);
  }

  return new Date(`${value}T00:00:00.000Z`);
}

export function formatDate(value: string) {
  if (/^\d{4}-\d{2}$/.test(value)) {
    return monthFormatter.format(parseDate(value));
  }

  return longFormatter.format(parseDate(value));
}

export function formatDateRange(startsAt: string, endsAt?: string | null) {
  if (!endsAt) {
    return `Starts ${formatDate(startsAt)}`;
  }

  const start = parseDate(startsAt);
  const end = parseDate(endsAt);

  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${compactFormatter.format(start)} - ${longFormatter.format(end)}`;
  }

  return `${longFormatter.format(start)} - ${longFormatter.format(end)}`;
}

export function formatShortDateRange(startsAt: string, endsAt?: string | null) {
  if (!endsAt) {
    return `Starts ${formatDate(startsAt)}`;
  }

  const start = parseDate(startsAt);
  const end = parseDate(endsAt);

  if (start.getUTCFullYear() === end.getUTCFullYear()) {
    return `${compactFormatter.format(start)} - ${compactFormatter.format(end)} ${end.getUTCFullYear()}`;
  }

  return `${compactFormatter.format(start)} ${start.getUTCFullYear()} - ${compactFormatter.format(end)} ${end.getUTCFullYear()}`;
}
