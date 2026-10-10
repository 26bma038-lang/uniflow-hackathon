export type CampusCategory =
  | "Notice"
  | "Event"
  | "Scholarship"
  | "Deadline"
  | "Opportunity"

export type CampusSource = "Noticeboard" | "Email" | "Student group" | "Department"
export type ReviewStatus = "Human reviewed" | "Needs review" | "Source unavailable"
export type ItemStatus = "Upcoming" | "Open" | "Closing soon"

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
