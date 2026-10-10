import { supabase } from "../auth/supabase"
import {
  DISCOVER_MAX_QUERY_LENGTH,
  POSTER_MAX_BYTES,
  POSTER_MIME_TYPES,
  type AiError,
  type AiErrorCode,
  type AiResult,
  type AiService,
  type DiscoverRequest,
  type DiscoverResponse,
  type ExtractPosterRequest,
  type ExtractPosterResponse,
} from "./contracts"
import type * as Server from "../../supabase/functions/_shared/contracts.ts"

// Calls to the extract-poster and discover Edge Functions (supabase/functions/). The model
// key lives only in those functions. Every call resolves to an AiResult and never throws.

const ERROR_CODES: AiErrorCode[] = [
  "not_configured", "not_signed_in", "not_a_member", "invalid_image", "too_large",
  "invalid_request", "rate_limited", "model_unavailable", "bad_output", "network",
]

const FALLBACK_MESSAGES: Record<AiErrorCode, string> = {
  not_configured: "AI features aren’t set up yet.",
  not_signed_in: "Sign in to use this.",
  not_a_member: "Only members of this club can do that.",
  invalid_image: "Upload a PNG, JPEG, or WebP image.",
  too_large: "That file is too large.",
  invalid_request: "That request wasn’t understood.",
  rate_limited: "Too many requests right now. Wait a minute and try again.",
  model_unavailable: "The AI model couldn’t answer right now. Try again in a moment.",
  bad_output: "The AI answer couldn’t be read reliably. Try again.",
  network: "Couldn’t reach the server. Check your connection and try again.",
}

// Longer than the function's own model timeout, so its error message normally arrives first.
const REQUEST_TIMEOUT_MS = 75_000

function failure(code: AiErrorCode, message?: string): { ok: false; error: AiError } {
  return { ok: false, error: { code, message: message || FALLBACK_MESSAGES[code] } }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}

// Reads the { error: { code, message } } body the functions send with a failed status.
async function failureFromResponse(response: unknown): Promise<{ ok: false; error: AiError }> {
  let status = 0
  let body: unknown = null
  if (response instanceof Response) {
    status = response.status
    try {
      body = await response.clone().json()
    } catch {
      body = null
    }
  }
  const error = isRecord(body) && isRecord(body.error) ? body.error : null
  if (error && typeof error.code === "string" && ERROR_CODES.includes(error.code as AiErrorCode)) {
    return failure(error.code as AiErrorCode, typeof error.message === "string" ? error.message : undefined)
  }
  // No body of ours: the gateway answered instead of the function.
  if (status === 401) return failure("not_signed_in", "Your session has expired. Sign in again.")
  if (status === 403) return failure("not_a_member")
  if (status === 404) return failure("not_configured", "The AI functions haven’t been deployed to the server yet.")
  if (status === 413) return failure("too_large")
  if (status === 429) return failure("rate_limited")
  if (status === 400 || status === 422) return failure("invalid_request")
  return failure("model_unavailable")
}

async function call(name: "extract-poster" | "discover", body: unknown): Promise<AiResult<unknown>> {
  if (!supabase) return failure("not_configured", "AI features need Supabase. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local and restart the dev server.")
  try {
    const { data: session } = await supabase.auth.getSession()
    if (!session.session) return failure("not_signed_in")

    const { data, error } = await supabase.functions.invoke(name, { body: body as Record<string, unknown>, timeout: REQUEST_TIMEOUT_MS })
    if (!error) return { ok: true, value: data }

    const kind = (error as { name?: string }).name
    if (kind === "FunctionsHttpError") return await failureFromResponse((error as { context?: unknown }).context)
    if (kind === "FunctionsRelayError") return failure("model_unavailable")
    if (typeof navigator !== "undefined" && navigator.onLine === false) return failure("network", "You’re offline. Reconnect and try again.")
    return failure("network")
  } catch {
    return failure("network")
  }
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
}

// Size of the file a base64 string encodes, without decoding it.
function decodedBytes(base64: string) {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0
  return Math.floor((base64.length * 3) / 4) - padding
}

export async function extractPoster(request: ExtractPosterRequest): Promise<AiResult<ExtractPosterResponse>> {
  // The server repeats every check; these only save a round trip.
  if (!request?.clubId) return failure("invalid_request", "Choose the club this poster is for.")
  if (!request.image || !POSTER_MIME_TYPES.includes(request.image.mimeType)) return failure("invalid_image")
  if (typeof request.image.dataBase64 !== "string" || request.image.dataBase64 === "") return failure("invalid_image", "The image arrived empty. Choose the file again.")
  if (decodedBytes(request.image.dataBase64) > POSTER_MAX_BYTES) {
    return failure("too_large", `That image is too large. Use one under ${POSTER_MAX_BYTES / (1024 * 1024)} MB.`)
  }

  const result = await call("extract-poster", { clubId: request.clubId, image: { mimeType: request.image.mimeType, dataBase64: request.image.dataBase64 } })
  if (!result.ok) return result

  const value = result.value
  if (
    !isRecord(value) ||
    !isRecord(value.values) ||
    !Object.values(value.values).every((entry) => typeof entry === "string") ||
    !isStringArray(value.extractedFields) ||
    !Array.isArray(value.flags) ||
    !value.flags.every((flag) => isRecord(flag) && typeof flag.field === "string" && typeof flag.reason === "string") ||
    typeof value.model !== "string"
  ) {
    return failure("bad_output", "The poster couldn’t be read reliably. Try again, or fill in the details by hand.")
  }
  return { ok: true, value: value as unknown as ExtractPosterResponse }
}

export async function discover(request: DiscoverRequest): Promise<AiResult<DiscoverResponse>> {
  const query = typeof request?.query === "string" ? request.query.trim() : ""
  if (query === "") return failure("invalid_request", "Type a question first.")
  if (query.length > DISCOVER_MAX_QUERY_LENGTH) return failure("invalid_request", `Keep the question under ${DISCOVER_MAX_QUERY_LENGTH} characters.`)

  const result = await call("discover", { query })
  if (!result.ok) return result

  const value = result.value
  const nullableString = (entry: unknown) => entry === null || typeof entry === "string"
  if (
    !isRecord(value) ||
    typeof value.answer !== "string" ||
    typeof value.model !== "string" ||
    !Array.isArray(value.sources) ||
    !value.sources.every(
      (source) =>
        isRecord(source) &&
        typeof source.id === "string" &&
        typeof source.title === "string" &&
        typeof source.publisher === "string" &&
        typeof source.category === "string" &&
        typeof source.path === "string" &&
        nullableString(source.startDate) &&
        nullableString(source.deadline) &&
        nullableString(source.venue) &&
        nullableString(source.sourceUrl),
    )
  ) {
    return failure("bad_output", "The search answer couldn’t be read reliably. Try asking again.")
  }
  return { ok: true, value: value as unknown as DiscoverResponse }
}

export const aiService: AiService = { extractPoster, discover }

// Compile-time check that the Edge Functions' copy of the contract (which cannot import
// from src/) is identical to ./contracts. `npx tsc --noEmit -p .` fails here if they drift.
type Same<A, B> = (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false
type ContractsInSync = [
  Same<Server.AiErrorCode, AiErrorCode>,
  Same<Server.ExtractPosterRequest, ExtractPosterRequest>,
  Same<Server.ExtractPosterResponse, ExtractPosterResponse>,
  Same<Server.DiscoverRequest, DiscoverRequest>,
  Same<Server.DiscoverResponse, DiscoverResponse>,
]
const contractsInSync: ContractsInSync = [true, true, true, true, true]
void contractsInSync
