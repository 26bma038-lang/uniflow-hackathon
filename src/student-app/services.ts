import { campusItems, defaultProfile } from "./data"
import type { CampusCategory, CampusItem, StudentProfile } from "./types"

export type DiscoverFilters = {
  query: string
  category: CampusCategory | "All"
  department: string
  timing: "all" | "this-week" | "deadlines"
  sort: "relevant" | "soonest" | "recent"
}

export const mockCampusService = {
  listItems(): CampusItem[] {
    return campusItems
  },
  getItem(id: string | undefined) {
    return campusItems.find((item) => item.id === id) ?? null
  },
  getProfile(): StudentProfile {
    return defaultProfile
  },
}

// Each interest maps to plain keywords. An item matches an interest when one of
// them starts a word in its title, summary, category, or tags.
const interestKeywords: Record<string, string[]> = {
  Technology: ["technology", "tech", "coding", "code", "web", "software", "robot", "hackathon"],
  Research: ["research", "paper", "thesis"],
  Scholarships: ["scholarship", "funding", "grant", "fellowship"],
  "Campus events": ["event", "fest", "meetup", "performance"],
  Entrepreneurship: ["entrepreneur", "startup", "pitch", "founder", "incubator"],
  "Cultural activities": ["culture", "cultural", "music", "arts", "dance", "creative"],
  "Career opportunities": ["career", "internship", "recruitment", "job", "placement", "hiring"],
}

export function matchInterests(item: CampusItem, interests: string[]) {
  const text = [item.title, item.summary, item.category, ...item.tags].join(" ").toLowerCase()
  return interests.filter((interest) =>
    (interestKeywords[interest] ?? []).some((keyword) => new RegExp(`\\b${keyword}`).test(text)),
  )
}

// Stable: items matching more interests come first, everything else keeps its order.
export function orderByInterests(items: CampusItem[], interests: string[]) {
  return items
    .map((item, index) => ({ item, index, score: matchInterests(item, interests).length }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((entry) => entry.item)
}

export function filterCampusItems(items: CampusItem[], filters: DiscoverFilters, interests: string[] = []) {
  const query = filters.query.trim().toLowerCase()
  const filtered = items.filter((item) => {
    const searchable = [
      item.title,
      item.summary,
      item.category,
      item.department,
      item.publisher,
      item.audience,
      ...item.tags,
    ]
      .join(" ")
      .toLowerCase()
    const matchesQuery = !query || searchable.includes(query)
    const matchesCategory =
      filters.category === "All" || item.category === filters.category
    const matchesDepartment =
      filters.department === "All" || item.department === filters.department
    const matchesTiming =
      filters.timing === "all" ||
      (filters.timing === "deadlines" && Boolean(item.deadline)) ||
      (filters.timing === "this-week" && ["2026-10-18", "2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22", "2026-10-25"].some((date) => (item.deadline ?? item.startDate ?? "").startsWith(date)))
    return matchesQuery && matchesCategory && matchesDepartment && matchesTiming
  })
  return [...filtered].sort((a, b) => {
    if (filters.sort === "recent") return b.publishedAt.localeCompare(a.publishedAt)
    if (filters.sort === "soonest") {
      return (a.deadline ?? a.startDate ?? "9999").localeCompare(b.deadline ?? b.startDate ?? "9999")
    }
    return (
      matchInterests(b, interests).length - matchInterests(a, interests).length ||
      Number(b.reviewStatus === "Human reviewed") - Number(a.reviewStatus === "Human reviewed")
    )
  })
}
