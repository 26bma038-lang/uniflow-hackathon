// POST /functions/v1/extract-poster
// ExtractPosterRequest -> ExtractPosterResponse (src/ai/contracts.ts), or { error: { code, message } }.
//
// A signed-in member of request.clubId sends one poster image. Gemma reads it, and
// _shared/poster.ts checks every field before anything is returned. Nothing is stored and
// nothing is published here: the result only pre-fills the draft form a human reviews.

import { POSTER_MAX_BYTES } from "../_shared/contracts.ts"
import { callGemma, DEFAULT_GEMMA_MODEL } from "../_shared/gemma.ts"
import { authenticate, fail, json, modelSettings, preflight, readJson } from "../_shared/http.ts"
import { checkPosterImage, extractJsonObject, normalizePosterOutput, POSTER_SYSTEM_INSTRUCTION, POSTER_USER_PROMPT, todayIn } from "../_shared/poster.ts"

const CLUB_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/
// Base64 is 4/3 the size of the file; the rest is room for the JSON around it.
const MAX_BODY_BYTES = Math.ceil((POSTER_MAX_BYTES * 4) / 3) + 16 * 1024

Deno.serve(async (request) => {
  const early = preflight(request)
  if (early) return early

  try {
    const auth = await authenticate(request)
    if (!auth.ok) return auth.response
    const { client } = auth.caller

    const body = await readJson(request, MAX_BODY_BYTES)
    if (body === null) return fail("too_large", `That image is too large. Use one under ${POSTER_MAX_BYTES / (1024 * 1024)} MB.`)
    if (typeof body !== "object" || body === undefined || Array.isArray(body)) return fail("invalid_request", "The request wasn’t understood.")

    const { clubId, image } = body as { clubId?: unknown; image?: { mimeType?: unknown; dataBase64?: unknown } | null }
    if (typeof clubId !== "string" || clubId.length > 80 || !CLUB_ID.test(clubId)) return fail("invalid_request", "Choose the club this poster is for.")
    if (typeof image !== "object" || image === null) return fail("invalid_request", "Attach a poster image.")

    const checked = checkPosterImage(image.mimeType, image.dataBase64, POSTER_MAX_BYTES)
    if (!checked.ok) return fail(checked.code, checked.message)

    // Asked as the caller, so row level security answers: a user only sees their own memberships.
    const membership = await client.rpc("is_club_member", { p_club_id: clubId })
    if (membership.error) {
      console.error("extract-poster: membership check failed", membership.error.code ?? "")
      return fail("model_unavailable", "Couldn’t check your club membership. Try again in a moment.")
    }
    if (membership.data !== true) return fail("not_a_member", "Only members of this club can extract from its posters.")

    const settings = modelSettings()
    if (!settings.apiKey) {
      console.error("extract-poster: GEMINI_API_KEY is not set")
      return fail("not_configured", "Poster extraction isn’t set up on the server yet.")
    }
    const model = settings.model || DEFAULT_GEMMA_MODEL

    const answer = await callGemma({
      apiKey: settings.apiKey,
      model,
      systemInstruction: POSTER_SYSTEM_INSTRUCTION,
      parts: [{ inline_data: { mime_type: checked.mimeType, data: checked.dataBase64 } }, { text: POSTER_USER_PROMPT }],
      maxOutputTokens: 4096,
      timeoutMs: settings.timeoutMs,
      thinkingLevel: settings.thinkingLevel,
    })
    if (!answer.ok) {
      console.error("extract-poster: model call failed:", answer.detail)
      return fail(answer.code, answer.message)
    }

    const parsed = extractJsonObject(answer.text)
    const result = parsed === undefined ? null : normalizePosterOutput(parsed, { today: todayIn("Asia/Kolkata"), model })
    if (!result || !result.ok) {
      console.error("extract-poster: answer failed validation:", result ? result.reason : "not JSON")
      return fail("bad_output", "The poster couldn’t be read reliably. Try a clearer image, or fill in the details by hand.")
    }

    console.log(`extract-poster: club ${clubId} fields ${result.value.extractedFields.length} flags ${result.value.flags.length}`)
    return json(result.value)
  } catch (error) {
    console.error("extract-poster: unexpected failure:", error instanceof Error ? error.name : "unknown")
    return fail("model_unavailable", "Something went wrong while reading the poster. Try again.")
  }
})
