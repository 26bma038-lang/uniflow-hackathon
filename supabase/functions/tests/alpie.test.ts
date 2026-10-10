// Runs under Node (`node --test supabase/functions/tests/`) and under Deno.
// A stand-in fetch is used throughout: these tests never reach the network.

import assert from "node:assert/strict"
import { test } from "node:test"
import { callAlpie, DEFAULT_ALPIE_MODEL, stripReasoning, type AlpieRequest } from "../_shared/alpie.ts"

const PLACEHOLDER_KEY = "placeholder-key-for-tests"

type Seen = { url: string; init: RequestInit }

function request(fetchImpl: typeof fetch, overrides: Partial<AlpieRequest> = {}): AlpieRequest {
  return { apiKey: PLACEHOLDER_KEY, model: DEFAULT_ALPIE_MODEL, systemInstruction: "system", userText: "hello", maxTokens: 256, timeoutMs: 2000, fetchImpl, ...overrides }
}

function respond(status: number, body: unknown, seen?: Seen[]): typeof fetch {
  return (async (url: string | URL | Request, init?: RequestInit) => {
    seen?.push({ url: String(url), init: init ?? {} })
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status })
  }) as typeof fetch
}

const completion = (content: string, extra: Record<string, unknown> = {}) => ({ id: "c1", model: "alpie-32b", created: 1, choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: "stop" }], ...extra })

test("sends the documented request: endpoint, bearer key, model, system and user messages", async () => {
  const seen: Seen[] = []
  const result = await callAlpie(request(respond(200, completion('{"answer":"x","sourceIds":[]}'), seen)))
  assert.equal(result.ok, true)
  assert.equal(seen[0].url, "https://api.169pi.com/v1/chat/completions")
  const headers = seen[0].init.headers as Record<string, string>
  assert.equal(headers.Authorization, `Bearer ${PLACEHOLDER_KEY}`)
  const body = JSON.parse(String(seen[0].init.body))
  assert.equal(body.model, "alpie-32b")
  assert.deepEqual(body.messages, [{ role: "system", content: "system" }, { role: "user", content: "hello" }])
  assert.equal(body.stream, false)
  assert.equal(body.max_tokens, 256)
  // The key is in the header only.
  assert.equal(seen[0].url.includes(PLACEHOLDER_KEY), false)
  assert.equal(String(seen[0].init.body).includes(PLACEHOLDER_KEY), false)
})

test("returns the answer text and the model the API reports", async () => {
  const result = await callAlpie(request(respond(200, completion("  hello there  "))))
  assert.deepEqual(result, { ok: true, text: "hello there", model: "alpie-32b", finishReason: "stop" })
})

test("inline reasoning is removed and only the answer is kept", () => {
  assert.equal(stripReasoning('<think>let me see</think>{"answer":"a"}'), '{"answer":"a"}')
  assert.equal(stripReasoning('reasoning with no opening tag</think>\n{"answer":"a"}'), '{"answer":"a"}')
  assert.equal(stripReasoning("plain answer"), "plain answer")
})

test("each documented failure maps to an honest error, with the status and the API's error word", async () => {
  const cases: Array<[number, unknown, string, RegExp]> = [
    [401, { error: "invalid_api_key" }, "not_configured", /^Alpie API 401 invalid_api_key$/],
    [402, { error: { code: "key_not_active" } }, "not_configured", /^Alpie API 402 key_not_active$/],
    [404, { error: "model_not_found" }, "not_configured", /^Alpie API 404 model_not_found$/],
    [429, { status: 429, error: "rate_limit_exceeded" }, "rate_limited", /^Alpie API 429 rate_limit_exceeded$/],
    [503, { error: "engine_overloaded" }, "model_unavailable", /^Alpie API 503 engine_overloaded$/],
    [500, "not json", "model_unavailable", /^Alpie API 500$/],
  ]
  for (const [status, body, code, detail] of cases) {
    const result = await callAlpie(request(respond(status, body)))
    assert.equal(result.ok, false)
    if (!result.ok) {
      assert.equal(result.code, code)
      assert.match(result.detail, detail)
      assert.equal(result.detail.includes(PLACEHOLDER_KEY), false)
    }
  }
})

test("a free-text error message from the API is not passed on", async () => {
  const result = await callAlpie(request(respond(400, { error: { message: "your prompt said: secret things" } })))
  assert.equal(result.ok, false)
  if (!result.ok) assert.equal(result.detail, "Alpie API 400")
})

test("an empty answer, or one that is only reasoning, is bad output, never a made-up answer", async () => {
  for (const body of [completion(""), completion("<think>only thinking</think>"), { choices: [] }]) {
    const result = await callAlpie(request(respond(200, body)))
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, "bad_output")
  }
})

test("a network failure and a timeout are reported as such", async () => {
  const down = await callAlpie(request((async () => { throw new TypeError("fetch failed") }) as unknown as typeof fetch))
  assert.equal(down.ok, false)
  if (!down.ok) assert.match(down.detail, /fetch failed/)
  const slow = (async (_url: string | URL | Request, init?: RequestInit) => new Promise((_resolve, reject) => { init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))) })) as unknown as typeof fetch
  const timedOut = await callAlpie(request(slow, { timeoutMs: 30 }))
  assert.equal(timedOut.ok, false)
  if (!timedOut.ok) assert.match(timedOut.detail, /timed out after 30 ms/)
})

test("an invalid model id is refused before any request", async () => {
  const seen: Seen[] = []
  const result = await callAlpie(request(respond(200, completion("x"), seen), { model: "Not A Model!" }))
  assert.equal(result.ok, false)
  assert.equal(seen.length, 0)
})
