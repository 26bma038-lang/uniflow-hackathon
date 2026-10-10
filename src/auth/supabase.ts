import { createClient, type SupabaseClient } from "@supabase/supabase-js"

// Browser client. Only the project URL and the publishable key belong here: both are public
// by design, and row level security decides what a signed-in user can read or write.
// Secret and service-role keys must never be given a VITE_ name or imported into src/.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined

export const isSupabaseConfigured = Boolean(url && publishableKey)

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, publishableKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
    })
  : null

export const NOT_CONFIGURED_MESSAGE =
  "Sign-in isn’t set up in this build. Add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY to .env.local and restart the dev server."
