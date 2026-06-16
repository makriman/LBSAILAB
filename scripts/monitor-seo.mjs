import { Resolver } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import tls from "node:tls";
import { lookup as systemLookup } from "node:dns";

const SITE_URL = process.env.SEO_SITE_URL || "https://lbsailab.com";
const SITE = new URL(SITE_URL);
const SITE_ORIGIN = SITE.origin;
const SITE_HOST = SITE.host;
const DUPLICATE_ORIGINS = (
  process.env.SEO_DUPLICATE_ORIGINS ||
  "https://lbsailab.zahra-moghadasi.workers.dev"
)
  .split(",")
  .map((origin) => origin.trim().replace(/\/+$/, ""))
  .filter((origin) => origin && origin !== SITE_ORIGIN);
const PUBLIC_DNS_SERVERS = ["1.1.1.1", "8.8.8.8"];
const MIN_CERT_VALID_DAYS = 30;
const CANONICAL_PATHS = [
  "/",
  "/about/",
  "/apply/",
  "/batches/",
  "/batches/spring-2026/",
  "/batches/spring-2026/london-eats-pal/",
  "/batches/spring-2026/wayfinder/",
  "/contact/",
  "/mentors/",
  "/sitemap/",
];
const GONE_PATHS = [
  "/images/lbs-ai-lab-workshop-hero.png",
  "/mentors/rhea-bisaria.png",
];
const NOINDEX_PATHS = [
  "/healthz",
  "/api/applications",
  "/api/vitals",
  "/admin/",
  "/login/",
  "/search/",
  "/cart/",
  "/checkout/",
  "/internal/",
  "/private/",
  "/.well-known/security.txt",
  "/404.html",
  "/404/",
  "/missing-seo-monitor-page/",
];
const COMPRESSED_TEXT_PATHS = [
  "/",
  "/about/",
  "/llms.txt",
  "/llms-full.txt",
  "/robots.txt",
  "/sitemap-index.xml",
  "/sitemap-0.xml",
  "/image-sitemap.xml",
];
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

async function negotiatedTlsProtocolFor(hostname) {
  const [address] = await publicARecords(hostname);

  if (!address) {
    throw new Error(`No public A record for ${hostname}`);
  }

  return new Promise((resolve, reject) => {
    const socket = tls.connect(
      {
        ALPNProtocols: ["h2", "http/1.1"],
        host: address,
        port: 443,
        servername: hostname,
        timeout: 10000,
      },
      () => {
        const protocol = socket.alpnProtocol || "";
        socket.end();
        resolve(protocol);
      },
    );

    socket.on("error", reject);
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error("TLS ALPN negotiation timed out"));
    });
  });
}

async function checkHttpProtocolNegotiation(hostname) {
  try {
    const protocol = await negotiatedTlsProtocolFor(hostname);

    if (protocol !== "h2") {
      fail(
        `${hostname}: expected TLS ALPN to negotiate HTTP/2 (h2), got "${protocol || "(none)"}"`,
      );
    }
  } catch (error) {
    fail(
      `${hostname}: HTTP/2 ALPN check failed (${error instanceof Error ? error.message : String(error)})`,
    );
  }
}

async function checkHttpProtocols() {
  await Promise.all([
    checkHttpProtocolNegotiation(SITE_HOST),
    checkHttpProtocolNegotiation(`www.${SITE_HOST}`),
  ]);
}

async function requestUrl(url, method = "HEAD", body = "", headers = {}) {
  const parsed = new URL(url);
  const transport = parsed.protocol === "http:" ? http : https;
  const requestHeaders = {
    "User-Agent": "lbsailab-seo-monitor/1.0",
    ...headers,
  };

  if (body) {
    requestHeaders["Content-Length"] = Buffer.byteLength(body);
  }

  return new Promise((resolve, reject) => {
    const request = transport.request(
      parsed,
      {
        headers: requestHeaders,
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
    if (body) request.write(body);
    request.end();
  });
}

async function requestStatus(url, method = "HEAD", body = "", headers = {}) {
  try {
    return await requestUrl(url, method, body, headers);
  } catch (error) {
    fail(
      `${url}: request failed (${error instanceof Error ? error.message : String(error)})`,
    );
    return new Response("", { status: 599 });
  }
}

async function requestCompressed(url) {
  return requestStatus(url, "GET", "", {
    Accept: "*/*",
    "Accept-Encoding": "br, gzip",
  });
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

function expectHeaderPresent(response, url, name) {
  const value = response.headers.get(name) || "";

  if (!value) {
    fail(`${url}: expected ${name} header to be present`);
  }
}

async function expectStatus(url, expectedStatus, method = "HEAD") {
  const response = await requestStatus(url, method);

  if (response.status !== expectedStatus) {
    fail(`${url}: expected ${expectedStatus}, got ${response.status}`);
  }

  if (response.status >= 500) {
    fail(`${url}: returned 5xx status ${response.status}`);
  }

  return response;
}

async function expectRedirect(source, target) {
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

  if (location) {
    const targetWithoutHash = new URL(location);
    targetWithoutHash.hash = "";
    const targetResponse = await requestStatus(targetWithoutHash.toString());

    if (targetResponse.status !== 200) {
      fail(
        `${source}: redirect target ${targetWithoutHash.toString()} expected 200, got ${targetResponse.status}`,
      );
    }

    if (targetResponse.headers.get("location")) {
      fail(`${source}: redirect target should not redirect again`);
    }
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
    [`${SITE_ORIGIN}/llms.txt`, 200, "HEAD"],
    [`${SITE_ORIGIN}/llms-full.txt`, 200, "HEAD"],
    [`${SITE_ORIGIN}/.well-known/security.txt`, 200, "HEAD"],
    [`${SITE_ORIGIN}/404.html`, 200, "HEAD"],
    [`${SITE_ORIGIN}/404/`, 200, "HEAD"],
    [`${SITE_ORIGIN}/healthz`, 200, "HEAD"],
    [`${SITE_ORIGIN}/api/applications`, 200, "GET"],
    [`${SITE_ORIGIN}/api/vitals`, 200, "GET"],
    [`${SITE_ORIGIN}/missing-seo-monitor-page/`, 404, "HEAD"],
  ];

  for (const [url, expectedStatus, method] of checks) {
    await expectStatus(url, expectedStatus, method);
  }
}

async function checkRedirects() {
  const redirects = [
    [`http://${SITE_HOST}/`, `${SITE_ORIGIN}/`],
    [`http://www.${SITE_HOST}/`, `${SITE_ORIGIN}/`],
    [`${SITE_ORIGIN}/index.html`, `${SITE_ORIGIN}/`],
    [`${SITE_ORIGIN}/about/index.html`, `${SITE_ORIGIN}/about/`],
    [
      `${SITE_ORIGIN}/batches/spring-2026/wayfinder/index.html`,
      `${SITE_ORIGIN}/batches/spring-2026/wayfinder/`,
    ],
    [
      `${SITE_ORIGIN}/cohorts/cohort-01/index.html`,
      `${SITE_ORIGIN}/batches/spring-2026/`,
    ],
    [`http://${SITE_HOST}/about`, `${SITE_ORIGIN}/about/`],
    [`http://www.${SITE_HOST}/About?utm_source=test`, `${SITE_ORIGIN}/about/`],
    [`https://www.${SITE_HOST}/about`, `${SITE_ORIGIN}/about/`],
    [
      `https://www.${SITE_HOST}/Batches/Spring-2026`,
      `${SITE_ORIGIN}/batches/spring-2026/`,
    ],
    [`${SITE_ORIGIN}/About`, `${SITE_ORIGIN}/about/`],
    [`${SITE_ORIGIN}/about`, `${SITE_ORIGIN}/about/`],
    [
      `${SITE_ORIGIN}/batches/spring-2026/Wayfinder`,
      `${SITE_ORIGIN}/batches/spring-2026/wayfinder/`,
    ],
    [
      `${SITE_ORIGIN}/about?utm_source=test&gclid=test`,
      `${SITE_ORIGIN}/about/`,
    ],
    [`${SITE_ORIGIN}/about?preview=true&foo=bar`, `${SITE_ORIGIN}/about/`],
    [`${SITE_ORIGIN}/cohorts`, `${SITE_ORIGIN}/batches/`],
    [`${SITE_ORIGIN}/COHORTS/COHORT-01`, `${SITE_ORIGIN}/batches/spring-2026/`],
    [`${SITE_ORIGIN}/cohorts/cohort-01`, `${SITE_ORIGIN}/batches/spring-2026/`],
    [`${SITE_ORIGIN}/cohorts/cohort-02`, `${SITE_ORIGIN}/batches/#autumn-2026`],
    [`${SITE_ORIGIN}/teams`, `${SITE_ORIGIN}/batches/spring-2026/`],
    [
      `${SITE_ORIGIN}/teams/cafe-smart`,
      `${SITE_ORIGIN}/batches/spring-2026/london-eats-pal/`,
    ],
    [
      `${SITE_ORIGIN}/teams/campus-collective`,
      `${SITE_ORIGIN}/batches/spring-2026/london-eats-pal/`,
    ],
    [
      `${SITE_ORIGIN}/batches/spring-2026/campus-collective`,
      `${SITE_ORIGIN}/batches/spring-2026/london-eats-pal/`,
    ],
    [
      `${SITE_ORIGIN}/teams/wayfinders`,
      `${SITE_ORIGIN}/batches/spring-2026/wayfinder/`,
    ],
    [
      `${SITE_ORIGIN}/teams/wayfinder`,
      `${SITE_ORIGIN}/batches/spring-2026/wayfinder/`,
    ],
    [
      `${SITE_ORIGIN}/teams/ems-plus-plus`,
      `${SITE_ORIGIN}/batches/spring-2026/ems-plus-plus/`,
    ],
    ...DUPLICATE_ORIGINS.flatMap((origin) => [
      [`${origin}/`, `${SITE_ORIGIN}/`],
      [`${origin}/About?utm_source=test`, `${SITE_ORIGIN}/about/`],
      [
        `${origin}/Batches/Spring-2026/Wayfinder?preview=true`,
        `${SITE_ORIGIN}/batches/spring-2026/wayfinder/`,
      ],
    ]),
  ];

  for (const [source, target] of redirects) {
    await expectRedirect(source, target);
  }
}

async function checkCanonicalUrlsDoNotRedirect() {
  for (const path of CANONICAL_PATHS) {
    const url = `${SITE_ORIGIN}${path}`;
    const response = await expectStatus(url, 200);

    if (response.headers.get("location")) {
      fail(`${url}: canonical URL unexpectedly returned a redirect location`);
    }

    expectHeader(response, url, "link", `<${url}>; rel="canonical"`);
  }
}

async function checkNoindex() {
  for (const path of NOINDEX_PATHS) {
    const url = `${SITE_ORIGIN}${path}`;
    const response = await requestStatus(
      url,
      url.endsWith("/api/applications") ? "GET" : "HEAD",
    );
    expectHeader(response, url, "x-robots-tag", "noindex");
  }
}

async function checkGone() {
  for (const path of GONE_PATHS) {
    const url = `${SITE_ORIGIN}${path}`;
    const response = await expectStatus(url, 410);

    expectHeader(response, url, "x-robots-tag", "noindex");
  }
}

async function checkDiscoveryFiles() {
  for (const path of ["/llms.txt", "/llms-full.txt"]) {
    const url = `${SITE_ORIGIN}${path}`;
    const response = await requestStatus(url);

    expectHeader(response, url, "content-type", "text/plain");
    expectHeader(response, url, "x-robots-tag", "index, follow");
    expectHeader(response, url, "cache-control", "max-age=300");
  }
}

async function checkCdnAndCompression() {
  for (const path of COMPRESSED_TEXT_PATHS) {
    const url = `${SITE_ORIGIN}${path}`;
    const response = await requestCompressed(url);

    if (response.status !== 200) {
      fail(`${url}: expected compressed resource 200, got ${response.status}`);
      continue;
    }

    expectHeader(response, url, "server", "cloudflare");
    expectHeader(response, url, "alt-svc", "h3");
    expectHeaderPresent(response, url, "cf-cache-status");

    const contentEncoding = response.headers.get("content-encoding") || "";

    if (!/\b(?:br|gzip)\b/i.test(contentEncoding)) {
      fail(
        `${url}: expected br or gzip content-encoding, got "${contentEncoding || "(missing)"}"`,
      );
    }

    expectHeader(response, url, "cache-control", "max-age=300");
  }
}

async function checkVitalsEndpoint() {
  const url = `${SITE_ORIGIN}/api/vitals`;
  const body = JSON.stringify({
    metrics: [
      { name: "TTFB", value: 120 },
      { name: "FCP", value: 700 },
      { name: "LCP", value: 1200 },
      { name: "CLS", value: 0.01 },
      { name: "INP", value: 80 },
    ],
    navigationType: "navigate",
    path: "/seo-monitor",
    visibilityState: "hidden",
  });
  const response = await requestStatus(url, "POST", body, {
    "Content-Type": "application/json",
  });

  if (response.status !== 204) {
    fail(`${url}: expected POST 204, got ${response.status}`);
  }

  expectHeader(response, url, "x-robots-tag", "noindex");
  expectHeader(response, url, "cache-control", "no-store");
}

async function monitorSeo() {
  await checkDns();
  await checkCertificates();
  await checkHttpProtocols();
  await checkStatus();
  await checkRedirects();
  await checkCanonicalUrlsDoNotRedirect();
  await checkNoindex();
  await checkGone();
  await checkDiscoveryFiles();
  await checkCdnAndCompression();
  await checkVitalsEndpoint();

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
