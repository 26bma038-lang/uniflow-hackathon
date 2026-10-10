export type CampusCategory =
  | "Notice"
  | "Event"
  | "Scholarship"
  | "Deadline"
  | "Opportunity"

export type CampusSource = "Noticeboard" | "Email" | "Student group" | "Department"
export type ReviewStatus = "Human reviewed" | "Needs review" | "Source unavailable"
// "Check source" is for a record whose deadline the source does not give, or gives only as
// today's date with no time: UniFlow cannot say whether it is still open.
export type ItemStatus = "Upcoming" | "Open" | "Closing soon" | "Past" | "Check source"

export type CampusItem = {
  id: string
  campusId: string
  title: string
  summary: string
  description: string
  category: CampusCategory
  audience: string
  department: string
  startDate: string | null
  endDate: string | null
  deadline: string | null
  venue: string | null
  publisher: string
  sourceType: CampusSource
  sourceUrl: string | null
  documentDate: string | null
  publishedAt: string
  lastVerifiedAt: string | null
  reviewStatus: ReviewStatus
  status: ItemStatus
  image?: string
  tags: string[]
  // True for an update a club published through UniFlow, which has a row in the events table.
  isClubPublication?: boolean
  // True for a record copied from its publisher's public page. The publisher does not post
  // on UniFlow, and UniFlow takes no RSVPs for it.
  isImported?: boolean
  // The club this record belongs to in the database, when it has one.
  clubId?: string | null
  // A link to sign up or apply, kept apart from sourceUrl when both exist.
  registrationUrl?: string | null
  sourceLabel?: string
}

export type StudentProfile = {
  displayName: string
  department: string
  academicYear: string
  interests: string[]
  preferredCategories: CampusCategory[]
}

export type SavedItem = {
  itemId: string
  savedAt: string
}

export const interestOptions = [
  "Technology",
  "Research",
  "Scholarships",
  "Campus events",
  "Entrepreneurship",
  "Cultural activities",
  "Career opportunities",
]
