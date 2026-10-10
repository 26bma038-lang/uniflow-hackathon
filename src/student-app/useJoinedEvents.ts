import { useCallback, useEffect, useMemo, useState } from "react"
import { getDemoSession } from "../demo-session"
import type { CampusItem } from "./types"

// Local demo RSVP. Nothing is sent to an organizer; swap this storage for an API later.
// Each entry belongs to one event and one demo student, keyed by normalized email.
export type JoinedEvent = {
  itemId: string
  email: string
  joinedAt: string
}

const STORAGE_KEY = "uniflow-student-joined-events"

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase()
}

// The demo student who can hold RSVPs, or null when nobody has entered the student demo.
export function getStudentEmail() {
  const session = getDemoSession()
  return session?.role === "student" && session.email ? normalizeEmail(session.email) : null
}

// Entries saved before RSVPs were tied to a student have no email and are dropped.
function readJoined(): JoinedEvent[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (entry): entry is JoinedEvent =>
        typeof entry?.itemId === "string" &&
        typeof entry?.email === "string" &&
        typeof entry?.joinedAt === "string",
    )
  } catch {
    return []
  }
}

// Only events can be joined. Scholarships, notices, deadlines, and opportunities cannot.
export function canJoin(item: CampusItem) {
  return item.category === "Event"
}

// Registration closes at the registration deadline, or when the event starts if there is none.
export function registrationCutoff(item: CampusItem) {
  return item.deadline ?? item.startDate
}

export function isRegistrationClosed(item: CampusItem, now = Date.now()) {
  const cutoff = registrationCutoff(item)
  if (!cutoff) return false
  const time = new Date(cutoff).getTime()
  return !Number.isNaN(time) && now > time
}

// RSVPs per event for the club workspace: each normalized email counts once per event.
// Returns numbers only, so no student email leaves this module.
export function readRsvpCounts() {
  const emailsByItem = new Map<string, Set<string>>()
  for (const entry of readJoined()) {
    const emails = emailsByItem.get(entry.itemId) ?? new Set<string>()
    emails.add(normalizeEmail(entry.email))
    emailsByItem.set(entry.itemId, emails)
  }
  return new Map([...emailsByItem].map(([itemId, emails]) => [itemId, emails.size]))
}

export function useJoinedEvents(email: string | null) {
  const [entries, setEntries] = useState<JoinedEvent[]>(readJoined)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
    } catch {
      // Local persistence is optional in the prototype.
    }
  }, [entries])

  const joined = useMemo(
    () => (email ? entries.filter((entry) => entry.email === email) : []),
    [entries, email],
  )
  const isJoined = useCallback(
    (itemId: string) => joined.some((entry) => entry.itemId === itemId),
    [joined],
  )
  const join = useCallback(
    (itemId: string) => {
      if (!email) return
      setEntries((current) =>
        current.some((entry) => entry.itemId === itemId && entry.email === email)
          ? current
          : [...current, { itemId, email, joinedAt: new Date().toISOString() }],
      )
    },
    [email],
  )
  const cancel = useCallback(
    (itemId: string) => {
      setEntries((current) =>
        current.filter((entry) => !(entry.itemId === itemId && entry.email === email)),
      )
    },
    [email],
  )

  return { email, joined, isJoined, join, cancel }
}

export type JoinedEvents = ReturnType<typeof useJoinedEvents>
