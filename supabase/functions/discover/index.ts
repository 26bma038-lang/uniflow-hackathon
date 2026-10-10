// POST /functions/v1/discover
// DiscoverRequest -> DiscoverResponse (src/ai/contracts.ts), or { error: { code, message } }.
//
// A signed-in user asks a question. The function reads published events as that user, gives
// Gemma only those rows, and returns the answer with the rows it cites. Sources are built
// from the database rows; an id the model returns that was not fetched is dropped.

import { DISCOVER_MAX_QUERY_LENGTH } from "../_shared/contracts.ts"
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
import { callGemma, DEFAULT_GEMMA_MODEL } from "../_shared/gemma.ts"
import { authenticate, fail, json, modelSettings, preflight, readJson } from "../_shared/http.ts"
import { todayIn } from "../_shared/poster.ts"

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

    const settings = modelSettings()
    const model = settings.model || DEFAULT_GEMMA_MODEL

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
      return fail("model_unavailable", "Couldn’t read the published updates. Try again in a moment.")
    }
    const rows = (data ?? []) as unknown as PublishedRow[]
    if (rows.length === 0) return json({ answer: NOTHING_PUBLISHED_ANSWER, sources: [], model })

    if (!settings.apiKey) {
      console.error("discover: GEMINI_API_KEY is not set")
      return fail("not_configured", "AI search isn’t set up on the server yet.")
    }

    const answer = await callGemma({
      apiKey: settings.apiKey,
      model,
      systemInstruction: DISCOVER_SYSTEM_INSTRUCTION,
      parts: [{ text: buildDiscoverPrompt(query, rows, todayIn("Asia/Kolkata")) }],
      maxOutputTokens: 2048,
      timeoutMs: settings.timeoutMs,
      thinkingLevel: settings.thinkingLevel,
    })
    if (!answer.ok) {
      console.error("discover: model call failed:", answer.detail)
      return fail(answer.code, answer.message)
    }

    const parsed = parseDiscoverOutput(answer.text)
    if (!parsed) {
      console.error("discover: answer failed validation")
      return fail("bad_output", "The search answer couldn’t be read reliably. Try asking again.")
    }

    return json(buildDiscoverResponse(parsed, rows, model))
  } catch (error) {
    console.error("discover: unexpected failure:", error instanceof Error ? error.name : "unknown")
    return fail("model_unavailable", "Something went wrong while searching. Try again.")
  }
})
