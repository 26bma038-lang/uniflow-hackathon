import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  BookmarkCheck,
  CalendarDays,
  Check,
  ChevronRight,
  CircleAlert,
  Filter,
  Menu,
  Search,
  Sparkles,
  X,
} from "lucide-react"
import { campusItems, defaultProfile, DEMO_PERIOD } from "./data"
import { filterCampusItems, type DiscoverFilters } from "./services"
import type { CampusCategory, CampusItem, StudentProfile } from "./types"
import { interestOptions } from "./types"
import { useSavedItems } from "./useSavedItems"

type StudentRoute = "today" | "discover" | "saved" | "profile" | "item"

const categories: Array<CampusCategory | "All"> = [
  "All",
  "Notice",
  "Event",
  "Scholarship",
  "Deadline",
  "Opportunity",
]

const categoryColors: Record<CampusCategory, string> = {
  Notice: "student-category-notice",
  Event: "student-category-event",
  Scholarship: "student-category-scholarship",
  Deadline: "student-category-deadline",
  Opportunity: "student-category-opportunity",
}

function getRoute() {
  const parts = window.location.pathname.split("/").filter(Boolean)
  if (parts[1] === "item" && parts[2]) return { route: "item" as const, id: parts[2] }
  const route = parts[1] as StudentRoute
  return {
    route: ["today", "discover", "saved", "profile"].includes(route)
      ? route
      : ("today" as const),
    id: undefined,
  }
}

function formatDate(value: string | null) {
  if (!value) return "Date to be confirmed"
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "short",
    hour: value.includes("T") ? "numeric" : undefined,
    minute: value.includes("T") ? "2-digit" : undefined,
  }).format(new Date(value))
}

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return "Good morning"
  if (hour < 18) return "Good afternoon"
  return "Good evening"
}

function SourceBadge({ item }: { item: CampusItem }) {
  return (
    <span className="student-source-badge">
      <span className="student-source-dot" />
      {item.reviewStatus}
    </span>
  )
}

function SaveButton({
  item,
  isSaved,
  onToggle,
}: {
  item: CampusItem
  isSaved: boolean
  onToggle: () => void
}) {
  return (
    <button
      type="button"
      className="student-save-button"
      aria-pressed={isSaved}
      aria-label={isSaved ? `Unsave ${item.title}` : `Save ${item.title}`}
      onClick={(event) => {
        event.stopPropagation()
        onToggle()
      }}
    >
      {isSaved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
      <span>{isSaved ? "Saved" : "Save"}</span>
    </button>
  )
}

function CampusItemRow({
  item,
  saved,
  onOpen,
  onToggleSaved,
  featured = false,
}: {
  item: CampusItem
  saved: boolean
  onOpen: () => void
  onToggleSaved: () => void
  featured?: boolean
}) {
  return (
    <motion.article
      layout
      className={`student-item-row ${featured ? "student-item-featured" : ""}`}
      whileHover={{ y: -2 }}
      transition={{ duration: 0.2 }}
    >
      {featured && item.image ? (
        <img className="student-item-image" src={item.image} alt="" />
      ) : (
        <div className={`student-item-date ${categoryColors[item.category]}`}>
          <strong>{formatDate(item.deadline ?? item.startDate).split(" ")[0]}</strong>
          <span>{formatDate(item.deadline ?? item.startDate).split(" ")[1] ?? "TBC"}</span>
        </div>
      )}
      <button type="button" className="student-item-content" onClick={onOpen}>
        <div className="student-item-kicker">
          <span className={categoryColors[item.category]}>{item.category}</span>
          <span>{item.department}</span>
        </div>
        <h3>{item.title}</h3>
        <p>{item.summary}</p>
        <div className="student-item-meta">
          <span>{item.deadline ? `Deadline · ${formatDate(item.deadline)}` : formatDate(item.startDate)}</span>
          <span>{item.venue ?? item.audience}</span>
        </div>
      </button>
      <div className="student-item-actions">
        <SourceBadge item={item} />
        <SaveButton item={item} isSaved={saved} onToggle={onToggleSaved} />
        <button type="button" className="student-open-icon" aria-label={`Open ${item.title}`} onClick={onOpen}>
          <ArrowUpRight size={18} />
        </button>
      </div>
    </motion.article>
  )
}

function FilterBar({
  filters,
  setFilters,
  departments,
}: {
  filters: DiscoverFilters
  setFilters: (filters: DiscoverFilters) => void
  departments: string[]
}) {
  return (
    <div className="student-filter-bar">
      <label className="student-search">
        <Search size={18} />
        <span className="sr-only">Search campus information</span>
        <input
          value={filters.query}
          onChange={(event) => setFilters({ ...filters, query: event.target.value })}
          placeholder="Search notices, events, scholarships..."
        />
        {filters.query && (
          <button type="button" aria-label="Clear search" onClick={() => setFilters({ ...filters, query: "" })}>
            <X size={15} />
          </button>
        )}
      </label>
      <div className="student-filter-controls">
        <label>
          <span>Category</span>
          <select value={filters.category} onChange={(event) => setFilters({ ...filters, category: event.target.value as DiscoverFilters["category"] })}>
            {categories.map((category) => <option key={category}>{category}</option>)}
          </select>
        </label>
        <label>
          <span>Department</span>
          <select value={filters.department} onChange={(event) => setFilters({ ...filters, department: event.target.value })}>
            <option>All</option>
            {departments.map((department) => <option key={department}>{department}</option>)}
          </select>
        </label>
        <label>
          <span>When</span>
          <select value={filters.timing} onChange={(event) => setFilters({ ...filters, timing: event.target.value as DiscoverFilters["timing"] })}>
            <option value="all">Any time</option>
            <option value="this-week">This demo week</option>
            <option value="deadlines">Deadlines only</option>
          </select>
        </label>
        <label>
          <span>Sort</span>
          <select value={filters.sort} onChange={(event) => setFilters({ ...filters, sort: event.target.value as DiscoverFilters["sort"] })}>
            <option value="relevant">Relevant first</option>
            <option value="soonest">Soonest first</option>
            <option value="recent">Recently added</option>
          </select>
        </label>
      </div>
    </div>
  )
}

function StudentApp() {
  const [location, setLocation] = useState(getRoute)
  const [profile, setProfile] = useState<StudentProfile>(() => {
    try {
      return JSON.parse(localStorage.getItem("uniflow-student-profile") ?? "null") ?? defaultProfile
    } catch {
      return defaultProfile
    }
  })
  const [mobileNav, setMobileNav] = useState(false)
  const [savedNotice, setSavedNotice] = useState("")
  const { saved, isSaved, toggleSaved } = useSavedItems()
  const reducedMotion = useReducedMotion() ?? false

  useEffect(() => {
    const sync = () => setLocation(getRoute())
    window.addEventListener("popstate", sync)
    return () => window.removeEventListener("popstate", sync)
  }, [])

  const go = (path: string) => {
    if (path === "/") {
      window.location.assign("/")
      return
    }
    window.history.pushState({}, "", path)
    setLocation(getRoute())
    setMobileNav(false)
    window.scrollTo({ top: 0, behavior: reducedMotion ? "auto" : "smooth" })
  }

  const handleSave = (item: CampusItem) => {
    toggleSaved(item.id)
    setSavedNotice(isSaved(item.id) ? `${item.title} removed from Saved.` : `${item.title} saved for later.`)
    window.setTimeout(() => setSavedNotice(""), 2200)
  }

  const item = location.route === "item" ? campusItems.find((entry) => entry.id === location.id) ?? null : null

  return (
    <div className="student-app">
      <aside className={`student-sidebar ${mobileNav ? "is-open" : ""}`}>
        <div className="student-brand">
          <a href="/app/today" onClick={(event) => { event.preventDefault(); go("/app/today") }}>
            <span className="student-brand-mark">U</span>
            <span>UniFlow</span>
          </a>
          <span className="student-prototype-label">STUDENT VIEW · DEMO</span>
        </div>
        <nav aria-label="Student application">
          {[
            ["today", "Today & Soon"],
            ["discover", "Discover"],
            ["saved", `Saved${saved.length ? ` · ${saved.length}` : ""}`],
            ["profile", "Profile"],
          ].map(([route, label]) => (
            <a
              key={route}
              href={`/app/${route}`}
              className={location.route === route ? "is-active" : ""}
              onClick={(event) => { event.preventDefault(); go(`/app/${route}`) }}
            >
              <span className="student-nav-marker" />
              {label}
              {route === "saved" && saved.length > 0 && <span className="student-nav-count">{saved.length}</span>}
            </a>
          ))}
        </nav>
        <div className="student-sidebar-footer">
          <p>Example period</p>
          <strong>18—25 OCT 2026</strong>
          <span>Illustrative campus data. No live institutional feed is connected.</span>
        </div>
      </aside>
      {mobileNav && <button className="student-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <main className="student-main">
        <header className="student-topbar">
          <button className="student-mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={21} /></button>
          <div className="student-breadcrumb">
            <a href="/" onClick={(event) => { event.preventDefault(); go("/") }}>UniFlow</a>
            <ChevronRight size={15} />
            <span>{location.route === "item" ? "Information" : location.route === "today" ? "Today & Soon" : location.route[0].toUpperCase() + location.route.slice(1)}</span>
          </div>
          <button className="student-profile-mini" type="button" onClick={() => go("/app/profile")}>
            <span>{profile.displayName.slice(0, 1).toUpperCase()}</span>
            <strong>{profile.displayName}</strong>
          </button>
        </header>
        {savedNotice && <div className="student-toast" role="status"><Check size={15} />{savedNotice}</div>}
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={`${location.route}-${location.id ?? ""}`} initial={reducedMotion ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0, y: -8 }} transition={{ duration: reducedMotion ? 0 : 0.25 }}>
            {location.route === "today" && <TodayPage profile={profile} saved={isSaved} onSave={handleSave} onOpen={(id) => go(`/app/item/${id}`)} onDiscover={() => go("/app/discover")} />}
            {location.route === "discover" && <DiscoverPage saved={isSaved} onSave={handleSave} onOpen={(id) => go(`/app/item/${id}`)} />}
            {location.route === "saved" && <SavedPage savedItems={saved.map((entry) => campusItems.find((itemEntry) => itemEntry.id === entry.itemId)).filter((entry): entry is CampusItem => Boolean(entry))} saved={isSaved} onSave={handleSave} onOpen={(id) => go(`/app/item/${id}`)} onDiscover={() => go("/app/discover")} />}
            {location.route === "profile" && <ProfilePage profile={profile} onSave={(next) => { setProfile(next); localStorage.setItem("uniflow-student-profile", JSON.stringify(next)); setSavedNotice("Demo preferences saved.") }} />}
            {location.route === "item" && <DetailPage item={item} saved={item ? isSaved(item.id) : false} onSave={item ? () => handleSave(item) : undefined} onBack={() => window.history.back()} onOpen={(id) => go(`/app/item/${id}`)} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  )
}

function TodayPage({ profile, saved, onSave, onOpen, onDiscover }: { profile: StudentProfile; saved: (id: string) => boolean; onSave: (item: CampusItem) => void; onOpen: (id: string) => void; onDiscover: () => void }) {
  const personalized = campusItems.filter((item) => profile.preferredCategories.includes(item.category) || item.tags.some((tag) => profile.interests.some((interest) => tag.toLowerCase().includes(interest.split(" ")[0].toLowerCase()))))
  const featured = campusItems.find((item) => item.id === "build-first-web-app") ?? campusItems[0]
  const needsAttention = campusItems.filter((item) => item.deadline && item.id !== featured.id).slice(0, 2)
  const comingUp = campusItems.filter((item) => !needsAttention.includes(item) && item.id !== featured.id).slice(0, 3)
  return (
    <section className="student-page">
      <div className="student-page-heading">
        <div>
          <p className="student-eyebrow">TODAY & SOON · {DEMO_PERIOD}</p>
          <h1>{getGreeting()}, {profile.displayName}.</h1>
          <p>Here’s what matters on your campus, shaped by your demo preferences.</p>
        </div>
        <button className="student-text-action" type="button" onClick={onDiscover}><Search size={17} /> Search campus</button>
      </div>
      <div className="student-personalization-note"><Sparkles size={16} /> Recommendations based on your demo preferences · {profile.department} · {profile.academicYear}</div>
      <div className="student-today-grid">
        <section className="student-attention-column">
          <div className="student-section-label"><span>01</span><h2>Needs attention</h2><span className="student-section-rule" /></div>
          {needsAttention.map((item) => <CampusItemRow key={item.id} item={item} saved={saved(item.id)} onToggleSaved={() => onSave(item)} onOpen={() => onOpen(item.id)} />)}
        </section>
        <section className="student-feature-column">
          <div className="student-section-label"><span>FEATURED</span><span className="student-section-rule" /></div>
          <CampusItemRow item={featured} featured saved={saved(featured.id)} onToggleSaved={() => onSave(featured)} onOpen={() => onOpen(featured.id)} />
        </section>
      </div>
      <section className="student-coming-section">
        <div className="student-section-label"><span>02</span><h2>Coming up</h2><span className="student-section-rule" /><button type="button" onClick={onDiscover}>View all <ArrowUpRight size={15} /></button></div>
        <div className="student-coming-list">{comingUp.map((item) => <CampusItemRow key={item.id} item={item} saved={saved(item.id)} onToggleSaved={() => onSave(item)} onOpen={() => onOpen(item.id)} />)}</div>
      </section>
      <p className="student-demo-footnote"><CircleAlert size={15} /> Prototype records are illustrative and are not official institutional notices.</p>
    </section>
  )
}

function DiscoverPage({ saved, onSave, onOpen }: { saved: (id: string) => boolean; onSave: (item: CampusItem) => void; onOpen: (id: string) => void }) {
  const [filters, setFilters] = useState<DiscoverFilters>({ query: "", category: "All", department: "All", timing: "all", sort: "relevant" })
  const departments = useMemo(() => [...new Set(campusItems.map((item) => item.department))], [])
  const results = useMemo(() => filterCampusItems(campusItems, filters), [filters])
  const reset = () => setFilters({ query: "", category: "All", department: "All", timing: "all", sort: "relevant" })
  return (
    <section className="student-page">
      <div className="student-page-heading">
        <div><p className="student-eyebrow">THE CAMPUS INDEX</p><h1>Discover what’s next.</h1><p>Search the edited campus record by the things you need to know, join, or finish.</p></div>
      </div>
      <FilterBar filters={filters} setFilters={setFilters} departments={departments} />
      <div className="student-results-heading"><strong>{results.length} {results.length === 1 ? "record" : "records"}</strong><span>{DEMO_PERIOD}</span>{(filters.query || filters.category !== "All" || filters.department !== "All" || filters.timing !== "all") && <button type="button" onClick={reset}>Clear filters</button>}</div>
      <div className="student-discover-list">
        <AnimatePresence mode="popLayout">
          {results.map((item) => <CampusItemRow key={item.id} item={item} saved={saved(item.id)} onToggleSaved={() => onSave(item)} onOpen={() => onOpen(item.id)} />)}
        </AnimatePresence>
      </div>
      {results.length === 0 && <div className="student-empty-state"><Filter size={25} /><h2>Nothing matches those filters.</h2><p>Try a broader search or clear the current view.</p><button type="button" onClick={reset}>Reset discovery</button></div>}
    </section>
  )
}

function SavedPage({ savedItems, saved, onSave, onOpen, onDiscover }: { savedItems: CampusItem[]; saved: (id: string) => boolean; onSave: (item: CampusItem) => void; onOpen: (id: string) => void; onDiscover: () => void }) {
  const [category, setCategory] = useState<CampusCategory | "All">("All")
  const filtered = savedItems.filter((item) => category === "All" || item.category === category)
  return (
    <section className="student-page">
      <div className="student-page-heading"><div><p className="student-eyebrow">YOUR SHORTLIST · {savedItems.length} SAVED</p><h1>Keep it close.</h1><p>Important notices and opportunities, gathered without losing their source context.</p></div><label className="student-inline-filter"><span>Show</span><select value={category} onChange={(event) => setCategory(event.target.value as CampusCategory | "All")}><option>All</option>{categories.slice(1).map((entry) => <option key={entry}>{entry}</option>)}</select></label></div>
      {filtered.length ? <div className="student-saved-list">{filtered.map((item) => <CampusItemRow key={item.id} item={item} saved={saved(item.id)} onToggleSaved={() => onSave(item)} onOpen={() => onOpen(item.id)} />)}</div> : <div className="student-empty-state"><Bookmark size={25} /><h2>Nothing saved yet.</h2><p>Keep important notices and opportunities close.</p><button type="button" onClick={onDiscover}>Discover campus information</button></div>}
    </section>
  )
}

function ProfilePage({ profile, onSave }: { profile: StudentProfile; onSave: (profile: StudentProfile) => void }) {
  const [draft, setDraft] = useState(profile)
  const update = <K extends keyof StudentProfile>(key: K, value: StudentProfile[K]) => setDraft((current) => ({ ...current, [key]: value }))
  const toggle = (interest: string) => update("interests", draft.interests.includes(interest) ? draft.interests.filter((entry) => entry !== interest) : [...draft.interests, interest])
  return (
    <section className="student-page">
      <div className="student-page-heading"><div><p className="student-eyebrow">YOUR DEMO PROFILE</p><h1>Make the campus feel more yours.</h1><p>These preferences shape the order of Today & Soon. Nothing here connects to a real account.</p></div></div>
      <div className="student-profile-layout">
        <div className="student-profile-intro"><span className="student-profile-avatar">{draft.displayName.slice(0, 1).toUpperCase()}</span><h2>{draft.displayName || "Your name"}</h2><p>{draft.department} · {draft.academicYear}</p><div className="student-profile-rule" /><span>LOCAL DEMO PROFILE</span></div>
        <form className="student-profile-form" onSubmit={(event) => { event.preventDefault(); onSave(draft) }}>
          <label>Display name<input value={draft.displayName} onChange={(event) => update("displayName", event.target.value)} required /></label>
          <div className="student-form-grid"><label>Department<input value={draft.department} onChange={(event) => update("department", event.target.value)} required /></label><label>Academic year<select value={draft.academicYear} onChange={(event) => update("academicYear", event.target.value)}><option>1st year</option><option>2nd year</option><option>3rd year</option><option>4th year</option><option>Postgraduate</option></select></label></div>
          <fieldset><legend>Interests</legend><div className="student-interest-list">{interestOptions.map((interest) => <button key={interest} type="button" className={draft.interests.includes(interest) ? "is-selected" : ""} aria-pressed={draft.interests.includes(interest)} onClick={() => toggle(interest)}>{draft.interests.includes(interest) && <Check size={14} />}{interest}</button>)}</div></fieldset>
          <div className="student-form-actions"><button type="button" className="student-secondary-action" onClick={() => setDraft(profile)}>Reset</button><button type="submit" className="student-primary-action">Save preferences <ArrowUpRight size={16} /></button></div>
        </form>
      </div>
    </section>
  )
}

function DetailPage({ item, saved, onSave, onBack, onOpen }: { item: CampusItem | null; saved: boolean; onSave?: () => void; onBack: () => void; onOpen: (id: string) => void }) {
  if (!item) return <section className="student-page student-not-found"><ArrowLeft size={25} /><p className="student-eyebrow">404 · INFORMATION NOT FOUND</p><h1>This record isn’t available.</h1><p>The link may be outdated, or this illustrative item has moved.</p><button type="button" onClick={onBack}>Go back</button></section>
  const related = campusItems.filter((entry) => entry.id !== item.id && (entry.department === item.department || entry.category === item.category)).slice(0, 2)
  return (
    <article className="student-detail-page">
      <button type="button" className="student-back-action" onClick={onBack}><ArrowLeft size={16} /> Back to campus information</button>
      <div className="student-detail-layout">
        <div className="student-detail-main">
          <div className="student-detail-kicker"><span className={categoryColors[item.category]}>{item.category}</span><span>{item.status}</span></div>
          <h1>{item.title}</h1><p className="student-detail-summary">{item.summary}</p>
          <div className="student-detail-actions"><SaveButton item={item} isSaved={saved} onToggle={() => onSave?.()} /><button type="button" className="student-primary-action" onClick={() => item.sourceUrl && window.open(item.sourceUrl, "_blank", "noopener,noreferrer")} disabled={!item.sourceUrl}>Open source <ArrowUpRight size={16} /></button></div>
          {item.image && <img className="student-detail-image" src={item.image} alt="" />}
          <p className="student-detail-description">{item.description}</p>
          <div className="student-detail-facts"><div><span>WHO IT’S FOR</span><strong>{item.audience}</strong></div><div><span>DEPARTMENT</span><strong>{item.department}</strong></div><div><span>{item.deadline ? "DEADLINE" : "WHEN"}</span><strong>{formatDate(item.deadline ?? item.startDate)}</strong></div><div><span>WHERE</span><strong>{item.venue ?? "To be confirmed"}</strong></div></div>
        </div>
        <aside className="student-provenance"><p className="student-eyebrow">SOURCE NOTES</p><h2>Keep the context close.</h2><div className="student-provenance-block"><span>Publisher identity</span><strong>{item.publisher}</strong></div><div className="student-provenance-block"><span>Original source</span><strong>{item.sourceUrl ? "External source available" : "Source unavailable in this demo."}</strong></div><div className="student-provenance-block"><span>Review status</span><strong><SourceBadge item={item} /></strong></div><div className="student-provenance-block"><span>Last checked</span><strong>{item.lastVerifiedAt ? formatDate(item.lastVerifiedAt) : "Not recorded"}</strong></div><p className="student-provenance-note">Human review does not make a fictional record an official institutional notice.</p></aside>
      </div>
      {related.length > 0 && <section className="student-related"><div className="student-section-label"><span>MORE TO EXPLORE</span><span className="student-section-rule" /></div>{related.map((entry) => <button type="button" key={entry.id} onClick={() => onOpen(entry.id)}><span>{entry.category}</span><strong>{entry.title}</strong><ArrowUpRight size={16} /></button>)}</section>}
    </article>
  )
}

export default StudentApp
