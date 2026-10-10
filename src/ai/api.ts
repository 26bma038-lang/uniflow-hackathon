import type { AiResult, AiService, DiscoverRequest, DiscoverResponse, ExtractPosterRequest, ExtractPosterResponse } from "./contracts"

// Placeholder until the Edge Function calls are wired in. Signatures are final.
const NOT_READY = { ok: false, error: { code: "not_configured", message: "AI features aren’t connected yet." } } as const

export async function extractPoster(_request: ExtractPosterRequest): Promise<AiResult<ExtractPosterResponse>> {
  return NOT_READY
}

export async function discover(_request: DiscoverRequest): Promise<AiResult<DiscoverResponse>> {
  return NOT_READY
}

export const aiService: AiService = { extractPoster, discover }
