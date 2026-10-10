// One call to a Gemma model through the Gemini API's generateContent endpoint.
// Web-standard fetch only (no Deno), so it can be tested with a stand-in fetch.
//
// Verified on 2026-10-10 against https://ai.google.dev/gemma/docs/core/gemma_on_gemini_api:
// Gemma 4 is served by the Gemini API as `gemma-4-26b-a4b-it` and `gemma-4-31b-it`, takes
// image input, takes `systemInstruction`, and takes `generationConfig.thinkingConfig.thinkingLevel`
// ("minimal" turns thinking off, "high" turns it on). JSON mode (`responseMimeType`) is NOT
// documented for Gemma there, so it is not sent: the prompt asks for JSON and the caller
// parses and validates the text.
//
// The key travels in the x-goog-api-key header, never in the URL, and is never logged.

import type { AiErrorCode } from "./contracts.ts"

export const DEFAULT_GEMMA_MODEL = "gemma-4-26b-a4b-it"
const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models"
const MODEL_ID = /^[a-z0-9][a-z0-9.-]{0,79}$/

export type GemmaPart = { text: string } | { inline_data: { mime_type: string; data: string } }

export type GemmaRequest = {
  apiKey: string
  model: string
  systemInstruction: string
  parts: GemmaPart[]
  maxOutputTokens: number
  timeoutMs: number
  // "minimal" or "high". Left out of the request when empty.
  thinkingLevel?: string
  fetchImpl?: typeof fetch
}

export type GemmaResult =
  | { ok: true; text: string }
  // `detail` is for server logs only. It never holds the key or the request body.
  | { ok: false; code: Extract<AiErrorCode, "not_configured" | "rate_limited" | "model_unavailable" | "bad_output">; message: string; detail: string }

export async function callGemma(request: GemmaRequest): Promise<GemmaResult> {
  if (!MODEL_ID.test(request.model)) {
    return { ok: false, code: "not_configured", message: "The AI model isn’t set up correctly on the server.", detail: "GEMMA_MODEL is not a valid model id" }
  }

  const generationConfig: Record<string, unknown> = { temperature: 0, maxOutputTokens: request.maxOutputTokens }
  if (request.thinkingLevel) generationConfig.thinkingConfig = { thinkingLevel: request.thinkingLevel }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), request.timeoutMs)
  let response: Response
  try {
    response = await (request.fetchImpl ?? fetch)(`${ENDPOINT}/${request.model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": request.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: request.systemInstruction }] },
        contents: [{ role: "user", parts: request.parts }],
        generationConfig,
      }),
      signal: controller.signal,
    })
  } catch (error) {
    const timedOut = controller.signal.aborted
    return {
      ok: false,
      code: "model_unavailable",
      message: timedOut ? "The AI model took too long to answer. Try again." : "Couldn’t reach the AI model. Try again in a moment.",
      detail: timedOut ? `timed out after ${request.timeoutMs} ms` : `fetch failed: ${error instanceof Error ? error.name : "unknown"}`,
    }
  } finally {
    clearTimeout(timer)
  }

  if (!response.ok) {
    // Google's error body can echo request details; keep only its status word for the log.
    let status = ""
    try {
      const body = (await response.json()) as { error?: { status?: unknown } }
      if (typeof body?.error?.status === "string") status = body.error.status
    } catch {
      // no JSON body
    }
    const detail = `Gemini API ${response.status} ${status}`.trim()
    if (response.status === 429) return { ok: false, code: "rate_limited", message: "The AI model is busy right now. Wait a minute and try again.", detail }
    if (response.status === 401 || response.status === 403) {
      return { ok: false, code: "not_configured", message: "The AI model key on the server was rejected. Ask the project owner to check it.", detail }
    }
    return { ok: false, code: "model_unavailable", message: "The AI model couldn’t answer right now. Try again in a moment.", detail }
  }

  let body: {
    candidates?: Array<{ finishReason?: string; content?: { parts?: Array<{ text?: unknown; thought?: unknown }> } }>
    promptFeedback?: { blockReason?: string }
  }
  try {
    body = await response.json()
  } catch {
    return { ok: false, code: "bad_output", message: "The AI model’s answer couldn’t be read. Try again.", detail: "response was not JSON" }
  }

  const candidate = body.candidates?.[0]
  // Thinking models return their reasoning as parts marked `thought`; only the answer is kept.
  const text = (candidate?.content?.parts ?? [])
    .filter((part) => part.thought !== true && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("")
    .trim()

  if (text === "") {
    const why = body.promptFeedback?.blockReason ?? candidate?.finishReason ?? "no candidates"
    return { ok: false, code: "bad_output", message: "The AI model gave no usable answer. Try again, or fill in the details by hand.", detail: `empty answer (${String(why).slice(0, 40)})` }
  }
  return { ok: true, text }
}
