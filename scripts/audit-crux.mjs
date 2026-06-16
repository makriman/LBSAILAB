const SITE_URL = process.env.SEO_SITE_URL || "https://lbsailab.com";
const SITE_ORIGIN = new URL(SITE_URL).origin;
const CRUX_API =
  process.env.CRUX_API ||
  "https://chromeuxreport.googleapis.com/v1/records:queryRecord";
const HAS_CRUX_API_KEY = Boolean(process.env.CRUX_API_KEY);
const REQUIRE_CRUX = process.env.CRUX_REQUIRED === "1";
const REQUIRE_CRUX_DATA = process.env.CRUX_REQUIRE_DATA === "1";
const FORM_FACTORS = (process.env.CRUX_FORM_FACTORS || "PHONE,DESKTOP")
  .split(",")
  .map((formFactor) => formFactor.trim().toUpperCase())
  .filter(Boolean);
const FIELD_METRICS = {
  cumulative_layout_shift: {
    label: "CLS",
    maximum: 0.1,
  },
  interaction_to_next_paint: {
    label: "INP",
    maximum: 200,
  },
  largest_contentful_paint: {
    label: "LCP",
    maximum: 2500,
  },
};
const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function targets() {
  const configured = (process.env.CRUX_URLS || "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);

  if (configured.length) {
    return configured.map((url) => ({
      key: "url",
      value: new URL(url, SITE_ORIGIN).toString(),
    }));
  }

  return [{ key: "origin", value: SITE_ORIGIN }];
}

function cruxUrl() {
  const endpoint = new URL(CRUX_API);
  endpoint.searchParams.set("key", process.env.CRUX_API_KEY || "");
  return endpoint;
}

async function fetchCruxRecord(target, formFactor) {
  const response = await fetch(cruxUrl(), {
    body: JSON.stringify({
      [target.key]: target.value,
      formFactor,
      metrics: Object.keys(FIELD_METRICS),
    }),
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "User-Agent": "lbsailab-crux-monitor/1.0",
    },
    method: "POST",
    signal: AbortSignal.timeout(Number(process.env.CRUX_TIMEOUT_MS || "30000")),
  });
  const body = await response.text();

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(
      `CrUX API returned ${response.status}: ${body.slice(0, 400)}`,
    );
  }

  return JSON.parse(body);
}

function percentileValue(record, metricName) {
  const raw = record.record?.metrics?.[metricName]?.percentiles?.p75;
  const value = typeof raw === "number" ? raw : Number(raw);

  return Number.isFinite(value) ? value : null;
}

function auditRecord(record, target, formFactor) {
  const source =
    record.record?.key?.url || record.record?.key?.origin || target.value;
  const collectionPeriod = record.record?.collectionPeriod || {};
  const summary = [];

  if (!source.startsWith(SITE_ORIGIN)) {
    fail(
      `${target.value} ${formFactor}: CrUX record source is not canonical (${source})`,
    );
  }

  for (const [metricName, config] of Object.entries(FIELD_METRICS)) {
    const p75 = percentileValue(record, metricName);

    if (p75 === null) {
      fail(
        `${target.value} ${formFactor}: missing CrUX p75 for ${config.label}`,
      );
      continue;
    }

    summary.push(`${config.label} p75 ${p75}`);

    if (p75 > config.maximum) {
      fail(
        `${target.value} ${formFactor}: CrUX ${config.label} p75 ${p75} exceeds ${config.maximum}`,
      );
    }
  }

  console.log(
    `${target.value} ${formFactor}: ${summary.join(", ")}; collection ${collectionPeriod.firstDate?.year || "?"}-${collectionPeriod.firstDate?.month || "?"}-${collectionPeriod.firstDate?.day || "?"} to ${collectionPeriod.lastDate?.year || "?"}-${collectionPeriod.lastDate?.month || "?"}-${collectionPeriod.lastDate?.day || "?"}`,
  );
}

async function auditCrux() {
  if (!HAS_CRUX_API_KEY) {
    const message =
      "CrUX audit skipped because CRUX_API_KEY is not configured. Set CRUX_API_KEY for scheduled field-data monitoring.";

    if (REQUIRE_CRUX) {
      fail(message);
      console.error("CrUX Core Web Vitals audit failed:");
      for (const failure of failures) console.error(`- ${failure}`);
      process.exit(1);
    } else {
      console.warn(message);
      return;
    }
  }

  for (const target of targets()) {
    for (const formFactor of FORM_FACTORS) {
      try {
        const record = await fetchCruxRecord(target, formFactor);

        if (!record) {
          const message = `${target.value} ${formFactor}: no CrUX field data available`;

          if (REQUIRE_CRUX_DATA) {
            fail(message);
          } else {
            warn(message);
          }

          continue;
        }

        auditRecord(record, target, formFactor);
      } catch (error) {
        fail(
          `${target.value} ${formFactor}: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  if (warnings.length) {
    console.warn("CrUX audit warnings:");
    for (const warning of warnings) console.warn(`- ${warning}`);
  }

  if (failures.length) {
    console.error("CrUX Core Web Vitals audit failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log("CrUX Core Web Vitals audit passed.");
}

auditCrux().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
