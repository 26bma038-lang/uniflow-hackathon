// Runs under Node (`node --test supabase/functions/tests/`) and under Deno.
// A stand-in fetch is used throughout: these tests never reach the network.

import assert from "node:assert/strict"
import { test } from "node:test"
import { callGemma, DEFAULT_GEMMA_MODEL, type GemmaRequest } from "../_shared/gemma.ts"

const PLACEHOLDER_KEY = "placeholder-key-for-tests"

type Seen = { url: string; init: RequestInit }

function request(fetchImpl: typeof fetch, overrides: Partial<GemmaRequest> = {}): GemmaRequest {
  return {
    apiKey: PLACEHOLDER_KEY,
    model: DEFAULT_GEMMA_MODEL,
    systemInstruction: "system",
    parts: [{ text: "hello" }],
    maxOutputTokens: 256,
    timeoutMs: 2000,
    thinkingLevel: "minimal",
    fetchImpl,
    ...overrides,
  }
}

function respond(status: number, body: unknown, seen?: Seen[]): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    seen?.push({ url: String(url), init: init ?? {} })
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status })
  }) as typeof fetch
}

test("sends the key in a header, never in the URL, with the documented body", async () => {
  const seen: Seen[] = []
  const result = await callGemma(
    request(respond(200, { candidates: [{ content: { parts: [{ text: '{"a":1}' }] } }] }, seen), {
      parts: [{ inline_data: { mime_type: "image/png", data: "AAAA" } }, { text: "read this" }],
    }),
  )
  assert.deepEqual(result, { ok: true, text: '{"a":1}' })
  assert.equal(seen[0].url, `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_GEMMA_MODEL}:generateContent`)
  assert.equal(seen[0].url.includes(PLACEHOLDER_KEY), false)
  assert.equal((seen[0].init.headers as Record<string, string>)["x-goog-api-key"], PLACEHOLDER_KEY)
  const body = JSON.parse(String(seen[0].init.body))
  assert.deepEqual(body.systemInstruction, { parts: [{ text: "system" }] })
  assert.deepEqual(body.contents[0].parts[0], { inline_data: { mime_type: "image/png", data: "AAAA" } })
  assert.deepEqual(body.generationConfig, { temperature: 0, maxOutputTokens: 256, thinkingConfig: { thinkingLevel: "minimal" } })
  assert.equal("responseMimeType" in body.generationConfig, false)
})

test("leaves thinkingConfig out when no level is set", async () => {
  const seen: Seen[] = []
  await callGemma(request(respond(200, { candidates: [{ content: { parts: [{ text: "x" }] } }] }, seen), { thinkingLevel: "" }))
  assert.equal("thinkingConfig" in JSON.parse(String(seen[0].init.body)).generationConfig, false)
})

test("drops thought parts and joins the answer", async () => {
  const result = await callGemma(
    request(respond(200, { candidates: [{ content: { parts: [{ text: "let me think", thought: true }, { text: '{"a":' }, { text: "1}" }] } }] })),
  )
  assert.deepEqual(result, { ok: true, text: '{"a":1}' })
})

test("maps upstream failures to error codes without leaking the key", async () => {
  const cases: Array<[number, string]> = [[429, "rate_limited"], [401, "not_configured"], [403, "not_configured"], [404, "model_unavailable"], [400, "model_unavailable"], [500, "model_unavailable"], [503, "model_unavailable"]]
  for (const [status, code] of cases) {
    const result = await callGemma(request(respond(status, { error: { status: "SOME_STATUS", message: `key ${PLACEHOLDER_KEY} was used` } })))
    assert.equal(result.ok, false)
    if (result.ok) continue
    assert.equal(result.code, code, String(status))
    assert.equal(JSON.stringify(result).includes(PLACEHOLDER_KEY), false)
    assert.ok(result.detail.includes(String(status)))
  }
})

test("an empty or blocked answer is bad_output", async () => {
  for (const body of [{}, { candidates: [] }, { promptFeedback: { blockReason: "SAFETY" } }, { candidates: [{ finishReason: "MAX_TOKENS", content: { parts: [{ text: "thinking", thought: true }] } }] }]) {
    const result = await callGemma(request(respond(200, body)))
    assert.equal(result.ok ? null : result.code, "bad_output")
  }
  const notJson = await callGemma(request(respond(200, "<html>oops</html>")))
  assert.equal(notJson.ok ? null : notJson.code, "bad_output")
})

test("a network failure and a timeout are model_unavailable", async () => {
  const failing = (async () => {
    throw new TypeError("fetch failed")
  }) as unknown as typeof fetch
  const failed = await callGemma(request(failing))
  assert.equal(failed.ok ? null : failed.code, "model_unavailable")

  const hanging = ((_url: string, init?: RequestInit) =>
    new Promise((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")))
    })) as unknown as typeof fetch
  const timedOut = await callGemma(request(hanging, { timeoutMs: 30 }))
  assert.equal(timedOut.ok, false)
  if (!timedOut.ok) {
    assert.equal(timedOut.code, "model_unavailable")
    assert.match(timedOut.detail, /timed out/)
  }
})

test("refuses a model id that could change the request path", async () => {
  let called = false
  const spy = (async () => {
    called = true
    return new Response("{}")
  }) as unknown as typeof fetch
  for (const model of ["", "../other", "gemma 4", "models/x?key=1", "a/b"]) {
    const result = await callGemma(request(spy, { model }))
    assert.equal(result.ok ? null : result.code, "not_configured", model)
  }
  assert.equal(called, false)
})
