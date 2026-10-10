import { useCallback, useEffect, useMemo, useState } from "react"
import type { SavedItem } from "./types"

// Saved items belong to one demo student, keyed by normalized email, like RSVPs.
type SavedEntry = SavedItem & { email: string }

const STORAGE_KEY = "uniflow-student-saved-items"
// Entries saved before items were tied to a student. Kept as they were, shown to nobody.
const LEGACY_KEY = "uniflow-student-saved-items-legacy"

function readSaved(): SavedEntry[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
    if (!Array.isArray(parsed)) return []
    const valid = parsed.filter(
      (item): item is SavedItem & { email?: unknown } =>
        typeof item?.itemId === "string" && typeof item?.savedAt === "string",
    )
    const owned = valid.filter((item): item is SavedEntry => typeof item.email === "string")
    const shared = valid.filter((item) => typeof item.email !== "string")
    if (shared.length) {
      // Old shared data cannot be attributed to a student, so set it aside instead of guessing.
      const earlier = JSON.parse(localStorage.getItem(LEGACY_KEY) ?? "[]")
      localStorage.setItem(LEGACY_KEY, JSON.stringify([...(Array.isArray(earlier) ? earlier : []), ...shared]))
      localStorage.setItem(STORAGE_KEY, JSON.stringify(owned))
    }
    return owned
  } catch {
    return []
  }
}

export function useSavedItems(email: string | null) {
  const [entries, setEntries] = useState<SavedEntry[]>(readSaved)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {
      // Local persistence is optional in the prototype.
    }
  }, [entries])

  const saved = useMemo<SavedItem[]>(
    () => (email ? entries.filter((entry) => entry.email === email) : []),
    [entries, email],
  )
  const isSaved = useCallback(
    (itemId: string) => saved.some((item) => item.itemId === itemId),
    [saved],
  )
  const toggleSaved = useCallback(
    (itemId: string) => {
      if (!email) return
      setEntries((current) =>
        current.some((entry) => entry.itemId === itemId && entry.email === email)
          ? current.filter((entry) => !(entry.itemId === itemId && entry.email === email))
          : [...current, { itemId, email, savedAt: new Date().toISOString() }],
      )
    },
    [email],
  )

  return { saved, isSaved, toggleSaved }
}
