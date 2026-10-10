import { supabase, NOT_CONFIGURED_MESSAGE } from "../auth/supabase"
import { getDemoClub, type ClubRecord, type PublicationStatus } from "./publishing"

// Everything the app reads from or writes to public.events and public.rsvps. Row level
// security on the server decides what each call may touch: anyone reads published events,
// a club member reads and writes that club's events, a signed-in user owns their RSVPs.

type EventRow = {
  id: string
  club_id: string
  status: "draft" | "needs_review" | "ready_for_approval" | "published"
  title: string
  description: string
  category: string
  start_date: string | null
  start_time: string | null
  end_date: string | null
  end_time: string | null
  timezone: string
  venue: string
  eligibility: string
  registration_deadline: string | null
  registration_url: string
  source: ClubRecord["source"]
  source_name: string
  department: string
  review_confirmed: boolean
  reviewed_at: string | null
  approved_at: string | null
  published_at: string | null
  created_at: string
  updated_at: string
  club?: { name: string; campus_id: string } | null
}

export type ApiResult<T> = { ok: true; value: T } | { ok: false; message: string }

const EVENT_COLUMNS = "*, club:clubs(name, campus_id)"
const DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/
const DEADLINE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000

function failure(error: { message?: string; code?: string } | null, fallback: string): { ok: false; message: string } {
  if (!error) return { ok: false, message: fallback }
  if (error.code === "PGRST205" || error.code === "42P01") return { ok: false, message: "The event tables haven’t been set up on the server yet." }
  if (error.code === "42501") return { ok: false, message: "This account isn’t allowed to do that. Club updates can only be changed by members of that club." }
  if (error.code === "PGRST301" || error.code === "401") return { ok: false, message: "Your session has expired. Sign in again." }
  // Raised by the database's own rules (RSVP window, reviewed-before-published, URL format).
  if (error.code === "23514" || error.code === "P0001") return { ok: false, message: error.message || fallback }
  if (error.code === "23503") return { ok: false, message: "That update no longer exists." }
  if (!error.code) return { ok: false, message: "Couldn’t reach the server. Check your connection and try again." }
  return { ok: false, message: fallback }
}

// The deadline field is typed by hand, as a date or a date and time in campus time (IST).
function deadlineToTimestamp(value: string) {
  return value.includes("T") ? `${value}:00+05:30` : `${value}T23:59:00+05:30`
}

function timestampToDeadline(value: string | null) {
  if (!value) return ""
  const time = new Date(value).getTime()
  return Number.isNaN(time) ? "" : new Date(time + IST_OFFSET_MS).toISOString().slice(0, 16)
}

// Checked before a write so a typo shows a readable message instead of a database error.
export function validateRecord(record: ClubRecord): string | null {
  if (record.startDate && !DATE.test(record.startDate)) return "Event date must look like 2026-10-18."
  if (record.endDate && !DATE.test(record.endDate)) return "End date must look like 2026-10-18."
  if (record.startTime && !TIME.test(record.startTime)) return "Start time must look like 16:00."
  if (record.endTime && !TIME.test(record.endTime)) return "End time must look like 18:00."
  if (record.registrationDeadline && !DEADLINE.test(record.registrationDeadline)) return "Registration deadline must look like 2026-10-17 or 2026-10-17T18:00."
  if (record.registrationUrl && !/^https?:\/\//i.test(record.registrationUrl)) return "Registration link must start with http:// or https://."
  return null
}

function toRow(record: ClubRecord) {
  const status: EventRow["status"] = record.status === "published_demo" ? "published" : record.status
  // created_by, created_at, updated_at, and published_at are set by the database.
  return {
    id: record.id,
    club_id: record.clubId,
    status,
    title: record.title,
    description: record.description,
    category: record.category,
    start_date: record.startDate || null,
    start_time: record.startTime || null,
    end_date: record.endDate || null,
    end_time: record.endTime || null,
    timezone: record.timezone || "Asia/Kolkata",
    venue: record.venue,
    eligibility: record.eligibility,
    registration_deadline: record.registrationDeadline ? deadlineToTimestamp(record.registrationDeadline) : null,
    registration_url: record.registrationUrl,
    source: record.source,
    source_name: record.sourceName || record.source,
    department: record.department,
    review_confirmed: record.reviewConfirmed,
    reviewed_at: record.reviewedAt,
    approved_at: record.approvedAt,
  }
}

export function fromRow(row: EventRow): ClubRecord {
  const status: PublicationStatus = row.status === "published" ? "published_demo" : row.status
  return {
    id: row.id,
    clubId: row.club_id,
    status,
    title: row.title,
    description: row.description,
    category: row.category,
    startDate: row.start_date ?? "",
    startTime: row.start_time?.slice(0, 5) ?? "",
    endDate: row.end_date ?? "",
    endTime: row.end_time?.slice(0, 5) ?? "",
    timezone: row.timezone,
    venue: row.venue,
    eligibility: row.eligibility,
    registrationDeadline: timestampToDeadline(row.registration_deadline),
    registrationUrl: row.registration_url,
    source: row.source,
    sourceName: row.source_name,
    department: row.department,
    publisher: row.club?.name ?? getDemoClub(row.club_id).name,
    publisherCampusId: row.club?.campus_id ?? "demo-campus",
    reviewConfirmed: row.review_confirmed,
    reviewedAt: row.reviewed_at,
    approvedAt: row.approved_at,
    publishedAt: row.published_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

// Published events from every club. Readable without signing in.
export async function listPublishedEvents(): Promise<ApiResult<ClubRecord[]>> {
  if (!supabase) return { ok: false, message: NOT_CONFIGURED_MESSAGE }
  const { data, error } = await supabase.from("events").select(EVENT_COLUMNS).eq("status", "published").order("published_at", { ascending: false })
  if (error) return failure(error, "Couldn’t load published updates.")
  return { ok: true, value: (data as EventRow[]).map(fromRow) }
}

// Every event of one club, drafts included. Returns nothing unless the caller is a member.
export async function listClubEvents(clubId: string): Promise<ApiResult<ClubRecord[]>> {
  if (!supabase) return { ok: false, message: NOT_CONFIGURED_MESSAGE }
  const { data, error } = await supabase.from("events").select(EVENT_COLUMNS).eq("club_id", clubId).order("updated_at", { ascending: false })
  if (error) return failure(error, "Couldn’t load this club’s updates.")
  return { ok: true, value: (data as EventRow[]).map(fromRow) }
}

export async function saveEvent(record: ClubRecord): Promise<ApiResult<ClubRecord>> {
  if (!supabase) return { ok: false, message: NOT_CONFIGURED_MESSAGE }
  const problem = validateRecord(record)
  if (problem) return { ok: false, message: problem }
  const { data, error } = await supabase.from("events").upsert(toRow(record), { onConflict: "id" }).select(EVENT_COLUMNS).single()
  if (error) return failure(error, "Couldn’t save this update.")
  return { ok: true, value: fromRow(data as EventRow) }
}

export async function deleteEvent(id: string): Promise<ApiResult<null>> {
  if (!supabase) return { ok: false, message: NOT_CONFIGURED_MESSAGE }
  const { error } = await supabase.from("events").delete().eq("id", id)
  if (error) return failure(error, "Couldn’t delete this update.")
  return { ok: true, value: null }
}

// Counts only, from club_rsvp_counts(). The server refuses callers who are not members,
// and never returns who joined.
export async function fetchRsvpCounts(clubId: string): Promise<ApiResult<Map<string, number>>> {
  if (!supabase) return { ok: false, message: NOT_CONFIGURED_MESSAGE }
  const { data, error } = await supabase.rpc("club_rsvp_counts", { p_club_id: clubId })
  if (error) return failure(error, "Couldn’t load RSVP counts.")
  return { ok: true, value: new Map((data as Array<{ event_id: string; rsvp_count: number }>).map((row) => [row.event_id, Number(row.rsvp_count)])) }
}

export type RsvpRow = { itemId: string; joinedAt: string }

// The signed-in user's own RSVPs. Nobody else's rows are visible to them.
export async function listMyRsvps(userId: string): Promise<ApiResult<RsvpRow[]>> {
  if (!supabase) return { ok: false, message: NOT_CONFIGURED_MESSAGE }
  const { data, error } = await supabase.from("rsvps").select("event_id, joined_at").eq("user_id", userId)
  if (error) return failure(error, "Couldn’t load your RSVPs.")
  return { ok: true, value: (data as Array<{ event_id: string; joined_at: string }>).map((row) => ({ itemId: row.event_id, joinedAt: row.joined_at })) }
}

// user_id is filled in by the database from the session; the browser never sends one.
export async function joinEvent(eventId: string): Promise<ApiResult<RsvpRow>> {
  if (!supabase) return { ok: false, message: NOT_CONFIGURED_MESSAGE }
  const { data, error } = await supabase.from("rsvps").insert({ event_id: eventId }).select("event_id, joined_at").single()
  // Already joined, for example from another tab: treat it as joined.
  if (error?.code === "23505") return { ok: true, value: { itemId: eventId, joinedAt: new Date().toISOString() } }
  if (error) return failure(error, "Couldn’t join this event.")
  return { ok: true, value: { itemId: data.event_id, joinedAt: data.joined_at } }
}

export async function cancelRsvp(eventId: string, userId: string): Promise<ApiResult<null>> {
  if (!supabase) return { ok: false, message: NOT_CONFIGURED_MESSAGE }
  const { error } = await supabase.from("rsvps").delete().eq("event_id", eventId).eq("user_id", userId)
  if (error) return failure(error, "Couldn’t cancel this RSVP.")
  return { ok: true, value: null }
}
