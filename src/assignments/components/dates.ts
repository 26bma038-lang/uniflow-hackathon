import type { Assignment } from "../contracts"

// dueAt travels as an ISO date-time (an instant). The form edits it as a local calendar
// date and a local clock time, so both directions go through the browser's time zone.

const pad = (value: number) => String(value).padStart(2, "0")

// The time used when a student gives a date but no time: the end of that day.
export const END_OF_DAY = "23:59"

export function toLocalInputs(dueAt: string | null): { date: string; time: string } {
  if (!dueAt) return { date: "", time: "" }
  const due = new Date(dueAt)
  if (Number.isNaN(due.getTime())) return { date: "", time: "" }
  return {
    date: `${due.getFullYear()}-${pad(due.getMonth() + 1)}-${pad(due.getDate())}`,
    time: `${pad(due.getHours())}:${pad(due.getMinutes())}`,
  }
}

export type DueParse = { ok: true; dueAt: string | null } | { ok: false; field: "date" | "time"; message: string }

export function fromLocalInputs(date: string, time: string): DueParse {
  if (!date && !time) return { ok: true, dueAt: null }
  if (!date) return { ok: false, field: "date", message: "Add a date to go with that time, or clear the time." }
  const day = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date)
  if (!day) return { ok: false, field: "date", message: "Enter the date as day, month, and year." }
  const clock = /^(\d{2}):(\d{2})/.exec(time || END_OF_DAY)
  if (!clock) return { ok: false, field: "time", message: "Enter the time as hours and minutes." }
  const [year, month, dayOfMonth] = [Number(day[1]), Number(day[2]), Number(day[3])]
  const [hours, minutes] = [Number(clock[1]), Number(clock[2])]
  const due = new Date(year, month - 1, dayOfMonth, hours, minutes, 0, 0)
  // A date such as 31 February rolls over silently, so check it came back unchanged.
  if (Number.isNaN(due.getTime()) || due.getFullYear() !== year || due.getMonth() !== month - 1 || due.getDate() !== dayOfMonth) {
    return { ok: false, field: "date", message: "That date doesn’t exist. Check the day and month." }
  }
  if (year < 2000 || year > 2100) return { ok: false, field: "date", message: "Check the year on that date." }
  if (hours > 23 || minutes > 59) return { ok: false, field: "time", message: "Enter the time as hours and minutes." }
  return { ok: true, dueAt: due.toISOString() }
}

export type Bucket = "overdue" | "soon" | "later" | "none" | "done"

export const SOON_DAYS = 7

export function bucketOf(assignment: Assignment, now: number): Bucket {
  if (assignment.status === "done") return "done"
  if (!assignment.dueAt) return "none"
  const due = new Date(assignment.dueAt).getTime()
  if (Number.isNaN(due)) return "none"
  if (due < now) return "overdue"
  if (due - now <= SOON_DAYS * 24 * 60 * 60 * 1000) return "soon"
  return "later"
}

function startOfDay(time: number) {
  const date = new Date(time)
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

// "Today, 17:00", "Tomorrow, 09:00", "Mon 19 Oct, 17:00", with the year when it isn't this one.
export function formatMoment(iso: string, now: number) {
  const moment = new Date(iso)
  if (Number.isNaN(moment.getTime())) return iso
  const clock = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(moment)
  const days = Math.round((startOfDay(moment.getTime()) - startOfDay(now)) / (24 * 60 * 60 * 1000))
  if (days === 0) return `Today, ${clock}`
  if (days === 1) return `Tomorrow, ${clock}`
  if (days === -1) return `Yesterday, ${clock}`
  const sameYear = moment.getFullYear() === new Date(now).getFullYear()
  const day = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: sameYear ? undefined : "numeric" }).format(moment)
  return `${day}, ${clock}`
}

function span(milliseconds: number) {
  const minutes = Math.floor(milliseconds / 60000)
  if (minutes < 60) return minutes <= 1 ? "under a minute" : `${minutes} minutes`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return hours === 1 ? "1 hour" : `${hours} hours`
  const days = Math.floor(hours / 24)
  return days === 1 ? "1 day" : `${days} days`
}

// How far away the due time is, for the open assignments where that matters.
export function relativeDue(iso: string, now: number) {
  const due = new Date(iso).getTime()
  if (Number.isNaN(due)) return ""
  if (due < now) return `${span(now - due)} overdue`
  if (due - now <= SOON_DAYS * 24 * 60 * 60 * 1000) return `in ${span(due - now)}`
  return ""
}
