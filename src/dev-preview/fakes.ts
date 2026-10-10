import type { AiErrorCode, AiResult, AiService, DiscoverResponse, ExtractPosterResponse } from "../ai/contracts"
import type { Assignment, AssignmentErrorCode, AssignmentInput, AssignmentResult, AssignmentService } from "../assignments/contracts"

// Fake services for the preview harness. Nothing here talks to a network.

export const wait = (milliseconds: number) => new Promise<void>((resolve) => window.setTimeout(resolve, milliseconds))
const never = () => new Promise<never>(() => {})

export const AI_ERROR_CODES: AiErrorCode[] = ["not_configured", "not_signed_in", "not_a_member", "invalid_image", "too_large", "invalid_request", "rate_limited", "model_unavailable", "bad_output", "network"]

const FAKE_MODEL = "fake-model (preview harness)"

function aiFail<T>(code: AiErrorCode): AiResult<T> {
  return { ok: false, error: { code, message: `Fake ${code} from the preview harness.` } }
}

// ------------------------------------------------------------------ poster extraction

const extractions: Record<string, ExtractPosterResponse> = {
  success: {
    values: {
      title: "Build Your First Web App",
      category: "Workshop",
      description: "A beginner-friendly evening for students to form teams, explore an idea, and leave with a small working prototype.",
      startDate: "2026-10-18",
      startTime: "16:00",
      endTime: "18:00",
      venue: "Innovation Lab",
      eligibility: "All interested students",
    },
    extractedFields: ["title", "category", "description", "startDate", "startTime", "endTime", "venue", "eligibility"],
    flags: [],
    model: FAKE_MODEL,
  },
  flags: {
    values: {
      title: "Build Your First Web App",
      category: "Workshop",
      description: "A beginner-friendly evening for students to form teams and leave with a small working prototype.",
      startDate: "2026-06-05",
      startTime: "16:00",
      venue: "Innovation Lab",
    },
    extractedFields: ["title", "category", "description", "startDate", "startTime", "venue"],
    flags: [
      { field: "startDate", reason: "The poster says 05/06/2026, which could be 5 June or 6 May. 5 June was used; change it if that is wrong." },
      { field: "registrationDeadline", reason: "“Register by Friday” has no date, so the deadline was left empty." },
      { field: "registrationUrl", reason: "The link printed on the poster was not a valid web address, so it was removed." },
    ],
    model: FAKE_MODEL,
  },
  sparse: { values: { title: "Open Mic Night" }, extractedFields: ["title"], flags: [], model: FAKE_MODEL },
  nothing: { values: {}, extractedFields: [], flags: [], model: FAKE_MODEL },
  long: {
    values: {
      title: "Interdepartmental Symposium on Sustainable Mountain Infrastructure and Community Resilience 2026",
      category: "Symposium",
      description: "Two days of talks, poster sessions, and field demonstrations.\nOpen to undergraduate and postgraduate students from every department, with a separate track for first-year students.",
      startDate: "2026-11-02",
      endDate: "2026-11-03",
      startTime: "09:30",
      registrationDeadline: "2026-10-28T23:59",
      registrationUrl: "https://example.org/register/interdepartmental-symposium-on-sustainable-mountain-infrastructure-2026?source=poster&track=students",
      venue: "Auditorium and Seminar Halls 1 to 4, Lecture Hall Complex",
      eligibility: "UG and PG students, all departments",
      timezone: "Asia/Kolkata",
    },
    extractedFields: ["title", "category", "description", "startDate", "endDate", "startTime", "registrationDeadline", "registrationUrl", "venue", "eligibility", "timezone"],
    flags: [{ field: "endTime", reason: "The closing time is cut off at the edge of the image." }],
    model: "a-very-long-model-identifier-2026-10-preview-vision-instruct",
  },
}

export type ExtractCall = { clubId: string; mimeType: string; base64Length: number }

// `plan` is one step per call; the last step repeats. A step is an extraction name from the
// table above, an error code, or "hang". Durations are in milliseconds.
export function fakeExtractService(plan: string[], delay = 700, log?: (call: ExtractCall) => void): Pick<AiService, "extractPoster"> {
  let calls = 0
  return {
    async extractPoster(request) {
      const step = plan[Math.min(calls, plan.length - 1)]
      calls += 1
      log?.({ clubId: request.clubId, mimeType: request.image.mimeType, base64Length: request.image.dataBase64.length })
      if (step === "hang") return never()
      // "slow:success" answers late, so a file swap can overtake it.
      const [prefix, name] = step.includes(":") ? step.split(":") : ["", step]
      await wait(prefix === "slow" ? 2500 : delay)
      if (name in extractions) return { ok: true, value: extractions[name] }
      return aiFail(name as AiErrorCode)
    },
  }
}

// ------------------------------------------------------------------ discovery

const answers: Record<string, DiscoverResponse> = {
  success: {
    answer:
      "Two published records match. The Campus Code Collective is running “Build Your First Web App” on 18 October in the Innovation Lab, open to all interested students. The Robotics Society’s line-follower workshop is on 21 October and asks you to register by 19 October.",
    sources: [
      { id: "build-first-web-app", title: "Build Your First Web App", publisher: "Campus Code Collective", category: "Event", startDate: "2026-10-18T10:30:00.000Z", deadline: null, venue: "Innovation Lab", path: "/explore/item/build-first-web-app", sourceUrl: "https://example.org/workshop" },
      { id: "line-follower", title: "Line-Follower Robotics Workshop", publisher: "Robotics Society", category: "Opportunity", startDate: "2026-10-21T09:00:00.000Z", deadline: "2026-10-19T18:29:00.000Z", venue: "Mechanical Workshop, Block C", path: "/explore/item/line-follower", sourceUrl: null },
    ],
    model: FAKE_MODEL,
  },
  second: {
    answer: "One published record matches: the merit scholarship renewal form is due on 24 October.",
    sources: [{ id: "scholarship-renewal", title: "Merit Scholarship Renewal", publisher: "Student Welfare Desk (sample)", category: "Scholarship", startDate: null, deadline: "2026-10-24", venue: null, path: "/explore/item/scholarship-renewal", sourceUrl: "https://example.org/scholarship" }],
    model: FAKE_MODEL,
  },
  empty: { answer: "I couldn’t find anything published on UniFlow about a swimming gala.", sources: [], model: FAKE_MODEL },
  long: {
    answer:
      "Several records are relevant.\n\n1. The symposium runs over two days and has a separate first-year track.\n2. Registration closes on 28 October.\n\nCheck each record for the details, because the dates on some of them were entered without a time.",
    sources: [
      { id: "symposium", title: "Interdepartmental Symposium on Sustainable Mountain Infrastructure and Community Resilience 2026", publisher: "Department of Civil Engineering Student Chapter and Environment Club (joint)", category: "Event", startDate: "2026-11-02T04:00:00.000Z", deadline: "2026-10-28T18:29:00.000Z", venue: "Auditorium and Seminar Halls 1 to 4, Lecture Hall Complex", path: "/explore/item/symposium", sourceUrl: "https://example.org/register/interdepartmental-symposium-on-sustainable-mountain-infrastructure-2026?source=poster" },
      { id: "no-dates", title: "Volunteer Call", publisher: "", category: "", startDate: null, deadline: null, venue: null, path: "/explore/item/no-dates", sourceUrl: "javascript:alert(1)" },
      { id: "odd-date", title: "Hostel Notice", publisher: "Hostel Council", category: "Notice", startDate: "sometime next week", deadline: null, venue: "Hostel common room", path: "/explore/item/odd-date", sourceUrl: null },
    ],
    model: FAKE_MODEL,
  },
}

export function fakeDiscoverService(plan: string[], delay = 700, log?: (query: string) => void): Pick<AiService, "discover"> {
  let calls = 0
  return {
    async discover(request) {
      const step = plan[Math.min(calls, plan.length - 1)]
      calls += 1
      log?.(request.query)
      if (step === "hang") return never()
      const [prefix, name] = step.includes(":") ? step.split(":") : ["", step]
      await wait(prefix === "slow" ? 2500 : delay)
      if (name in answers) return { ok: true, value: answers[name] }
      return aiFail(name as AiErrorCode)
    },
  }
}

// ------------------------------------------------------------------ assignments

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR

function seedAssignments(): Assignment[] {
  const now = Date.now()
  const at = (offset: number) => new Date(now + offset).toISOString()
  const base = { createdAt: at(-6 * DAY), updatedAt: at(-2 * DAY), completedAt: null }
  return [
    { ...base, id: "a1", title: "Lab report 3: operational amplifiers", course: "EC-211 Analog Circuits", notes: "Submit as PDF on the course page.\nInclude the oscilloscope captures from week 6.", dueAt: at(-2 * DAY - 3 * HOUR), status: "in_progress" },
    { ...base, id: "a2", title: "Problem set 5", course: "MA-203 Probability", notes: "", dueAt: at(5 * HOUR), status: "todo" },
    { ...base, id: "a3", title: "Group project proposal", course: "CS-301 Software Engineering", notes: "Two pages. Rahul is writing the timeline section.", dueAt: at(3 * DAY), status: "in_progress" },
    { ...base, id: "a4", title: "Term paper: a much longer working title that runs on to check how a long assignment name wraps on a narrow phone screen", course: "HS-102 Communication Skills", notes: "", dueAt: at(23 * DAY), status: "todo" },
    { ...base, id: "a5", title: "Read chapter 4", course: "", notes: "", dueAt: null, status: "todo" },
    { ...base, id: "a6", title: "Quiz 2 corrections", course: "MA-203 Probability", notes: "", dueAt: at(-4 * DAY), status: "done", completedAt: at(-5 * DAY) },
  ]
}

export type AssignmentFakeOptions = {
  // What list() does: one step per call, last one repeats. "ok", "empty", "hang", or an error code.
  list?: string[]
  failCreate?: AssignmentErrorCode
  // Which update calls fail (one step per call, last repeats): "ok" or an error code.
  update?: string[]
  failRemove?: AssignmentErrorCode
  delay?: number
}

function assignmentFail<T>(code: AssignmentErrorCode): AssignmentResult<T> {
  return { ok: false, error: { code, message: code === "invalid" ? "Fake validation message from the preview harness." : `Fake ${code}.` } }
}

export function fakeAssignmentService(options: AssignmentFakeOptions = {}): AssignmentService {
  const delay = options.delay ?? 500
  let rows: Assignment[] = []
  let seeded = false
  let listCalls = 0
  let updateCalls = 0
  let nextId = 100
  return {
    async list() {
      const plan = options.list ?? ["ok"]
      const step = plan[Math.min(listCalls, plan.length - 1)]
      listCalls += 1
      if (step === "hang") return never()
      await wait(delay)
      if (step !== "ok" && step !== "empty") return assignmentFail(step as AssignmentErrorCode)
      if (!seeded) {
        rows = step === "empty" ? [] : seedAssignments()
        seeded = true
      }
      return { ok: true, value: rows.map((row) => ({ ...row })) }
    },
    async create(input: AssignmentInput) {
      await wait(delay)
      if (options.failCreate) return assignmentFail(options.failCreate)
      const stamp = new Date().toISOString()
      const row: Assignment = { ...input, id: `new-${nextId++}`, completedAt: input.status === "done" ? stamp : null, createdAt: stamp, updatedAt: stamp }
      rows = [row, ...rows]
      return { ok: true, value: { ...row } }
    },
    async update(id, patch) {
      const plan = options.update ?? ["ok"]
      const step = plan[Math.min(updateCalls, plan.length - 1)]
      updateCalls += 1
      await wait(delay)
      if (step !== "ok") return assignmentFail(step as AssignmentErrorCode)
      const current = rows.find((row) => row.id === id)
      if (!current) return assignmentFail("not_found")
      const stamp = new Date().toISOString()
      const next: Assignment = { ...current, ...patch, updatedAt: stamp }
      next.completedAt = next.status === "done" ? current.completedAt ?? stamp : null
      rows = rows.map((row) => (row.id === id ? next : row))
      return { ok: true, value: { ...next } }
    },
    async remove(id) {
      await wait(delay)
      if (options.failRemove) return assignmentFail(options.failRemove)
      rows = rows.filter((row) => row.id !== id)
      return { ok: true, value: null }
    },
  }
}
