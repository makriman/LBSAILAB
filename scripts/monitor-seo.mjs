import { Resolver } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import { lookup as systemLookup } from "node:dns";

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

async function certificateFor(hostname) {
  const [address] = await publicARecords(hostname);

  if (!address) {
    throw new Error(`No public A record for ${hostname}`);
  }

  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        host: address,
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

function certificateMatchesHost(subjectAltName, hostname) {
  return subjectAltName
    .split(",")
    .map((entry) => entry.trim().replace(/^DNS:/i, ""))
    .some((name) => {
      if (name === hostname) return true;
      if (!name.startsWith("*.")) return false;

      const suffix = name.slice(1);
      return hostname.endsWith(suffix);
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

    if (!certificateMatchesHost(subjectAltName, hostname)) {
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

async function requestUrl(url, method = "HEAD") {
  const parsed = new URL(url);
  const transport = parsed.protocol === "http:" ? http : https;

  return new Promise((resolve, reject) => {
    const request = transport.request(
      parsed,
      {
        headers: {
          "User-Agent": "lbsailab-seo-monitor/1.0",
        },
        lookup: publicDnsFallbackLookup,
        method,
      },
      (response) => {
        response.resume();
        response.on("end", () => {
          resolve({
            headers: {
              get(name) {
                const value = response.headers[name.toLowerCase()];
                if (Array.isArray(value)) return value.join(", ");
                return value || null;
              },
            },
            status: response.statusCode || 0,
          });
        });
      },
    );

    request.on("error", reject);
    request.end();
  });
}

async function requestStatus(url, method = "HEAD") {
  try {
    return await requestUrl(url, method);
  } catch (error) {
    fail(
      `${url}: request failed (${error instanceof Error ? error.message : String(error)})`,
    );
    return new Response("", { status: 599 });
  }
}

async function publicDnsFallbackLookup(hostname, options, callback) {
  systemLookup(
    hostname,
    {
      family: options?.family || 0,
      hints: options?.hints || 0,
    },
    async (systemError, address, family) => {
      if (!systemError && address) {
        lookupCallback(callback, address, family, Boolean(options?.all));
        return;
      }

      try {
        const [publicAddress] = await resolver.resolve4(hostname);

        if (!publicAddress) {
          throw new Error(`No public A record for ${hostname}`);
        }

        lookupCallback(callback, publicAddress, 4, Boolean(options?.all));
      } catch (error) {
        callback(error);
      }
    },
  );
}

function lookupCallback(callback, address, family, all) {
  if (all) {
    callback(null, [{ address, family }]);
    return;
  }

  callback(null, address, family);
}

function expectHeader(response, url, name, expected) {
  const value = response.headers.get(name) || "";

  if (!value.includes(expected)) {
    fail(`${url}: expected ${name} to include "${expected}", got "${value}"`);
  }
}

async function checkStatus() {
  const checks = [
    [`${SITE_ORIGIN}/`, 200, "HEAD"],
    [`${SITE_ORIGIN}/robots.txt`, 200, "HEAD"],
    [`${SITE_ORIGIN}/sitemap-index.xml`, 200, "HEAD"],
    [`${SITE_ORIGIN}/sitemap-0.xml`, 200, "HEAD"],
    [`${SITE_ORIGIN}/image-sitemap.xml`, 200, "HEAD"],
    [`${SITE_ORIGIN}/feed.xml`, 200, "HEAD"],
    [`${SITE_ORIGIN}/.well-known/security.txt`, 200, "HEAD"],
    [`${SITE_ORIGIN}/404.html`, 200, "HEAD"],
    [`${SITE_ORIGIN}/404/`, 200, "HEAD"],
    [`${SITE_ORIGIN}/healthz`, 200, "HEAD"],
    [`${SITE_ORIGIN}/api/applications`, 200, "GET"],
    [`${SITE_ORIGIN}/images/lbs-ai-lab-workshop-hero.png`, 410, "HEAD"],
    [`${SITE_ORIGIN}/missing-seo-monitor-page/`, 404, "HEAD"],
  ];

  for (const [url, expectedStatus, method] of checks) {
    const response = await requestStatus(url, method);

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
    [`${SITE_ORIGIN}/about?preview=true&foo=bar`, `${SITE_ORIGIN}/about/`],
    [`${SITE_ORIGIN}/cohorts`, `${SITE_ORIGIN}/batches/`],
    [
      `${SITE_ORIGIN}/teams/wayfinders`,
      `${SITE_ORIGIN}/batches/spring-2026/wayfinder/`,
    ],
  ];

  for (const [source, target] of redirects) {
    const response = await requestStatus(source);
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
    `${SITE_ORIGIN}/404.html`,
    `${SITE_ORIGIN}/404/`,
    `${SITE_ORIGIN}/missing-seo-monitor-page/`,
  ]) {
    const response = await requestStatus(
      url,
      url.endsWith("/api/applications") ? "GET" : "HEAD",
    );
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
