import { supabase, NOT_CONFIGURED_MESSAGE } from "../auth/supabase"
import {
  ASSIGNMENT_COURSE_MAX,
  ASSIGNMENT_NOTES_MAX,
  ASSIGNMENT_STATUSES,
  ASSIGNMENT_TITLE_MAX,
  type Assignment,
  type AssignmentErrorCode,
  type AssignmentInput,
  type AssignmentResult,
  type AssignmentService,
  type AssignmentStatus,
} from "./contracts"

// Everything the app reads from or writes to public.assignments
// (supabase/migrations/20261010140000_assignments.sql). Row level security keeps each
// student to their own rows; the owner, completed_at, and the timestamps are set by the
// database. Every call resolves to an AssignmentResult and never throws.

type AssignmentRow = {
  id: string
  title: string
  course: string
  notes: string
  due_at: string | null
  status: AssignmentStatus
  completed_at: string | null
  created_at: string
  updated_at: string
}

type Failure = { ok: false; error: { code: AssignmentErrorCode; message: string } }

const COLUMNS = "id, title, course, notes, due_at, status, completed_at, created_at, updated_at"
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function fail(code: AssignmentErrorCode, message: string): Failure {
  return { ok: false, error: { code, message } }
}

const NOT_SIGNED_IN = "Sign in to keep track of your assignments."
const NOT_FOUND = "That assignment no longer exists."

function failure(error: { message?: string; code?: string } | null, fallback: string): Failure {
  if (!error) return fail("unknown", fallback)
  if (error.code === "PGRST205" || error.code === "42P01") return fail("not_set_up", "Assignments haven’t been set up on the server yet.")
  // Without a session the request runs as anon, which holds no privilege on the table.
  if (error.code === "42501" || error.code === "PGRST301" || error.code === "401") return fail("not_signed_in", "Your session has expired. Sign in again.")
  if (error.code === "PGRST116") return fail("not_found", NOT_FOUND)
  // The table's own checks: lengths, blank title, status, and badly formed dates.
  if (error.code === "23514" || error.code === "23502" || error.code === "22001" || error.code === "22007" || error.code === "22008" || error.code === "22P02") {
    return fail("invalid", "Some of those details aren’t valid. Check the title, lengths, and due date.")
  }
  if (!error.code) return fail("network", "Couldn’t reach the server. Check your connection and try again.")
  return fail("unknown", fallback)
}

function fromRow(row: AssignmentRow): Assignment {
  return {
    id: row.id,
    title: row.title,
    course: row.course,
    notes: row.notes,
    dueAt: row.due_at,
    status: row.status,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

type Columns = { title?: string; course?: string; notes?: string; due_at?: string | null; status?: AssignmentStatus }

// Checks the fields that are present and turns them into columns. Returns a message when
// something is wrong, so a typo reads as a sentence instead of a database error.
function toColumns(input: Partial<AssignmentInput>, requireTitle: boolean): { columns: Columns } | { problem: string } {
  const columns: Columns = {}

  if (input.title !== undefined || requireTitle) {
    if (typeof input.title !== "string" || input.title.trim() === "") return { problem: "Give the assignment a title." }
    const title = input.title.trim()
    if (title.length > ASSIGNMENT_TITLE_MAX) return { problem: `Keep the title under ${ASSIGNMENT_TITLE_MAX} characters.` }
    columns.title = title
  }
  if (input.course !== undefined) {
    if (typeof input.course !== "string") return { problem: "The course isn’t valid." }
    const course = input.course.trim()
    if (course.length > ASSIGNMENT_COURSE_MAX) return { problem: `Keep the course under ${ASSIGNMENT_COURSE_MAX} characters.` }
    columns.course = course
  }
  if (input.notes !== undefined) {
    if (typeof input.notes !== "string") return { problem: "The notes aren’t valid." }
    const notes = input.notes.trim()
    if (notes.length > ASSIGNMENT_NOTES_MAX) return { problem: `Keep the notes under ${ASSIGNMENT_NOTES_MAX} characters.` }
    columns.notes = notes
  }
  if (input.dueAt !== undefined) {
    if (input.dueAt === null || input.dueAt === "") {
      columns.due_at = null
    } else {
      const time = typeof input.dueAt === "string" ? new Date(input.dueAt).getTime() : Number.NaN
      if (Number.isNaN(time)) return { problem: "The due date isn’t a valid date and time." }
      // Stored with an offset, so the same moment shows correctly in any time zone.
      columns.due_at = new Date(time).toISOString()
    }
  }
  if (input.status !== undefined) {
    if (!ASSIGNMENT_STATUSES.includes(input.status)) return { problem: "Choose To do, In progress, or Done." }
    columns.status = input.status
  }
  return { columns }
}

// Resolves to the client once there is a session, so a signed-out call gets a clear
// answer instead of a permission error.
async function signedIn() {
  if (!supabase) return { client: null, failure: fail("not_configured", NOT_CONFIGURED_MESSAGE) }
  const { data, error } = await supabase.auth.getSession()
  if (error || !data.session) return { client: null, failure: fail("not_signed_in", NOT_SIGNED_IN) }
  return { client: supabase, failure: null }
}

const NETWORK = fail("network", "Couldn’t reach the server. Check your connection and try again.")

export const assignmentService: AssignmentService = {
  async list(): Promise<AssignmentResult<Assignment[]>> {
    try {
      const { client, failure: notReady } = await signedIn()
      if (!client) return notReady
      const { data, error } = await client
        .from("assignments")
        .select(COLUMNS)
        .order("due_at", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true })
      if (error) return failure(error, "Couldn’t load your assignments.")
      return { ok: true, value: (data as AssignmentRow[]).map(fromRow) }
    } catch {
      return NETWORK
    }
  },

  async create(input: AssignmentInput): Promise<AssignmentResult<Assignment>> {
    try {
      const checked = toColumns(input ?? {}, true)
      if ("problem" in checked) return fail("invalid", checked.problem)
      const { client, failure: notReady } = await signedIn()
      if (!client) return notReady
      // user_id is filled in by the database from the session; the browser never sends one.
      const { data, error } = await client.from("assignments").insert(checked.columns).select(COLUMNS).single()
      if (error) return failure(error, "Couldn’t save this assignment.")
      return { ok: true, value: fromRow(data as AssignmentRow) }
    } catch {
      return NETWORK
    }
  },

  async update(id: string, patch: Partial<AssignmentInput>): Promise<AssignmentResult<Assignment>> {
    try {
      if (typeof id !== "string" || !UUID.test(id)) return fail("not_found", NOT_FOUND)
      const checked = toColumns(patch ?? {}, false)
      if ("problem" in checked) return fail("invalid", checked.problem)
      const { client, failure: notReady } = await signedIn()
      if (!client) return notReady

      const query =
        Object.keys(checked.columns).length === 0
          ? client.from("assignments").select(COLUMNS).eq("id", id)
          : client.from("assignments").update(checked.columns).eq("id", id).select(COLUMNS)
      // No row comes back when the id is gone or belongs to someone else.
      const { data, error } = await query.maybeSingle()
      if (error) return failure(error, "Couldn’t save this assignment.")
      if (!data) return fail("not_found", NOT_FOUND)
      return { ok: true, value: fromRow(data as AssignmentRow) }
    } catch {
      return NETWORK
    }
  },

  async remove(id: string): Promise<AssignmentResult<null>> {
    try {
      if (typeof id !== "string" || !UUID.test(id)) return fail("not_found", NOT_FOUND)
      const { client, failure: notReady } = await signedIn()
      if (!client) return notReady
      const { data, error } = await client.from("assignments").delete().eq("id", id).select("id")
      if (error) return failure(error, "Couldn’t delete this assignment.")
      if (!data || data.length === 0) return fail("not_found", NOT_FOUND)
      return { ok: true, value: null }
    } catch {
      return NETWORK
    }
  },
}
