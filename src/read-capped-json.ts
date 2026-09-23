export interface ByteLimitedRequest {
  headers: { get(name: string): string | null };
  body: ReadableStream<Uint8Array> | null;
}

export type CappedJsonResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; status: 400 | 413 };

export async function readCappedJson(
  request: ByteLimitedRequest,
  maxBytes: number,
): Promise<CappedJsonResult> {
  const declaredLength = declaredContentLength(
    request.headers.get("Content-Length"),
  );

  if (declaredLength !== null && declaredLength > maxBytes) {
    await cancelBody(request.body);
    return { ok: false, status: 413 };
  }

  const body = request.body;

  if (!body) return { ok: false, status: 400 };

  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) break;
      if (!value?.byteLength) continue;

      received += value.byteLength;

      if (received > maxBytes) {
        await reader.cancel();
        return { ok: false, status: 413 };
      }

      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400 };
  }

  const bytes = new Uint8Array(received);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  let text: string;

  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    return { ok: false, status: 400 };
  }

  if (!text.trim()) return { ok: false, status: 400 };

  let parsed: unknown;

  try {
    parsed = JSON.parse(text);
  } catch {
    return { ok: false, status: 400 };
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { ok: false, status: 400 };
  }

  return { ok: true, value: parsed as Record<string, unknown> };
}

function declaredContentLength(header: string | null): number | null {
  if (header === null) return null;

  const value = header.trim();

  if (!/^\d+$/.test(value)) return null;

  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed)) return Number.POSITIVE_INFINITY;

  return parsed;
}

async function cancelBody(
  body: ReadableStream<Uint8Array> | null,
): Promise<void> {
  if (!body) return;

  try {
    await body.cancel();
  } catch {
    // The caller is already rejecting the payload.
  }
}
