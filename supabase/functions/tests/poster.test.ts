// Runs under Node (`node --test supabase/functions/tests/`) and under Deno
// (`deno test supabase/functions/tests/`). No network, no clock.

import assert from "node:assert/strict"
import { test } from "node:test"
import { POSTER_MAX_BYTES } from "../_shared/contracts.ts"
import { analyseDateText, checkDate, checkPosterImage, checkTime, checkUrl, extractJsonObject, normalizePosterOutput, todayIn } from "../_shared/poster.ts"

const TODAY = "2026-10-10"
const MODEL = "test-model"

function base64(bytes: number[]) {
  return btoa(String.fromCharCode(...bytes))
}
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 1, 2, 3]
const JPEG = [0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1]
const WEBP = [0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38]

function normalize(raw: unknown) {
  const result = normalizePosterOutput(raw, { today: TODAY, model: MODEL })
  assert.equal(result.ok, true)
  if (!result.ok) throw new Error("unreachable")
  return result.value
}
function reasonsFor(value: ReturnType<typeof normalize>, field: string) {
  return value.flags.filter((flag) => flag.field === field).map((flag) => flag.reason)
}

// ---------------------------------------------------------------- image

test("accepts PNG, JPEG, and WebP whose bytes match the declared type", () => {
  for (const [mime, bytes] of [["image/png", PNG], ["image/jpeg", JPEG], ["image/webp", WEBP]] as const) {
    const result = checkPosterImage(mime, base64([...bytes]), POSTER_MAX_BYTES)
    assert.equal(result.ok, true, mime)
    if (result.ok) assert.equal(result.bytes, bytes.length)
  }
})

test("rejects unsupported or missing mime types", () => {
  for (const mime of ["image/gif", "application/pdf", "image/svg+xml", "", null, undefined, 7]) {
    const result = checkPosterImage(mime, base64(PNG), POSTER_MAX_BYTES)
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, "invalid_image")
  }
})

test("rejects bytes that do not match the declared type", () => {
  const result = checkPosterImage("image/png", base64(JPEG), POSTER_MAX_BYTES)
  assert.deepEqual(result.ok ? null : result.code, "invalid_image")
  const text = checkPosterImage("image/png", btoa("<svg onload=alert(1)>hello world</svg>"), POSTER_MAX_BYTES)
  assert.deepEqual(text.ok ? null : text.code, "invalid_image")
})

test("rejects malformed base64 and empty data", () => {
  for (const data of ["", "not base64!!", "abc", "ab=c", {}, null]) {
    const result = checkPosterImage("image/png", data, POSTER_MAX_BYTES)
    assert.equal(result.ok, false)
    if (!result.ok) assert.equal(result.code, "invalid_image")
  }
})

test("enforces the size limit on decoded bytes", () => {
  const atLimit = base64([...PNG, ...new Array(64 - PNG.length).fill(1)])
  assert.equal(checkPosterImage("image/png", atLimit, 64).ok, true)
  const over = base64([...PNG, ...new Array(65 - PNG.length).fill(1)])
  const result = checkPosterImage("image/png", over, 64)
  assert.deepEqual(result.ok ? null : result.code, "too_large")
  const huge = checkPosterImage("image/png", "A".repeat(8 * 1024 * 1024), POSTER_MAX_BYTES)
  assert.deepEqual(huge.ok ? null : huge.code, "too_large")
})

test("strips a data: prefix and whitespace", () => {
  const result = checkPosterImage("image/png", `data:image/png;base64,${base64(PNG).slice(0, 8)}\n${base64(PNG).slice(8)}`, POSTER_MAX_BYTES)
  assert.equal(result.ok, true)
  if (result.ok) assert.equal(result.dataBase64, base64(PNG))
})

// ---------------------------------------------------------------- JSON

test("extracts JSON from bare text, code fences, and surrounding prose", () => {
  assert.deepEqual(extractJsonObject('{"a":1}'), { a: 1 })
  assert.deepEqual(extractJsonObject('```json\n{"a":1}\n```'), { a: 1 })
  assert.deepEqual(extractJsonObject('Here you go:\n{"a":{"b":2}}\nHope that helps.'), { a: { b: 2 } })
  assert.equal(extractJsonObject("I cannot read this image."), undefined)
  assert.equal(extractJsonObject('{"a":'), undefined)
})

// ---------------------------------------------------------------- dates

test("reads the wording of a date without guessing", () => {
  assert.deepEqual(analyseDateText("18th October 2026").parsed, { day: 18, month: 10, year: 2026 })
  assert.deepEqual(analyseDateText("Sat, Oct 18").parsed, { day: 18, month: 10, year: undefined })
  assert.deepEqual(analyseDateText("2026-10-18").parsed, { day: 18, month: 10, year: 2026 })
  assert.deepEqual(analyseDateText("18/10/26").parsed, { day: 18, month: 10, year: 2026 })
  assert.deepEqual(analyseDateText("10/18/2026").parsed, { day: 18, month: 10, year: 2026 })
  assert.equal(analyseDateText("18/10/2026").alternative, null)
  assert.deepEqual(analyseDateText("05/06/2026").alternative, { day: 6, month: 5 })
  assert.equal(analyseDateText("06/06/2026").alternative, null)
  assert.equal(analyseDateText("October 2026").parsed, null)
  assert.equal(analyseDateText("next Friday").relative, true)
  assert.equal(analyseDateText("Tomorrow, 5 PM").relative, true)
  assert.equal(analyseDateText("Friday").relative, true)
  assert.equal(analyseDateText("This Friday, 16 Oct").relative, false)
  assert.equal(analyseDateText("5.30 pm").parsed, null)
})

test("a full date that matches its wording passes without a flag", () => {
  assert.deepEqual(checkDate("2026-10-18", "18th October 2026", TODAY), { value: "2026-10-18", reasons: [] })
})

test("a date with no year is flagged and the server picks the year", () => {
  const upcoming = checkDate("2026-10-18", "18 Oct", TODAY)
  assert.equal(upcoming.value, "2026-10-18")
  assert.equal(upcoming.reasons.length, 1)
  assert.match(upcoming.reasons[0], /no year/)

  // The model assumed the wrong year; the next occurrence is used instead.
  const modelGuess = checkDate("2025-10-18", "18 Oct", TODAY)
  assert.equal(modelGuess.value, "2026-10-18")

  // Already past this year, so the next occurrence is next year.
  const rolled = checkDate("2026-01-05", "5 January", TODAY)
  assert.equal(rolled.value, "2027-01-05")
  assert.match(rolled.reasons[0], /2027 was assumed/)

  assert.equal(checkDate("2026-10-10", "10 Oct", TODAY).value, "2026-10-10")
})

test("a relative date is dropped and flagged", () => {
  for (const text of ["next Friday", "Tomorrow", "this weekend", "Friday"]) {
    const result = checkDate("2026-10-16", text, TODAY)
    assert.equal(result.value, undefined, text)
    assert.equal(result.reasons.length, 1, text)
  }
  const noValue = checkDate(undefined, "next Friday", TODAY)
  assert.equal(noValue.value, undefined)
  assert.equal(noValue.reasons.length, 1)
})

test("a day-first or month-first date is read day-first and flagged", () => {
  for (const reading of ["2026-06-05", "2026-05-06"]) {
    const result = checkDate(reading, "05/06/2026", "2026-01-01")
    assert.equal(result.value, "2026-06-05")
    assert.ok(result.reasons.some((reason) => /day-first or month-first/.test(reason)))
  }
  assert.deepEqual(checkDate("2026-10-18", "18/10/2026", TODAY), { value: "2026-10-18", reasons: [] })
})

test("a reading that contradicts the wording is dropped", () => {
  for (const [value, text] of [["2026-10-19", "18 October 2026"], ["2025-10-18", "18 October 2026"], ["2026-11-18", "18 Oct"]]) {
    const result = checkDate(value, text, TODAY)
    assert.equal(result.value, undefined)
    assert.match(result.reasons[0], /but it was read as/)
  }
})

test("impossible and malformed dates are dropped", () => {
  for (const value of ["2026-02-30", "2026-13-01", "18/10/2026", "2026-1-5", "soon", "1999-01-01"]) {
    const result = checkDate(value, undefined, TODAY)
    assert.equal(result.value, undefined, value)
    assert.equal(result.reasons.length, 1, value)
  }
  assert.equal(checkDate("2026-10-18", "30 February 2027", TODAY).value, undefined)
})

test("a malformed reading is replaced by clear wording, with a flag", () => {
  const result = checkDate("18/10/2026", "18 October 2026", TODAY)
  assert.equal(result.value, "2026-10-18")
  assert.equal(result.reasons.length, 1)
})

test("a date with no captured wording, or wording that cannot be matched, is kept and flagged", () => {
  assert.equal(checkDate("2026-10-18", undefined, TODAY).reasons.length, 1)
  const vague = checkDate("2026-10-18", "Diwali week", TODAY)
  assert.equal(vague.value, "2026-10-18")
  assert.equal(vague.reasons.length, 1)
  assert.deepEqual(checkDate(undefined, undefined, TODAY), { reasons: [] })
  assert.equal(checkDate(undefined, "third week of October", TODAY).value, undefined)
})

test("a past date is flagged", () => {
  const result = checkDate("2026-10-01", "1 October 2026", TODAY)
  assert.equal(result.value, "2026-10-01")
  assert.ok(result.reasons.some((reason) => /in the past/.test(reason)))
})

// ---------------------------------------------------------------- times

test("times are checked against the poster's wording", () => {
  assert.deepEqual(checkTime("16:00", "4:00 PM"), { value: "16:00", reasons: [] })
  assert.deepEqual(checkTime("16:00", "4 pm"), { value: "16:00", reasons: [] })
  assert.deepEqual(checkTime("9:30", "9.30 a.m."), { value: "09:30", reasons: [] })
  assert.deepEqual(checkTime("00:15", "12:15 AM"), { value: "00:15", reasons: [] })
  assert.deepEqual(checkTime("12:00", "12 noon"), { value: "12:00", reasons: [] })
  assert.deepEqual(checkTime("18:30", "18:30"), { value: "18:30", reasons: [] })
  assert.deepEqual(checkTime("16:00:00", "4 PM"), { value: "16:00", reasons: [] })
  assert.deepEqual(checkTime(undefined, "4 PM"), { reasons: [] })
})

test("a time without am or pm is flagged", () => {
  const result = checkTime("16:00", "4:00")
  assert.equal(result.value, "16:00")
  assert.match(result.reasons[0], /without am or pm/)
})

test("malformed and contradicting times are dropped", () => {
  for (const value of ["4 PM", "25:00", "12:60", "evening", "1600"]) {
    const result = checkTime(value, "4 PM")
    assert.equal(result.value, undefined, value)
    assert.equal(result.reasons.length, 1, value)
  }
  assert.equal(checkTime("04:00", "4 PM").value, undefined)
  assert.equal(checkTime("16:30", "4 PM").value, undefined)
  assert.equal(checkTime("17:00", "4:00").value, undefined)
})

// ---------------------------------------------------------------- links

test("links must be http(s) web addresses", () => {
  assert.equal(checkUrl("https://forms.gle/abc123").value, "https://forms.gle/abc123")
  assert.equal(checkUrl("http://example.com/x?y=1.").value, "http://example.com/x?y=1")
  for (const bad of ["javascript:alert(1)", "mailto:a@b.co", "ftp://example.com/a", "https://localhost/x", "see notice board", "https://user:pw@example.com", "data:text/html,x"]) {
    const result = checkUrl(bad)
    assert.equal(result.value, undefined, bad)
    assert.equal(result.reasons.length, 1, bad)
  }
})

test("a link printed without a scheme gets https:// and a flag", () => {
  const result = checkUrl("forms.gle/abc123")
  assert.equal(result.value, "https://forms.gle/abc123")
  assert.ok(result.reasons.some((reason) => /without https/.test(reason)))
})

// ---------------------------------------------------------------- whole answer

test("a complete, well-formed answer", () => {
  const value = normalize({
    title: "  Build Your First\nWeb App ",
    description: "A beginner-friendly evening.\n\nBring a laptop.",
    category: "technical",
    startDate: { value: "2026-10-18", text: "18 October 2026" },
    startTime: { value: "16:00", text: "4:00 PM" },
    endDate: null,
    endTime: { value: "18:00", text: "6 PM" },
    timezoneText: "IST",
    venue: "Innovation Lab",
    eligibility: "All students",
    registrationDeadline: { value: "2026-10-17T18:00", text: "Register by 17 Oct 2026, 6 PM" },
    registrationUrl: "https://example.com/register",
    uncertain: [],
  })
  assert.deepEqual(value.values, {
    title: "Build Your First Web App",
    description: "A beginner-friendly evening.\nBring a laptop.",
    category: "Technical",
    startDate: "2026-10-18",
    startTime: "16:00",
    endTime: "18:00",
    timezone: "Asia/Kolkata",
    venue: "Innovation Lab",
    eligibility: "All students",
    registrationDeadline: "2026-10-17T18:00",
    registrationUrl: "https://example.com/register",
  })
  assert.deepEqual(value.extractedFields, ["title", "description", "category", "startDate", "startTime", "endTime", "timezone", "venue", "eligibility", "registrationDeadline", "registrationUrl"])
  assert.deepEqual(value.flags.map((flag) => flag.field), ["registrationUrl"])
  assert.equal(value.model, MODEL)
})

test("missing fields stay out of values and are never filled in", () => {
  const value = normalize({ title: "Open Mic", description: null, category: null, startDate: null, venue: "N/A", eligibility: "", registrationUrl: "not specified", uncertain: [] })
  assert.deepEqual(value.values, { title: "Open Mic" })
  assert.deepEqual(value.extractedFields, ["title"])
  assert.deepEqual(value.flags, [])
  assert.equal("timezone" in value.values, false)
})

test("an answer with nothing readable is valid and empty", () => {
  const value = normalize({ title: null, uncertain: [] })
  assert.deepEqual(value.values, {})
  assert.deepEqual(value.extractedFields, [])
})

test("answers that are not the expected object are refused", () => {
  for (const raw of [null, undefined, "text", 4, [], [{ title: "x" }], {}, { foo: "bar" }]) {
    assert.equal(normalizePosterOutput(raw, { today: TODAY, model: MODEL }).ok, false)
  }
})

test("malformed fields are dropped and flagged, the rest is kept", () => {
  const value = normalize({
    title: { nested: "object" },
    category: "Workshop",
    startDate: { value: "18-10-2026", text: null },
    startTime: "4pm",
    endDate: "2026-02-31",
    registrationDeadline: { value: "tomorrow", text: "tomorrow" },
    registrationUrl: "javascript:alert(1)",
    venue: "Auditorium",
  })
  assert.deepEqual(value.values, { venue: "Auditorium" })
  for (const field of ["title", "category", "startDate", "startTime", "endDate", "registrationDeadline", "registrationUrl"]) {
    assert.equal(reasonsFor(value, field).length >= 1, true, field)
  }
})

test("bare strings are accepted for date and time fields, and flagged as unchecked", () => {
  const value = normalize({ startDate: "2026-10-18", startTime: "16:00" })
  assert.equal(value.values.startDate, "2026-10-18")
  assert.equal(value.values.startTime, "16:00")
  assert.equal(reasonsFor(value, "startDate").length, 1)
  assert.equal(reasonsFor(value, "startTime").length, 1)
})

test("ambiguous dates are flagged in the full answer", () => {
  const value = normalize({
    title: "Fest",
    startDate: { value: "2026-11-05", text: "5 Nov" },
    endDate: { value: null, text: "next Sunday" },
    registrationDeadline: { value: "2026-03-04", text: "03/04/2027" },
  })
  assert.equal(value.values.startDate, "2026-11-05")
  assert.match(reasonsFor(value, "startDate")[0], /no year/)
  assert.equal(value.values.endDate, undefined)
  assert.match(reasonsFor(value, "endDate")[0], /depends on the day/)
  assert.equal(value.values.registrationDeadline, undefined)
  assert.match(reasonsFor(value, "registrationDeadline")[0], /but it was read as/)
})

test("deadline keeps its date when its time cannot be confirmed", () => {
  const badTime = normalize({ registrationDeadline: { value: "2026-10-17T25:00", text: "17 October 2026" } })
  assert.equal(badTime.values.registrationDeadline, "2026-10-17")
  assert.equal(reasonsFor(badTime, "registrationDeadline").length, 1)

  const mismatch = normalize({ registrationDeadline: { value: "2026-10-17T06:00", text: "17 October 2026, 6 PM" } })
  assert.equal(mismatch.values.registrationDeadline, "2026-10-17")

  const dateOnly = normalize({ registrationDeadline: { value: "2026-10-17", text: "17 October 2026" } })
  assert.equal(dateOnly.values.registrationDeadline, "2026-10-17")
  assert.deepEqual(dateOnly.flags, [])

  const spaced = normalize({ registrationDeadline: { value: "2026-10-17 18:00:00", text: "17 Oct 2026 6:00 pm" } })
  assert.equal(spaced.values.registrationDeadline, "2026-10-17T18:00")
})

test("cross-field problems are flagged without changing values", () => {
  const value = normalize({
    startDate: { value: "2026-10-18", text: "18 October 2026" },
    endDate: { value: "2026-10-17", text: "17 October 2026" },
    startTime: { value: "16:00", text: "4 PM" },
    endTime: { value: "18:00", text: "6 PM" },
    registrationDeadline: { value: "2026-10-20", text: "20 October 2026" },
  })
  assert.equal(value.values.endDate, "2026-10-17")
  assert.ok(reasonsFor(value, "endDate").some((reason) => /before the start date/.test(reason)))
  assert.ok(reasonsFor(value, "registrationDeadline").some((reason) => /after the event starts/.test(reason)))

  const sameDay = normalize({ startTime: { value: "18:00", text: "6 PM" }, endTime: { value: "16:00", text: "4 PM" } })
  assert.ok(reasonsFor(sameDay, "endTime").some((reason) => /not after the start time/.test(reason)))
})

test("the model's own uncertainty becomes flags, for known fields only", () => {
  const value = normalize({
    title: "Fest",
    uncertain: [{ field: "venue", reason: "  text is cropped  " }, { field: "title" }, { field: "password", reason: "x" }, "startTime", 7, null, { field: "venue", reason: "text is cropped" }],
  })
  assert.deepEqual(value.flags, [
    { field: "venue", reason: "The model wasn’t sure: text is cropped" },
    { field: "title", reason: "The model wasn’t sure about this field. Compare it with the poster." },
    { field: "startTime", reason: "The model wasn’t sure about this field. Compare it with the poster." },
  ])
})

test("over-long text is cut and flagged; control characters are removed", () => {
  const value = normalize({ title: "T".repeat(300), venue: "Hall\u0000 A\u0007" })
  assert.equal(value.values.title?.length, 160)
  assert.equal(reasonsFor(value, "title").length, 1)
  assert.equal(value.values.venue, "Hall A")
})

test("only an IST time zone is recognised", () => {
  assert.equal(normalize({ title: "x", timezoneText: "Indian Standard Time" }).values.timezone, "Asia/Kolkata")
  assert.equal(normalize({ title: "x", timezoneText: "PST" }).values.timezone, undefined)
  assert.equal(normalize({ title: "x", timezone: "Europe/London" }).values.timezone, undefined)
})

test("every returned value matches the contract's formats", () => {
  const value = normalize({
    startDate: { value: "2026-10-18", text: "18 Oct" },
    startTime: { value: "9:05", text: "9:05 am" },
    endDate: { value: "2026-10-19", text: "19/10/2026" },
    endTime: { value: "17:00", text: "5 PM" },
    registrationDeadline: { value: "2026-10-17T9:00", text: "17 Oct 2026 9 am" },
    registrationUrl: "example.com/go",
  })
  assert.match(value.values.startDate ?? "", /^\d{4}-\d{2}-\d{2}$/)
  assert.match(value.values.endDate ?? "", /^\d{4}-\d{2}-\d{2}$/)
  assert.match(value.values.startTime ?? "", /^\d{2}:\d{2}$/)
  assert.match(value.values.endTime ?? "", /^\d{2}:\d{2}$/)
  assert.match(value.values.registrationDeadline ?? "", /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/)
  assert.match(value.values.registrationUrl ?? "", /^https?:\/\//)
})

test("todayIn gives the campus date", () => {
  assert.equal(todayIn("Asia/Kolkata", new Date("2026-10-10T20:00:00Z")), "2026-10-11")
  assert.equal(todayIn("Asia/Kolkata", new Date("2026-10-10T10:00:00Z")), "2026-10-10")
})
