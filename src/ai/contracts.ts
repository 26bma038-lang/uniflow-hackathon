import type { EventDraft, EventDraftField } from "../components/poster-to-event/types"

// Shared request and response shapes for UniFlow's AI features. The Edge Functions in
// supabase/functions/ return exactly these shapes, and the components in src/ai/components/
// consume them. Change this file first, and tell the other side, before changing either.

export type AiErrorCode =
  | "not_configured" // Supabase env or the function's model key is missing
  | "not_signed_in"
  | "not_a_member" // caller is not a member of the club they are extracting for
  | "invalid_image" // not PNG, JPEG, or WebP, or not decodable
  | "too_large"
  | "invalid_request"
  | "rate_limited"
  | "model_unavailable" // the model call failed or timed out
  | "bad_output" // the model answered, but not in a shape that passed validation
  | "network"

export type AiError = { code: AiErrorCode; message: string }
export type AiResult<T> = { ok: true; value: T } | { ok: false; error: AiError }

// ---------------------------------------------------------------- poster extraction

export type PosterMimeType = "image/png" | "image/jpeg" | "image/webp"
export const POSTER_MIME_TYPES: PosterMimeType[] = ["image/png", "image/jpeg", "image/webp"]
// Size of the image file itself, before base64.
export const POSTER_MAX_BYTES = 4 * 1024 * 1024

export type ExtractPosterRequest = {
  clubId: string
  image: { mimeType: PosterMimeType; dataBase64: string }
}

// A field the reviewer must look at: the model was unsure, or validation changed its answer.
export type ExtractionFlag = { field: EventDraftField; reason: string }

export type ExtractPosterResponse = {
  // Only fields the poster actually states. Anything missing is left out, never guessed.
  // Formats match EventDraft: dates YYYY-MM-DD, times HH:mm, registrationDeadline
  // YYYY-MM-DD or YYYY-MM-DDTHH:mm, registrationUrl http(s) or absent.
  values: Partial<EventDraft>
  extractedFields: EventDraftField[]
  // Ambiguous dates and anything else that needs a human decision.
  flags: ExtractionFlag[]
  model: string
}

// ---------------------------------------------------------------- discovery

export type DiscoverRequest = { query: string }
export const DISCOVER_MAX_QUERY_LENGTH = 300

// One published record the answer relies on. Every id is a row the caller can read.
export type DiscoverSource = {
  id: string
  title: string
  publisher: string
  category: string
  startDate: string | null // ISO date-time or null
  deadline: string | null // ISO date-time or null
  venue: string | null
  // In-app page for the record, e.g. /explore/item/<id>.
  path: string
  // The publisher's own registration or source link, when the record has one.
  sourceUrl: string | null
}

export type DiscoverResponse = {
  // Plain text. Says so when nothing published matches; never invents a record.
  answer: string
  // Records the answer cites, in the order cited. Empty when nothing matched.
  sources: DiscoverSource[]
  model: string
}

export type AiService = {
  extractPoster(request: ExtractPosterRequest): Promise<AiResult<ExtractPosterResponse>>
  discover(request: DiscoverRequest): Promise<AiResult<DiscoverResponse>>
}
