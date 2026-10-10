// Identity now comes from Supabase Auth (src/auth). This module only keeps the
// return-to-item destination used while a visitor signs in.

// Left over from the format-only demo login. It granted a role from a localStorage value,
// so it is removed on load and never read.
try {
  localStorage.removeItem("uniflow-demo-session")
} catch {
  // Storage can be unavailable; there is nothing to clean up then.
}

// Where to send a visitor once student sign-in finishes, set when they tap Join or Save without
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
