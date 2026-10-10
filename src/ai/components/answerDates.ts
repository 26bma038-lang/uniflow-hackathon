// Display formatting for dates in AI discovery. Campus time is India Standard Time, so
// everything is shown in Asia/Kolkata whatever the viewer's device is set to. Only what is
// displayed changes: the response and the records keep their original values.

const ZONE = "Asia/Kolkata"
const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

const dayFormat = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, day: "numeric", month: "short", year: "numeric" })
const weekdayFormat = new Intl.DateTimeFormat("en-GB", { timeZone: ZONE, weekday: "short" })
const timeFormat = new Intl.DateTimeFormat("en-US", { timeZone: ZONE, hour: "numeric", minute: "2-digit", hour12: true })

function calendarDay(year: number, month: number, day: number) {
  // Noon UTC is the same calendar day in India.
  return new Date(Date.UTC(year, month - 1, day, 12))
}

function twelveHour(hour: number, minute: string) {
  if (hour > 23) return null
  return `${hour % 12 === 0 ? 12 : hour % 12}:${minute} ${hour < 12 ? "AM" : "PM"}`
}

// "Thu, 5 Nov 2026, 5:30 PM IST" for a date-time, "Thu, 5 Nov 2026" for a bare date.
// Anything unreadable is shown as it came, never replaced with a guess.
export function formatCampusDate(value: string) {
  const dateOnly = DATE_ONLY.exec(value)
  if (dateOnly) {
    const date = calendarDay(Number(dateOnly[1]), Number(dateOnly[2]), Number(dateOnly[3]))
    return `${weekdayFormat.format(date)}, ${dayFormat.format(date)}`
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return `${weekdayFormat.format(date)}, ${dayFormat.format(date)}, ${timeFormat.format(date)} IST`
}

const ISO_DATE_TIME = /\b\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:?\d{2})/g
const ISO_DATE = /\b(\d{4})-(\d{2})-(\d{2})\b(?!T)/g
const CLOCK_24H = /\b(at|by|from|until|to) ([01]\d|2[0-3]):([0-5]\d)\b(?!\s?(?:AM|PM|am|pm|:))/g

// The model writes its answer from database values, so machine timestamps can end up in the
// sentence. This rewrites them for reading and leaves every other word alone.
export function humanizeAnswerDates(text: string) {
  return text
    .replace(ISO_DATE_TIME, (match) => {
      const date = new Date(match)
      return Number.isNaN(date.getTime()) ? match : `${dayFormat.format(date)}, ${timeFormat.format(date)} IST`
    })
    .replace(ISO_DATE, (match, year, month, day) => {
      const date = calendarDay(Number(year), Number(month), Number(day))
      return Number.isNaN(date.getTime()) ? match : dayFormat.format(date)
    })
    .replace(CLOCK_24H, (match, word, hour, minute) => {
      const time = twelveHour(Number(hour), minute)
      return time ? `${word} ${time}` : match
    })
}
