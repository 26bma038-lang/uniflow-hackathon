import { useCallback, useEffect, useMemo, useState } from "react"
import { cancelRsvp, joinEvent, listMyRsvps } from "../club/events-api"
import type { CampusItem } from "./types"

// RSVPs live in public.rsvps. Each row belongs to one event and the signed-in user; the
// database fills in the user from the session and enforces the registration window.
export type JoinedEvent = {
  itemId: string
  joinedAt: string
}

// Only events can be joined. Scholarships, notices, deadlines, and opportunities cannot.
export function canJoin(item: CampusItem) {
  return item.category === "Event"
}

// An RSVP needs a row in the events table to point at. Sample records that only ship with
// the prototype have none, so they can be read but not joined.
export function acceptsRsvps(item: CampusItem) {
  return canJoin(item) && Boolean(item.isClubPublication)
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

export function useJoinedEvents(userId: string | null, email: string | null) {
  const [joined, setJoined] = useState<JoinedEvent[]>([])
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "error">(userId ? "loading" : "idle")
  // The event a join or cancel is in flight for, and the last thing that went wrong.
  const [pendingId, setPendingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    if (!userId) {
      setJoined([])
      setStatus("idle")
      return
    }
    let cancelled = false
    setStatus("loading")
    listMyRsvps(userId).then((result) => {
      if (cancelled) return
      if (result.ok) {
        setJoined(result.value)
        setStatus("ready")
        setError(null)
      } else {
        setStatus("error")
        setError(result.message)
      }
    })
    return () => {
      cancelled = true
    }
  }, [userId, reloadToken])

  const isJoined = useCallback((itemId: string) => joined.some((entry) => entry.itemId === itemId), [joined])

  const join = useCallback(
    async (itemId: string) => {
      if (!userId || pendingId) return
      setPendingId(itemId)
      setError(null)
      const result = await joinEvent(itemId)
      if (result.ok) setJoined((current) => (current.some((entry) => entry.itemId === itemId) ? current : [...current, result.value]))
      else setError(result.message)
      setPendingId(null)
    },
    [userId, pendingId],
  )

  const cancel = useCallback(
    async (itemId: string) => {
      if (!userId || pendingId) return
      setPendingId(itemId)
      setError(null)
      const result = await cancelRsvp(itemId, userId)
      if (result.ok) setJoined((current) => current.filter((entry) => entry.itemId !== itemId))
      else setError(result.message)
      setPendingId(null)
    },
    [userId, pendingId],
  )

  const reload = useCallback(() => setReloadToken((value) => value + 1), [])

  return useMemo(
    () => ({ email, joined, isJoined, join, cancel, status, pendingId, error, reload }),
    [email, joined, isJoined, join, cancel, status, pendingId, error, reload],
  )
}

export type JoinedEvents = ReturnType<typeof useJoinedEvents>
