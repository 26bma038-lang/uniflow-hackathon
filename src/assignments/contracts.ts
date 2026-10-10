// A student's own coursework tracker. Rows are private: only the signed-in owner can read
// or change them. Change this file first, and tell the other side, before changing the
// database, the service, or the components.

export type AssignmentStatus = "todo" | "in_progress" | "done"
export const ASSIGNMENT_STATUSES: AssignmentStatus[] = ["todo", "in_progress", "done"]

export const ASSIGNMENT_TITLE_MAX = 160
export const ASSIGNMENT_COURSE_MAX = 80
export const ASSIGNMENT_NOTES_MAX = 2000

export type Assignment = {
  id: string
  title: string
  course: string // "" when not given
  notes: string // "" when not given
  dueAt: string | null // ISO date-time, or null for no due date
  status: AssignmentStatus
  completedAt: string | null // set by the database when status becomes "done"
  createdAt: string
  updatedAt: string
}

export type AssignmentInput = {
  title: string
  course: string
  notes: string
  dueAt: string | null
  status: AssignmentStatus
}

export type AssignmentErrorCode = "not_configured" | "not_signed_in" | "invalid" | "not_found" | "not_set_up" | "network" | "unknown"
export type AssignmentError = { code: AssignmentErrorCode; message: string }
export type AssignmentResult<T> = { ok: true; value: T } | { ok: false; error: AssignmentError }

export type AssignmentService = {
  // The caller's own assignments, soonest due first, no due date last.
  list(): Promise<AssignmentResult<Assignment[]>>
  create(input: AssignmentInput): Promise<AssignmentResult<Assignment>>
  update(id: string, patch: Partial<AssignmentInput>): Promise<AssignmentResult<Assignment>>
  remove(id: string): Promise<AssignmentResult<null>>
}
