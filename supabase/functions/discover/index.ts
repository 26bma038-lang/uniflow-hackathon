// POST /functions/v1/discover
// DiscoverRequest -> DiscoverResponse (src/ai/contracts.ts), or { error: { code, message, detail } }.
//
// A signed-in user asks a question. The function reads published events as that user, gives
// 169Pi’s Alpie model only those rows, and returns the answer with the rows it cites.
// Sources are built from the database rows; an id the model returns that was not fetched
// is dropped. There is no second model and no fallback: if Alpie fails, the caller gets
// the error, with `detail` naming the HTTP status and Alpie’s own error word.

import { DISCOVER_MAX_QUERY_LENGTH } from "../_shared/contracts.ts"
import { callAlpie, DEFAULT_ALPIE_MODEL } from "../_shared/alpie.ts"
import {
  buildDiscoverPrompt,
  buildDiscoverResponse,
  cleanQuery,
  DISCOVER_COLUMNS,
  DISCOVER_MAX_RECORDS,
  DISCOVER_SYSTEM_INSTRUCTION,
  NOTHING_PUBLISHED_ANSWER,
  parseDiscoverOutput,
  type PublishedRow,
} from "../_shared/discover.ts"
import { authenticate, corsHeaders, fail, json, preflight, readJson } from "../_shared/http.ts"
import { todayIn } from "../_shared/poster.ts"
import { AI_ERROR_STATUS, type AiErrorCode } from "../_shared/contracts.ts"

function failWithDetail(code: AiErrorCode, message: string, detail: string): Response {
  return new Response(JSON.stringify({ error: { code, message, detail } }), {
    status: AI_ERROR_STATUS[code],
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  })
}

Deno.serve(async (request) => {
  const early = preflight(request)
  if (early) return early

  try {
    const auth = await authenticate(request)
    if (!auth.ok) return auth.response
    const { client } = auth.caller

    const body = await readJson(request, 8 * 1024)
    if (body === null) return fail("too_large", "That question is too long.")
    if (typeof body !== "object" || body === undefined || Array.isArray(body)) return fail("invalid_request", "The request wasn’t understood.")

    const rawQuery = (body as { query?: unknown }).query
    if (typeof rawQuery !== "string") return fail("invalid_request", "Type a question first.")
    const query = cleanQuery(rawQuery)
    if (query === "") return fail("invalid_request", "Type a question first.")
    if (query.length > DISCOVER_MAX_QUERY_LENGTH) return fail("invalid_request", `Keep the question under ${DISCOVER_MAX_QUERY_LENGTH} characters.`)

    const apiKey = Deno.env.get("ALPIE_API_KEY") ?? ""
    const model = (Deno.env.get("ALPIE_MODEL") ?? "").trim() || DEFAULT_ALPIE_MODEL
    const timeout = Number(Deno.env.get("ALPIE_TIMEOUT_MS"))
    // Stays under the 75 s the browser waits (src/ai/api.ts), so Alpie’s own error arrives first.
    const timeoutMs = Number.isFinite(timeout) && timeout >= 1000 ? Math.min(timeout, 70_000) : 60_000

    // The status filter matters: a club member can also read their own club's drafts, and
    // drafts must never reach the model or the answer.
    const { data, error } = await client
      .from("events")
      .select(DISCOVER_COLUMNS)
      .eq("status", "published")
      .order("published_at", { ascending: false })
      .limit(DISCOVER_MAX_RECORDS)
    if (error) {
      console.error("discover: reading events failed", error.code ?? "")
      return failWithDetail("model_unavailable", "Couldn’t read the published updates. Try again in a moment.", `database ${error.code ?? "error"}`)
    }
    const rows = (data ?? []) as unknown as PublishedRow[]
    if (rows.length === 0) return json({ answer: NOTHING_PUBLISHED_ANSWER, sources: [], model })

    if (!apiKey) {
      console.error("discover: ALPIE_API_KEY is not set")
      return failWithDetail("not_configured", "Alpie isn’t set up on the server yet.", "ALPIE_API_KEY is not set")
    }

    const answer = await callAlpie({
      apiKey,
      model,
      systemInstruction: DISCOVER_SYSTEM_INSTRUCTION,
      userText: buildDiscoverPrompt(query, rows, todayIn("Asia/Kolkata")),
      maxTokens: 4096,
      timeoutMs,
    })
    if (!answer.ok) {
      console.error("discover: model call failed:", answer.detail)
      return failWithDetail(answer.code, answer.message, answer.detail)
    }

    const parsed = parseDiscoverOutput(answer.text)
    if (!parsed) {
      console.error("discover: answer failed validation; finish reason:", answer.finishReason ?? "none")
      return failWithDetail("bad_output", "Alpie’s answer couldn’t be read reliably. Try asking again.", `answer was not the expected JSON (finish reason: ${answer.finishReason ?? "none"}, ${answer.text.length} characters)`)
    }

    return json(buildDiscoverResponse(parsed, rows, answer.model))
  } catch (error) {
    console.error("discover: unexpected failure:", error instanceof Error ? error.name : "unknown")
    return failWithDetail("model_unavailable", "Something went wrong while searching. Try again.", `unexpected ${error instanceof Error ? error.name : "failure"}`)
  }
})
