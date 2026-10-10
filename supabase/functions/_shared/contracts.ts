// Server-side copy of the shapes in src/ai/contracts.ts. Edge Functions are bundled from
// supabase/functions only, so they cannot import from src/. The two are kept identical by a
// compile-time check at the bottom of src/ai/api.ts: `npx tsc --noEmit -p .` fails if they
// drift. Change src/ai/contracts.ts first, then this file.
//
// Types and constants only: no Deno, no imports, so the app's tsc and Node can read it.

export type AiErrorCode =
  | "not_configured"
  | "not_signed_in"
  | "not_a_member"
  | "invalid_image"
  | "too_large"
  | "invalid_request"
  | "rate_limited"
  | "model_unavailable"
  | "bad_output"
  | "network"

export type AiError = { code: AiErrorCode; message: string }

export type EventDraft = {
  title: string
  description: string
  category: string
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  timezone: string
  venue: string
  eligibility: string
  registrationDeadline: string
  registrationUrl: string
}

export type EventDraftField = keyof EventDraft

export const EVENT_DRAFT_FIELDS: EventDraftField[] = [
  "title",
  "description",
  "category",
  "startDate",
  "startTime",
  "endDate",
  "endTime",
  "timezone",
  "venue",
  "eligibility",
  "registrationDeadline",
  "registrationUrl",
]

export type PosterMimeType = "image/png" | "image/jpeg" | "image/webp"
export const POSTER_MIME_TYPES: PosterMimeType[] = ["image/png", "image/jpeg", "image/webp"]
export const POSTER_MAX_BYTES = 4 * 1024 * 1024

export type ExtractPosterRequest = {
  clubId: string
  image: { mimeType: PosterMimeType; dataBase64: string }
}

export type ExtractionFlag = { field: EventDraftField; reason: string }

export type ExtractPosterResponse = {
  values: Partial<EventDraft>
  extractedFields: EventDraftField[]
  flags: ExtractionFlag[]
  model: string
}

export type DiscoverRequest = { query: string }
export const DISCOVER_MAX_QUERY_LENGTH = 300

export type DiscoverSource = {
  id: string
  title: string
  publisher: string
  category: string
  startDate: string | null
  deadline: string | null
  venue: string | null
  path: string
  sourceUrl: string | null
}

export type DiscoverResponse = {
  answer: string
  sources: DiscoverSource[]
  model: string
}

// What a failed call returns as its JSON body, with the HTTP status from AI_ERROR_STATUS.
export type AiErrorBody = { error: AiError }

export const AI_ERROR_STATUS: Record<AiErrorCode, number> = {
  not_configured: 503,
  not_signed_in: 401,
  not_a_member: 403,
  invalid_image: 415,
  too_large: 413,
  invalid_request: 400,
  rate_limited: 429,
  model_unavailable: 502,
  bad_output: 502,
  network: 502,
}
