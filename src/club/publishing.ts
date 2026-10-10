import type { CampusItem } from "../student-app/types"
import type { EventDraft } from "../components/poster-to-event/types"

export type PublicationStatus =
  | "draft"
  | "needs_review"
  | "ready_for_approval"
  | "published_demo"

export type ClubRecord = EventDraft & {
  id: string
  // The demo club that owns this record. Records saved before clubs could be switched
  // have no clubId and are read as Campus Code Collective's.
  clubId: string
  status: PublicationStatus
  updatedAt: string
  createdAt: string
  source: "Manual entry" | "Sample document" | "Uploaded document"
  sourceName: string
  department: string
  publisher: string
  publisherCampusId: string
  reviewedAt: string | null
  approvedAt: string | null
  publishedAt: string | null
  reviewConfirmed: boolean
}

export const CLUB_RECORDS_KEY = "uniflow-club-drafts"
export const CLUB_ACTIVITY_KEY = "uniflow-club-activity"
export const CLUB_PROFILE_KEY = "uniflow-club-profile"

export const sampleRecordValues: Partial<EventDraft> = {
  title: "Build Your First Web App",
  description:
    "A beginner-friendly evening for students to form teams, explore an idea, and leave with a small working prototype.",
  category: "Opportunity",
  startDate: "2026-10-18",
  startTime: "16:00",
  endDate: "2026-10-18",
  endTime: "18:00",
  venue: "Innovation Lab",
  eligibility: "All interested students",
  registrationDeadline: "2026-10-17T18:00",
}

// Demo club identities. These are the student groups already present in UniFlow's sample data.
// Choosing one is a demo convenience in this browser, not a verified organizer permission.
export type DemoClub = { id: string; name: string }

export const demoClubs: DemoClub[] = [
  { id: "campus-code-collective", name: "Campus Code Collective" },
  { id: "student-arts-circle", name: "Student Arts Circle" },
  { id: "creative-circle", name: "Creative Circle" },
]

export const DEFAULT_CLUB_ID = demoClubs[0].id
export const CLUB_CURRENT_KEY = "uniflow-club-current"
export const CLUB_PROFILES_KEY = "uniflow-club-profiles"

export function clubSlug(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

export function getDemoClub(clubId: string | null | undefined): DemoClub {
  return demoClubs.find((club) => club.id === clubId) ?? demoClubs[0]
}

export function clubIdForPublisher(publisher: string | null | undefined) {
  return demoClubs.find((club) => club.name === publisher)?.id ?? null
}

export function getCurrentClubId() {
  try {
    return getDemoClub(localStorage.getItem(CLUB_CURRENT_KEY)).id
  } catch {
    return DEFAULT_CLUB_ID
  }
}

export function setCurrentClubId(clubId: string) {
  localStorage.setItem(CLUB_CURRENT_KEY, getDemoClub(clubId).id)
}

export type ClubProfile = {
  name: string
  description: string
  category: string
  contact: string
  departments: string
  campusId: string
}

// Only Campus Code Collective shipped with profile text. The other sample clubs start empty
// and say so publicly until someone writes a profile for them.
export function defaultClubProfile(clubId: string): ClubProfile {
  const club = getDemoClub(clubId)
  if (club.id === DEFAULT_CLUB_ID) {
    return {
      name: club.name,
      description: "A student-led group for curious builders and first-time makers.",
      category: "Technology",
      contact: "",
      departments: "Computer Science, Design",
      campusId: "demo-campus",
    }
  }
  return { name: club.name, description: "", category: "", contact: "", departments: "", campusId: "demo-campus" }
}

function readProfileMap(): Record<string, Partial<ClubProfile>> {
  try {
    const stored = JSON.parse(localStorage.getItem(CLUB_PROFILES_KEY) ?? "null")
    const profiles: Record<string, Partial<ClubProfile>> = stored && typeof stored === "object" ? stored : {}
    if (!profiles[DEFAULT_CLUB_ID]) {
      // Before clubs could be switched there was one profile under CLUB_PROFILE_KEY, and it
      // belonged to Campus Code Collective. Carry it over; the old key is left in place.
      const legacy = JSON.parse(localStorage.getItem(CLUB_PROFILE_KEY) ?? "null")
      if (legacy && typeof legacy === "object") {
        profiles[DEFAULT_CLUB_ID] = legacy
        localStorage.setItem(CLUB_PROFILES_KEY, JSON.stringify(profiles))
      }
    }
    return profiles
  } catch {
    return {}
  }
}

export function readClubProfile(clubId: string = DEFAULT_CLUB_ID): ClubProfile {
  const id = getDemoClub(clubId).id
  return { ...defaultClubProfile(id), ...readProfileMap()[id] }
}

export function writeClubProfile(clubId: string, profile: ClubProfile) {
  const id = getDemoClub(clubId).id
  localStorage.setItem(CLUB_PROFILES_KEY, JSON.stringify({ ...readProfileMap(), [id]: profile }))
}

export function blankRecord(clubId: string = DEFAULT_CLUB_ID): ClubRecord {
  const now = new Date().toISOString()
  return {
    title: "",
    description: "",
    category: "",
    startDate: "",
    startTime: "",
    endDate: "",
    endTime: "",
    timezone: "Asia/Kolkata",
    venue: "",
    eligibility: "",
    registrationDeadline: "",
    registrationUrl: "",
    id: crypto.randomUUID(),
    clubId: getDemoClub(clubId).id,
    status: "draft",
    updatedAt: now,
    createdAt: now,
    source: "Manual entry",
    sourceName: "Manual entry",
    department: "",
    publisher: getDemoClub(clubId).name,
    publisherCampusId: "demo-campus",
    reviewedAt: null,
    approvedAt: null,
    publishedAt: null,
    reviewConfirmed: false,
  }
}

function parseStoredRecords(): unknown[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(CLUB_RECORDS_KEY) ?? "[]")
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function normalizeRecord(value: unknown): ClubRecord | null {
  if (!value || typeof value !== "object") return null
  const item = value as Partial<ClubRecord> & { source?: string; status?: string }
  if (typeof item.id !== "string") return null
  const now = new Date().toISOString()
  const clubId = getDemoClub(typeof item.clubId === "string" ? item.clubId : clubIdForPublisher(item.publisher)).id
  const status: PublicationStatus =
    item.status === "published_demo" ||
    item.status === "needs_review" ||
    item.status === "ready_for_approval"
      ? item.status
      : "draft"
  const source =
    item.source === "Sample document" ||
    item.source === "Uploaded document"
      ? item.source
      : "Manual entry"
  return {
    ...blankRecord(),
    ...item,
    id: item.id,
    status,
    source,
    sourceName: item.sourceName || item.source || source,
    createdAt: item.createdAt || item.updatedAt || now,
    updatedAt: item.updatedAt || now,
    clubId,
    publisher: item.publisher || getDemoClub(clubId).name,
    publisherCampusId: item.publisherCampusId || "demo-campus",
    reviewedAt: item.reviewedAt || null,
    approvedAt: item.approvedAt || null,
    publishedAt: item.publishedAt || null,
    reviewConfirmed: Boolean(item.reviewConfirmed),
  }
}

export function readClubRecords(): ClubRecord[] {
  return parseStoredRecords()
    .map(normalizeRecord)
    .filter((item): item is ClubRecord => Boolean(item))
}

export function writeClubRecords(records: ClubRecord[]) {
  localStorage.setItem(CLUB_RECORDS_KEY, JSON.stringify(records))
}

export function publishedClubRecords() {
  return readClubRecords().filter((record) => record.status === "published_demo")
}

function isoDate(record: ClubRecord, time: string) {
  if (!record.startDate) return null
  return `${record.startDate}T${time || "00:00"}:00+05:30`
}

const campusCategories: CampusItem["category"][] = ["Notice", "Event", "Scholarship", "Deadline", "Opportunity"]

const CLOSING_SOON_MS = 72 * 60 * 60 * 1000

function registrationStatus(deadline: string | null): CampusItem["status"] {
  if (!deadline) return "Upcoming"
  const remaining = new Date(deadline).getTime() - Date.now()
  return remaining > 0 && remaining <= CLOSING_SOON_MS ? "Closing soon" : "Open"
}

export function toCampusItem(record: ClubRecord): CampusItem {
  const startDate = isoDate(record, record.startTime)
  const endDate = isoDate(record, record.endTime)
  const deadline = record.registrationDeadline
    ? record.registrationDeadline.includes("T")
      ? `${record.registrationDeadline}:00+05:30`
      : `${record.registrationDeadline}T23:59:00+05:30`
    : null
  return {
    id: record.id,
    campusId: record.publisherCampusId,
    title: record.title,
    summary: record.description.slice(0, 160),
    description: record.description,
    category: campusCategories.find((name) => name.toLowerCase() === record.category.trim().toLowerCase()) ?? "Event",
    audience: record.eligibility || "All interested students",
    department: record.department || record.publisher,
    startDate,
    endDate,
    deadline,
    venue: record.venue || null,
    publisher: record.publisher,
    sourceType: "Student group",
    sourceUrl: record.registrationUrl || null,
    documentDate: record.createdAt.slice(0, 10),
    publishedAt: record.publishedAt || record.updatedAt,
    lastVerifiedAt: record.reviewedAt,
    reviewStatus: "Human reviewed",
    status: registrationStatus(deadline),
    tags: [record.category.toLowerCase(), "local demo publication", "student group"],
    isDemoPublication: true,
    sourceLabel: record.sourceName,
  }
}

export function getPublishedCampusItems() {
  return publishedClubRecords().map(toCampusItem)
}
