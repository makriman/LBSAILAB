import { Resolver } from "node:dns/promises";
import tls from "node:tls";

const SITE_URL = process.env.SEO_SITE_URL || "https://lbsailab.com";
const SITE = new URL(SITE_URL);
const SITE_ORIGIN = SITE.origin;
const SITE_HOST = SITE.host;
const PUBLIC_DNS_SERVERS = ["1.1.1.1", "8.8.8.8"];
const MIN_CERT_VALID_DAYS = 30;
const failures = [];
const resolver = new Resolver();

resolver.setServers(PUBLIC_DNS_SERVERS);

function fail(message) {
  failures.push(message);
}

async function publicARecords(hostname) {
  try {
    return await resolver.resolve4(hostname);
  } catch (error) {
    fail(`${hostname}: DNS A lookup failed (${error.code || error.message})`);
    return [];
  }
}

async function checkDns() {
  for (const hostname of [SITE_HOST, `www.${SITE_HOST}`]) {
    const records = await publicARecords(hostname);

    if (!records.length) fail(`${hostname}: no public A records`);
  }
}

function certificateFor(hostname) {
  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: hostname,
        port: 443,
        servername: hostname,
        timeout: 10000,
      },
      () => {
        const certificate = socket.getPeerCertificate();
        socket.end();
        resolve(certificate);
      },
    );

    socket.on("error", reject);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("TLS connection timed out"));
    });
  });
}

async function checkCertificate(hostname) {
  try {
    const certificate = await certificateFor(hostname);
    const validToMs = Date.parse(certificate.valid_to);
    const daysRemaining = Math.floor((validToMs - Date.now()) / 86400000);
    const subjectAltName = certificate.subjectaltname || "";

    if (Number.isNaN(validToMs)) {
      fail(`${hostname}: certificate valid_to is not parseable`);
      return;
    }

    if (daysRemaining < MIN_CERT_VALID_DAYS) {
      fail(`${hostname}: certificate expires in ${daysRemaining} days`);
    }

    if (!subjectAltName.includes(hostname)) {
      fail(`${hostname}: certificate SAN does not include hostname`);
    }
  } catch (error) {
    fail(
      `${hostname}: TLS certificate check failed (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

async function checkCertificates() {
  await Promise.all([
    checkCertificate(SITE_HOST),
    checkCertificate(`www.${SITE_HOST}`),
  ]);
}

async function head(url, redirect = "manual") {
  try {
    return await fetch(url, {
      method: "HEAD",
      redirect,
      headers: {
        "User-Agent": "lbsailab-seo-monitor/1.0",
      },
    });
  } catch (error) {
    fail(
      `${url}: request failed (${error instanceof Error ? error.message : String(error)})`,
    );
    return new Response("", { status: 599 });
  }
}

function expectHeader(response, url, name, expected) {
  const value = response.headers.get(name) || "";

  if (!value.includes(expected)) {
    fail(`${url}: expected ${name} to include "${expected}", got "${value}"`);
  }
}

async function checkStatus() {
  const checks = [
    [`${SITE_ORIGIN}/`, 200],
    [`${SITE_ORIGIN}/robots.txt`, 200],
    [`${SITE_ORIGIN}/sitemap-index.xml`, 200],
    [`${SITE_ORIGIN}/sitemap-0.xml`, 200],
    [`${SITE_ORIGIN}/image-sitemap.xml`, 200],
    [`${SITE_ORIGIN}/feed.xml`, 200],
    [`${SITE_ORIGIN}/.well-known/security.txt`, 200],
    [`${SITE_ORIGIN}/healthz`, 200],
    [`${SITE_ORIGIN}/api/applications`, 200],
    [`${SITE_ORIGIN}/images/lbs-ai-lab-workshop-hero.png`, 410],
    [`${SITE_ORIGIN}/missing-seo-monitor-page`, 404],
  ];

  for (const [url, expectedStatus] of checks) {
    const response = await head(url);

    if (response.status !== expectedStatus) {
      fail(`${url}: expected ${expectedStatus}, got ${response.status}`);
    }

    if (response.status >= 500) {
      fail(`${url}: returned 5xx status ${response.status}`);
    }
  }
}

async function checkRedirects() {
  const redirects = [
    [`http://${SITE_HOST}/about`, `${SITE_ORIGIN}/about/`],
    [`https://www.${SITE_HOST}/about`, `${SITE_ORIGIN}/about/`],
    [`${SITE_ORIGIN}/about`, `${SITE_ORIGIN}/about/`],
    [`${SITE_ORIGIN}/cohorts`, `${SITE_ORIGIN}/batches/`],
    [
      `${SITE_ORIGIN}/teams/wayfinders`,
      `${SITE_ORIGIN}/batches/spring-2026/wayfinder/`,
    ],
  ];

  for (const [source, target] of redirects) {
    const response = await head(source);
    const location = response.headers.get("location")
      ? new URL(response.headers.get("location"), source).toString()
      : "";

    if (response.status !== 301) {
      fail(`${source}: expected 301 redirect, got ${response.status}`);
    }

    if (location !== target) {
      fail(
        `${source}: expected redirect to ${target}, got ${location || "(none)"}`,
      );
    }
  }
}

async function checkNoindex() {
  for (const url of [
    `${SITE_ORIGIN}/healthz`,
    `${SITE_ORIGIN}/api/applications`,
    `${SITE_ORIGIN}/.well-known/security.txt`,
    `${SITE_ORIGIN}/missing-seo-monitor-page`,
  ]) {
    const response = await head(url);
    expectHeader(response, url, "x-robots-tag", "noindex");
  }
}

async function monitorSeo() {
  await checkDns();
  await checkCertificates();
  await checkStatus();
  await checkRedirects();
  await checkNoindex();

  if (failures.length) {
    console.error("SEO monitor failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`SEO monitor passed for ${SITE_HOST}.`);
}

monitorSeo().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
