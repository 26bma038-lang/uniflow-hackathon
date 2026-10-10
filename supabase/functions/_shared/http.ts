// Responses, CORS, and caller checks shared by the Edge Functions. Deno only.

import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2"
import { AI_ERROR_STATUS, type AiErrorBody, type AiErrorCode } from "./contracts.ts"

// The browser sends a bearer token, never a cookie, so any origin may call: without a
// valid session token the functions do nothing.
export const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-api-version",
  "Access-Control-Max-Age": "86400",
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  })
}

export function fail(code: AiErrorCode, message: string): Response {
  const body: AiErrorBody = { error: { code, message } }
  return json(body, AI_ERROR_STATUS[code])
}

// Answers OPTIONS and refuses anything that is not POST. Null means: carry on.
export function preflight(request: Request): Response | null {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders })
  if (request.method !== "POST") return fail("invalid_request", "Use POST.")
  return null
}

export type Caller = { userId: string; client: SupabaseClient }

// Checks the caller's session with Supabase Auth and returns a client that acts as them,
// so every query it makes goes through row level security. No service-role key is used.
export async function authenticate(request: Request): Promise<{ ok: true; caller: Caller } | { ok: false; response: Response }> {
  const url = Deno.env.get("SUPABASE_URL")
  // The project's public key: the one the browser sent, or the one the platform provides.
  const publicKey = request.headers.get("apikey") || Deno.env.get("SUPABASE_ANON_KEY")
  if (!url || !publicKey) {
    return { ok: false, response: fail("not_configured", "AI features aren’t set up on the server yet.") }
  }

  const header = request.headers.get("Authorization") ?? ""
  const token = /^Bearer\s+(.+)$/i.exec(header)?.[1]?.trim()
  if (!token) return { ok: false, response: fail("not_signed_in", "Sign in to use this.") }

  const client = createClient(url, publicKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  })

  try {
    const { data, error } = await client.auth.getUser(token)
    if (error || !data.user) return { ok: false, response: fail("not_signed_in", "Your session has expired. Sign in again.") }
    return { ok: true, caller: { userId: data.user.id, client } }
  } catch {
    return { ok: false, response: fail("model_unavailable", "Couldn’t check your session. Try again in a moment.") }
  }
}

// Reads a JSON body no larger than `maxBytes`. Null when it is too large; undefined when it is not JSON.
export async function readJson(request: Request, maxBytes: number): Promise<unknown | null | undefined> {
  const declared = Number(request.headers.get("content-length") ?? "0")
  if (declared > maxBytes) return null
  let text: string
  try {
    text = await request.text()
  } catch {
    return undefined
  }
  if (text.length > maxBytes) return null
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

export function modelSettings() {
  const timeout = Number(Deno.env.get("GEMMA_TIMEOUT_MS"))
  return {
    apiKey: Deno.env.get("GEMINI_API_KEY") ?? "",
    model: (Deno.env.get("GEMMA_MODEL") ?? "").trim(),
    // "minimal" keeps answers fast; set GEMMA_THINKING_LEVEL=high to trade speed for care,
    // or to an empty string to leave the model's default.
    thinkingLevel: (Deno.env.get("GEMMA_THINKING_LEVEL") ?? "minimal").trim(),
    timeoutMs: Number.isFinite(timeout) && timeout >= 1000 ? Math.min(timeout, 120_000) : 45_000,
  }
}
