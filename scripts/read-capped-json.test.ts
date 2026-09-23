import assert from "node:assert/strict";
import test from "node:test";
import { readCappedJson } from "../src/read-capped-json.ts";

const MAX_BYTES = 64;

function streamFrom(bytes: Uint8Array): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      if (!bytes.byteLength) {
        controller.close();
        return;
      }

      const mid = Math.max(1, Math.floor(bytes.byteLength / 2));
      controller.enqueue(bytes.subarray(0, mid));

      if (mid < bytes.byteLength) controller.enqueue(bytes.subarray(mid));

      controller.close();
    },
  });
}

function request(
  body: string | Uint8Array,
  contentLength?: string,
): {
  headers: Headers;
  body: ReadableStream<Uint8Array>;
} {
  const bytes =
    typeof body === "string" ? new TextEncoder().encode(body) : body;
  const headers = new Headers({ "Content-Type": "application/json" });

  if (contentLength !== undefined) headers.set("Content-Length", contentLength);

  return { headers, body: streamFrom(bytes) };
}

test("missing Content-Length still rejects an oversized body", async () => {
  const result = await readCappedJson(
    request(`{"idea":"${"a".repeat(MAX_BYTES)}"}`),
    MAX_BYTES,
  );

  assert.deepEqual(result, { ok: false, status: 413 });
});

test("a non-numeric Content-Length does not skip the byte cap", async () => {
  const oversized = await readCappedJson(
    request(`{"idea":"${"a".repeat(MAX_BYTES)}"}`, "nope"),
    MAX_BYTES,
  );
  const accepted = await readCappedJson(
    request('{"ok":true}', "not-a-number"),
    MAX_BYTES,
  );

  assert.deepEqual(oversized, { ok: false, status: 413 });
  assert.deepEqual(accepted, { ok: true, value: { ok: true } });
});

test("a too-small Content-Length does not allow a larger body", async () => {
  const result = await readCappedJson(
    request(`{"idea":"${"a".repeat(MAX_BYTES)}"}`, "1"),
    MAX_BYTES,
  );

  assert.deepEqual(result, { ok: false, status: 413 });
});

test("a declared length above the cap is rejected before the body is trusted", async () => {
  const result = await readCappedJson(
    request('{"ok":true}', "999999"),
    MAX_BYTES,
  );

  assert.deepEqual(result, { ok: false, status: 413 });
});

test("an unsafe integer Content-Length is treated as over the cap", async () => {
  const result = await readCappedJson(
    request('{"ok":true}', "999999999999999999999"),
    MAX_BYTES,
  );

  assert.deepEqual(result, { ok: false, status: 413 });
});

test("valid JSON at the cap is parsed", async () => {
  const payload = '{"n":1}';
  const result = await readCappedJson(
    request(payload, String(new TextEncoder().encode(payload).byteLength)),
    new TextEncoder().encode(payload).byteLength,
  );

  assert.deepEqual(result, { ok: true, value: { n: 1 } });
});

test("invalid JSON, arrays, and empty bodies are 400", async () => {
  assert.deepEqual(await readCappedJson(request("{", "1"), MAX_BYTES), {
    ok: false,
    status: 400,
  });
  assert.deepEqual(await readCappedJson(request("[1]", "3"), MAX_BYTES), {
    ok: false,
    status: 400,
  });
  assert.deepEqual(await readCappedJson(request("", "0"), MAX_BYTES), {
    ok: false,
    status: 400,
  });
});

test("invalid UTF-8 is 400", async () => {
  const result = await readCappedJson(
    request(new Uint8Array([0xff, 0xfe]), "2"),
    MAX_BYTES,
  );

  assert.deepEqual(result, { ok: false, status: 400 });
});
