import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { isSupabaseConfigured, NOT_CONFIGURED_MESSAGE, supabase } from "./supabase"

export type AuthStatus = "loading" | "signed-out" | "signed-in"

// Club membership comes from public.club_members, read as the signed-in user. Row level
// security returns only that user's own rows, and no browser role can write the table.
// Anything other than "ready" with a matching club id means no workspace access.
// "idle" means nobody is signed in.
export type Memberships =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; clubIds: string[] }
  | { status: "error"; message: string }

type AuthValue = {
  status: AuthStatus
  configured: boolean
  user: User | null
  // Normalized email of the signed-in user, or null. The only identity the app trusts.
  email: string | null
  memberships: Memberships
  signIn: (email: string, password: string) => Promise<string | null>
  signOut: () => Promise<void>
  reloadMemberships: () => void
}

const AuthContext = createContext<AuthValue | null>(null)

function signInMessage(error: { message?: string; code?: string; status?: number }) {
  if (error.code === "invalid_credentials") return "That email and password don’t match an account. Check both and try again."
  if (error.code === "email_not_confirmed") return "This account’s email hasn’t been confirmed yet. Ask whoever set up your account."
  if (error.status === 429 || error.code === "over_request_rate_limit") return "Too many attempts. Wait a minute, then try again."
  if (!error.status) return "Couldn’t reach the sign-in service. Check your connection and try again."
  return error.message || "Sign-in failed. Try again."
}

function membershipMessage(error: { message?: string; code?: string }) {
  // PGRST205 / 42P01: the table is not there, so the backend migration has not been applied.
  if (error.code === "PGRST205" || error.code === "42P01") return "Club membership can’t be checked yet: the club tables haven’t been set up on the server."
  return "Couldn’t check your club membership. Check your connection and try again."
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(supabase ? "loading" : "signed-out")
  const [user, setUser] = useState<User | null>(null)
  // Kept with the user id it was read for, so one account's result is never shown for another.
  const [membershipState, setMembershipState] = useState<{ userId: string; value: Memberships } | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  // Restores a stored session on load, then follows sign-in, sign-out, and token refresh.
  useEffect(() => {
    if (!supabase) return
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser((current) => (current?.id === session?.user?.id ? current : session?.user ?? null))
      setStatus(session?.user ? "signed-in" : "signed-out")
    })
    return () => data.subscription.unsubscribe()
  }, [])

  const userId = user?.id ?? null
  useEffect(() => {
    if (!supabase || !userId) {
      setMembershipState(null)
      return
    }
    let cancelled = false
    setMembershipState({ userId, value: { status: "loading" } })
    supabase
      .from("club_members")
      .select("club_id")
      .eq("user_id", userId)
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) setMembershipState({ userId, value: { status: "error", message: membershipMessage(error) } })
        else setMembershipState({ userId, value: { status: "ready", clubIds: (data ?? []).map((row) => String(row.club_id)) } })
      })
    return () => {
      cancelled = true
    }
  }, [userId, reloadToken])

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return NOT_CONFIGURED_MESSAGE
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim().toLowerCase(), password })
      return error ? signInMessage(error) : null
    } catch {
      return signInMessage({})
    }
  }, [])

  const signOut = useCallback(async () => {
    if (!supabase) return
    // If the server can't be reached, still drop the session held in this browser.
    const { error } = await supabase.auth.signOut()
    if (error) await supabase.auth.signOut({ scope: "local" })
  }, [])

  const reloadMemberships = useCallback(() => setReloadToken((value) => value + 1), [])

  const memberships = useMemo<Memberships>(() => {
    if (!userId) return { status: "idle" }
    return membershipState?.userId === userId ? membershipState.value : { status: "loading" }
  }, [membershipState, userId])

  const value = useMemo<AuthValue>(
    () => ({
      status,
      configured: isSupabaseConfigured,
      user,
      email: user?.email ? user.email.trim().toLowerCase() : null,
      memberships,
      signIn,
      signOut,
      reloadMemberships,
    }),
    [status, user, memberships, signIn, signOut, reloadMemberships],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth must be used inside AuthProvider")
  return value
}

// The clubs this user may open, in the order given. Empty unless membership was read successfully.
export function allowedClubIds(memberships: Memberships, knownClubIds: string[]) {
  return memberships.status === "ready" ? knownClubIds.filter((id) => memberships.clubIds.includes(id)) : []
}

export default AuthProvider
