import { useEffect, useMemo, useSyncExternalStore } from "react"
import { campusItems } from "../student-app/data"
import type { CampusItem } from "../student-app/types"
import { listPublishedEvents } from "./events-api"
import { toCampusItem } from "./publishing"

// Published club updates, read from the server and shared by Explore, the student app, and
// the club sign-in page. One request serves every component on the page.
export type PublishedEvents = {
  status: "loading" | "ready" | "error"
  items: CampusItem[]
  message: string | null
}

let state: PublishedEvents = { status: "loading", items: [], message: null }
let inFlight: Promise<void> | null = null
const listeners = new Set<() => void>()

function setState(next: PublishedEvents) {
  state = next
  listeners.forEach((listener) => listener())
}

// Keeps what is already shown while it refetches, and keeps it if the refetch fails.
export function refreshPublishedEvents() {
  if (inFlight) return inFlight
  inFlight = listPublishedEvents()
    .then((result) => {
      if (result.ok) setState({ status: "ready", items: result.value.map(toCampusItem), message: null })
      else setState({ status: "error", items: state.items, message: result.message })
    })
    .catch(() => setState({ status: "error", items: state.items, message: "Couldn’t load published updates." }))
    .finally(() => {
      inFlight = null
    })
  return inFlight
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function usePublishedEvents() {
  const snapshot = useSyncExternalStore(subscribe, () => state)
  useEffect(() => {
    void refreshPublishedEvents()
    const onVisible = () => {
      if (document.visibilityState === "visible") void refreshPublishedEvents()
    }
    document.addEventListener("visibilitychange", onVisible)
    return () => document.removeEventListener("visibilitychange", onVisible)
  }, [])
  return snapshot
}

const key = (entry: CampusItem) => `${entry.title.toLowerCase()}::${entry.publisher.toLowerCase()}`

// Published club updates plus the sample records that ship with the prototype. A sample is
// dropped when a published update has the same id, or the same title from the same publisher.
export function mergeWithSamples(published: CampusItem[], publishedFirst: boolean) {
  const ids = new Set(published.map((entry) => entry.id))
  const keys = new Set(published.map(key))
  const samples = campusItems.filter((entry) => !ids.has(entry.id) && !keys.has(key(entry)))
  return publishedFirst ? [...published, ...samples] : [...samples, ...published]
}

export function useCampusItems(publishedFirst: boolean) {
  const published = usePublishedEvents()
  const items = useMemo(() => mergeWithSamples(published.items, publishedFirst), [published.items, publishedFirst])
  return { items, status: published.status, message: published.message }
}
