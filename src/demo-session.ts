export type DemoRole = "student" | "club"

export type DemoSession = {
  role: DemoRole
  displayName: string
  // Unverified, format-checked only. Replace with a real identity once a backend exists.
  email?: string
}

const SESSION_KEY = "uniflow-demo-session"

export function getDemoSession(): DemoSession | null {
  try {
    const value = JSON.parse(localStorage.getItem(SESSION_KEY) ?? "null")
    if (value?.role === "student" || value?.role === "club") {
      return {
        role: value.role,
        displayName: typeof value.displayName === "string" ? value.displayName : value.role === "student" ? "Alex" : "Campus Code Collective",
        email: typeof value.email === "string" ? value.email : undefined,
      }
    }
  } catch {
    return null
  }
  return null
}

export function enterDemo(role: DemoRole, displayName?: string, email?: string) {
  const session: DemoSession = {
    role,
    displayName: displayName ?? (role === "student" ? "Alex" : "Campus Code Collective"),
    ...(email ? { email } : {}),
  }
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
  return session
}

export function exitDemo() {
  localStorage.removeItem(SESSION_KEY)
}

// Where to send a visitor once student entry finishes, set when they tap Join or Save without
// a session. Only student item pages are accepted, so a stored value can never redirect elsewhere.
const PENDING_KEY = "uniflow-pending-destination"
const ITEM_ROUTE = /^\/app\/item\/[A-Za-z0-9_-]{1,80}$/

export function setPendingItemDestination(itemId: string) {
  const path = `/app/item/${itemId}`
  if (ITEM_ROUTE.test(path)) localStorage.setItem(PENDING_KEY, path)
}

export function peekPendingDestination(): string | null {
  const path = localStorage.getItem(PENDING_KEY)
  if (path && ITEM_ROUTE.test(path)) return path
  if (path !== null) localStorage.removeItem(PENDING_KEY)
  return null
}

export function takePendingDestination(): string | null {
  const path = peekPendingDestination()
  localStorage.removeItem(PENDING_KEY)
  return path
}

export function clearPendingDestination() {
  localStorage.removeItem(PENDING_KEY)
}
