/**
 * Z2.2 - Conservative request admission for paid/quota-accounted AI endpoints.
 * Reject cross-origin browser submissions and overlarge bodies BEFORE parsing,
 * idempotency fingerprinting, or reserving daily/provider credits.
 *
 * The stream is read from a clone; the original request remains consumable by
 * its existing route handler. No photos or text are logged or persisted here.
 */
const noStore = { "Cache-Control": "private, no-store" };

const maxBodyBytes: Record<string, number> = {
  "/api/food/analyze": 105 * 1024 * 1024, // Ten JPEG/PNG/WEBP images, each <= 10 MiB, plus multipart overhead.
  "/api/food/refine": 256 * 1024,          // Existing analysis + clarification response.
  "/api/food/text": 64 * 1024,             // Short manual meal description.
  "/api/coach/chat": 64 * 1024,            // Short question, history and preferences.
};

function reject(status: number, error: string, code: string): Response {
  return Response.json({ error, code }, { status, headers: noStore });
}

function sameOrigin(request: Request, origin: string): boolean {
  try {
    const submitted = new URL(origin);
    return submitted.origin !== "null" && submitted.origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

/** A null result permits the route to continue. Never consumes the original request. */
export async function checkAiRequestSafety(request: Request): Promise<Response | null> {
  // Sec-Fetch-Site is browser controlled. Legitimate in-app POSTs are same-origin;
  // local development and non-browser clients may omit this header.
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site" || site === "same-site") {
    return reject(403, "Submit AI requests from Khalories AI.", "AI_ORIGIN_DENIED");
  }
  const origin = request.headers.get("origin");
  if (origin !== null && !sameOrigin(request, origin)) {
    return reject(403, "Submit AI requests from Khalories AI.", "AI_ORIGIN_DENIED");
  }

  const max = maxBodyBytes[new URL(request.url).pathname] ?? 256 * 1024;
  const length = request.headers.get("content-length");
  if (length !== null) {
    const supplied = Number(length);
    if (!/^\d+$/.test(length) || !Number.isSafeInteger(supplied)) {
      return reject(400, "Invalid request length.", "AI_INVALID_LENGTH");
    }
    if (supplied > max) {
      return reject(413, "AI request is too large. Reduce the number or size of attachments.", "AI_INPUT_TOO_LARGE");
    }
  }

  // Content-Length can be missing or incorrect (e.g. chunked clients).
  // Bound the actual body independently, without ever materializing its content.
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
  try {
    reader = request.clone().body?.getReader();
    if (!reader) return null;
    let seen = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) return null;
      seen += value.byteLength;
      if (seen > max) {
        // Do not await cancel on a tee: it can wait for the original branch.
        void reader.cancel().catch(() => undefined);
        return reject(413, "AI request is too large. Reduce the number or size of attachments.", "AI_INPUT_TOO_LARGE");
      }
    }
  } catch {
    return reject(400, "Unable to read AI request.", "AI_BODY_INVALID");
  } finally {
    try { reader?.releaseLock(); } catch { /* stream may already be canceled */ }
  }
}
