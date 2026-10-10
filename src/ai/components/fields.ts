import type { EventDraftField } from "../../components/poster-to-event/types"

// The order fields are listed in, and the names people see for them. The names follow the
// labels on the club workspace's create and review forms.
export const EVENT_FIELD_ORDER: EventDraftField[] = [
  "title",
  "category",
  "description",
  "startDate",
  "startTime",
  "endDate",
  "endTime",
  "timezone",
  "venue",
  "eligibility",
  "registrationDeadline",
  "registrationUrl",
]

export const EVENT_FIELD_LABELS: Record<EventDraftField, string> = {
  title: "Title",
  category: "Category",
  description: "Description",
  startDate: "Event date",
  startTime: "Start time",
  endDate: "End date",
  endTime: "End time",
  timezone: "Time zone",
  venue: "Venue",
  eligibility: "Audience",
  registrationDeadline: "Registration deadline",
  registrationUrl: "Registration link",
}

export function fieldLabel(field: EventDraftField, overrides?: Partial<Record<EventDraftField, string>>) {
  return overrides?.[field] ?? EVENT_FIELD_LABELS[field] ?? field
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/
const DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/

function formatDay(year: number, month: number, day: number) {
  const date = new Date(year, month - 1, day)
  // Reject values such as 2026-02-31, which Date would roll over into March.
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(date)
}

// Dates are shown in a readable form next to the exact value the form will hold, so a
// reviewer can spot a swapped day and month. Anything that isn't a recognised date is
// shown exactly as the model returned it.
export function formatFieldValue(field: EventDraftField, value: string) {
  if (field === "startDate" || field === "endDate" || field === "registrationDeadline") {
    const dateTime = DATE_TIME.exec(value)
    if (dateTime) {
      const day = formatDay(Number(dateTime[1]), Number(dateTime[2]), Number(dateTime[3]))
      return day ? `${day}, ${dateTime[4]}:${dateTime[5]}` : value
    }
    const dateOnly = DATE_ONLY.exec(value)
    if (dateOnly) return formatDay(Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3])) ?? value
  }
  return value
}
