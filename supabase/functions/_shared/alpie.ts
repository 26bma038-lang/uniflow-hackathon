// One call to 169Pi's Alpie model through its chat completions endpoint.
// Web-standard fetch only (no Deno), so it can be tested with a stand-in fetch.
//
// Verified on 2026-10-10 against 169Pi's official Python SDK, pi169 0.1
// (https://pypi.org/project/pi169/, source https://github.com/169Pi/Pi169-SDK):
//   POST https://api.169pi.com/v1/chat/completions
//   Authorization: Bearer <key>
//   body  { model, messages: [{ role: "system" | "user" | "assistant", content }], max_tokens,
//           temperature (0.0 to 1.0), stream, top_p, frequency_penalty, presence_penalty }
//   reply { id, model, created, choices: [{ index, message: { role, content }, finish_reason }], usage }
// The SDK's code and examples all use the model id "alpie-32b". Its README table names the
// model "alpie-core"; that is the model's name, not an id the SDK sends.
// Errors per the SDK: 401 auth, 402 key not active or limit exceeded, 400 bad parameters or
// context window, 403 content policy, 404 model not found, 413 context window, 429 rate
// limit, 503 engine overloaded, 504 timeout, other 5xx server error.
//
// The key travels in the Authorization header only and is never logged or returned.

import type { AiErrorCode } from "./contracts.ts"

export const DEFAULT_ALPIE_MODEL = "alpie-32b"
const ENDPOINT = "https://api.169pi.com/v1/chat/completions"
const MODEL_ID = /^[a-z0-9][a-z0-9.-]{0,79}$/

export type AlpieRequest = {
  apiKey: string
  model: string
  systemInstruction: string
  userText: string
  maxTokens: number
  timeoutMs: number
  fetchImpl?: typeof fetch
}

export type AlpieResult =
  | { ok: true; text: string; model: string; finishReason: string | null }
  // `detail` is safe to log and to show: an HTTP status and the API's own short error word.
  // It never holds the key, the prompt, or the request body.
  | { ok: false; code: Extract<AiErrorCode, "not_configured" | "rate_limited" | "model_unavailable" | "bad_output">; message: string; detail: string }

// Alpie is a reasoning model. If it returns its reasoning inline, only the answer is kept.
export function stripReasoning(text: string): string {
  return text
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^[\s\S]*<\/think>/i, "")
    .trim()
}

// The API's own error word, when the body has one. Free-text messages are not passed on:
// they could echo request content.
function errorWord(body: unknown): string {
  if (typeof body !== "object" || body === null) return ""
  const record = body as Record<string, unknown>
  const nested = typeof record.error === "object" && record.error !== null ? (record.error as Record<string, unknown>) : null
  const candidates = [record.error, nested?.code, nested?.type, record.code, record.type]
  const word = candidates.find((value) => typeof value === "string" && /^[A-Za-z0-9_.-]{1,60}$/.test(value))
  return typeof word === "string" ? word : ""
}

export async function callAlpie(request: AlpieRequest): Promise<AlpieResult> {
  if (!MODEL_ID.test(request.model)) {
    return { ok: false, code: "not_configured", message: "The Alpie model isn’t set up correctly on the server.", detail: "ALPIE_MODEL is not a valid model id" }
  }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), request.timeoutMs)
  let response: Response
  try {
    response = await (request.fetchImpl ?? fetch)(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${request.apiKey}` },
      body: JSON.stringify({
        model: request.model,
        messages: [
          { role: "system", content: request.systemInstruction },
          { role: "user", content: request.userText },
        ],
        max_tokens: request.maxTokens,
        temperature: 0,
        stream: false,
      }),
      signal: controller.signal,
    })
  } catch (error) {
    const timedOut = controller.signal.aborted
    return {
      ok: false,
      code: "model_unavailable",
      message: timedOut ? "Alpie took too long to answer. Try again." : "Couldn’t reach Alpie. Try again in a moment.",
      detail: timedOut ? `timed out after ${request.timeoutMs} ms` : `fetch failed: ${error instanceof Error ? error.name : "unknown"}`,
    }
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    let word = ""
    try {
      word = errorWord(await response.json())
    } catch {
      // no JSON body
    }
    const detail = `Alpie API ${response.status} ${word}`.trim()
    if (response.status === 429) return { ok: false, code: "rate_limited", message: "Alpie is rate-limiting requests right now. Wait a minute and try again.", detail }
    if (response.status === 401) return { ok: false, code: "not_configured", message: "The Alpie key on the server was rejected. Ask the project owner to check it.", detail }
    if (response.status === 402) return { ok: false, code: "not_configured", message: "The Alpie key on the server isn’t active or has reached its limit. Ask the project owner to check it.", detail }
    if (response.status === 404) return { ok: false, code: "not_configured", message: "Alpie doesn’t recognise the configured model. Ask the project owner to check it.", detail }
    return { ok: false, code: "model_unavailable", message: "Alpie couldn’t answer right now. Try again in a moment.", detail }
  }

  let body: { model?: unknown; choices?: Array<{ finish_reason?: unknown; message?: { content?: unknown } }> }
  try {
    body = await response.json()
  } catch {
    return { ok: false, code: "bad_output", message: "Alpie’s answer couldn’t be read. Try again.", detail: "response was not JSON" }
  }

  const choice = body.choices?.[0]
  const raw = typeof choice?.message?.content === "string" ? choice.message.content : ""
  const text = stripReasoning(raw)
  const finishReason = typeof choice?.finish_reason === "string" ? choice.finish_reason : null
  if (text === "") {
    return { ok: false, code: "bad_output", message: "Alpie gave no usable answer. Try again.", detail: `empty answer (${finishReason ?? (body.choices?.length ? "no content" : "no choices")})` }
  }
  return { ok: true, text, model: typeof body.model === "string" && body.model !== "" ? body.model : request.model, finishReason }
}
