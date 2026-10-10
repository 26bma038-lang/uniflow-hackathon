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
import { defaultProfile, DEMO_PERIOD } from "./data"
import { filterCampusItems, matchInterests, orderByInterests, type DiscoverFilters } from "./services"
import type { CampusCategory, CampusItem, StudentProfile } from "./types"
import { interestOptions } from "./types"
import { useSavedItems } from "./useSavedItems"
import { acceptsRsvps, canJoin, isRegistrationClosed, registrationCutoff, useJoinedEvents, type JoinedEvents } from "./useJoinedEvents"
import { useAuth } from "../auth/AuthProvider"
import { clearPendingDestination, setPendingItemDestination } from "../demo-session"
import { clubSlug } from "../club/publishing"
import { useCampusItems } from "../club/published-events"
import { refreshPublishedEvents } from "../club/published-events"
import AskCampus from "../ai/components/AskCampus"
import AssignmentsPage from "../assignments/components/AssignmentsPage"

type StudentRoute = "today" | "discover" | "ask" | "assignments" | "saved" | "joined" | "profile" | "item"

const routeTitles: Record<StudentRoute, string> = { today: "Today & Soon", discover: "Discover", ask: "Ask", assignments: "Assignments", saved: "Saved", joined: "Joined", profile: "Profile", item: "Information" }

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
    route: ["today", "discover", "ask", "assignments", "saved", "joined", "profile"].includes(route)
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
    hour: value.includes("T") ? "2-digit" : undefined,
    minute: value.includes("T") ? "2-digit" : undefined,
    hourCycle: "h23",
  }).format(new Date(value))
}

// Events and opportunities run on startDate; any deadline on them is a registration cutoff.
function hasRegistration(item: CampusItem) {
  return Boolean(item.startDate && item.deadline) && (item.category === "Event" || item.category === "Opportunity")
}

function primaryDate(item: CampusItem) {
  return hasRegistration(item) ? item.startDate : item.deadline ?? item.startDate
}

function DateLines({ item }: { item: CampusItem }) {
  const soon = item.status === "Closing soon" && <em>Closing soon</em>
  if (hasRegistration(item)) {
    return (
      <>
        <span className="student-when"><b>Event</b>{formatDate(item.startDate)}</span>
        <span className="student-when is-deadline"><b>Register by</b>{formatDate(item.deadline)}{soon}</span>
      </>
    )
  }
  if (item.deadline) {
    return <span className="student-when is-deadline"><b>Deadline</b>{formatDate(item.deadline)}{soon}</span>
  }
  return <span className="student-when"><b>When</b>{formatDate(item.startDate)}</span>
}

// Student sign-in for a visitor with no session. From Join or Save, sign-in returns to that item;
// from anywhere else it is a normal sign-in that ends on Today.
function enterStudentDemo(returnToItemId?: string) {
  if (returnToItemId) setPendingItemDestination(returnToItemId)
  else clearPendingDestination()
  window.location.assign("/login/student")
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
  matches = [],
}: {
  item: CampusItem
  saved: boolean
  onOpen: () => void
  onToggleSaved: () => void
  featured?: boolean
  matches?: string[]
}) {
  const isScholarship = item.id === "student-support-scholarship"
  const [expanded, setExpanded] = useState(false)
  const reducedMotion = useReducedMotion() ?? false
  const motionTransition = reducedMotion
    ? { duration: 0 }
    : { type: "spring" as const, stiffness: 260, damping: 28 }
  const collapseIfOutside = (event: React.FocusEvent<HTMLElement>) => {
    if (isScholarship && !event.currentTarget.contains(event.relatedTarget as Node | null)) {
      setExpanded(false)
    }
  }
  return (
    <motion.article
      layout
      tabIndex={isScholarship ? 0 : undefined}
      aria-expanded={isScholarship ? expanded : undefined}
      className={`student-item-row ${featured ? "student-item-featured" : ""} ${isScholarship ? "student-item-scholarship" : ""} ${expanded ? "is-expanded" : ""}`}
      onMouseEnter={isScholarship ? () => setExpanded(true) : undefined}
      onMouseLeave={isScholarship ? () => setExpanded(false) : undefined}
      onFocus={isScholarship ? (event) => {
        if (event.currentTarget.matches(":focus-visible")) setExpanded(true)
      } : undefined}
      onBlur={isScholarship ? collapseIfOutside : undefined}
      onPointerUp={isScholarship ? (event) => {
        if (event.pointerType === "touch" && !(event.target as HTMLElement).closest("button")) {
          setExpanded((value) => !value)
        }
      } : undefined}
      whileHover={isScholarship ? undefined : { y: -2 }}
      transition={motionTransition}
    >
      {featured && item.image ? (
        <img className="student-item-image" src={item.image} alt="" />
      ) : (
        <motion.div
          className={`student-item-date ${categoryColors[item.category]}`}
          animate={isScholarship ? { scale: expanded ? 1.06 : 1 } : undefined}
          transition={motionTransition}
        >
          <strong>{formatDate(primaryDate(item)).split(" ")[0]}</strong>
          <span>{formatDate(primaryDate(item)).split(" ")[1] ?? "TBC"}</span>
        </motion.div>
      )}
      <button type="button" className="student-item-content" onClick={onOpen}>
        <div className="student-item-kicker">
          <span className={categoryColors[item.category]}>{item.category}</span>
          <span>{item.publisher}</span>
        </div>
        <motion.h3 animate={isScholarship ? { x: expanded ? 3 : 0 } : undefined} transition={motionTransition}>{item.title}</motion.h3>
        <p>{item.summary}</p>
        {matches.length > 0 && <span className="student-match"><Sparkles size={13} aria-hidden="true" /> Matches your interests: {matches.join(", ")}</span>}
        <div className="student-item-meta">
          <DateLines item={item} />
          <span className="student-where">{item.venue ?? item.audience}</span>
        </div>
      </button>
      <div className="student-item-actions">
        <SourceBadge item={item} />
        <SaveButton item={item} isSaved={saved} onToggle={onToggleSaved} />
        <button type="button" className="student-open-icon" aria-label={`Open ${item.title}`} onClick={onOpen}>
          <motion.span animate={isScholarship ? { x: expanded ? 3 : 0, y: expanded ? -2 : 0 } : undefined} transition={motionTransition}>
            <ArrowUpRight size={18} />
          </motion.span>
        </button>
      </div>
      {isScholarship && (
        <AnimatePresence initial={false}>
          {expanded && (
            <motion.div
              className="student-scholarship-details"
              initial={reducedMotion ? false : { opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -5 }}
              transition={reducedMotion ? { duration: 0 } : { duration: 0.2, delay: 0.06 }}
            >
              <motion.div
                className="student-scholarship-copy"
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.22, delay: 0.1 }}
              >
                <span>WHY IT MATTERS</span>
                <p>{item.description || item.summary}</p>
              </motion.div>
              <motion.div
                className="student-scholarship-facts"
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={reducedMotion ? { duration: 0 } : { duration: 0.22, delay: 0.15 }}
              >
                <span><b>ELIGIBLE FOR</b>{item.audience}</span>
                {item.deadline && <span><b>DEADLINE</b>{formatDate(item.deadline)}</span>}
                <button type="button" onClick={onOpen}>View details <ArrowUpRight size={15} /></button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
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

// Browsing stays open to everyone. Join, Save, Saved, and Joined need a signed-in user, and
// the page waits for a stored session to be restored before deciding there is none.
function StudentApp() {
  const auth = useAuth()
  if (auth.status === "loading") {
    return <div className="student-app"><main className="student-main"><p className="student-personalization-note" role="status" aria-live="polite">Checking your session…</p></main></div>
  }
  return <StudentAppContent key={auth.email ?? "signed-out"} />
}

function StudentAppContent() {
  const auth = useAuth()
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
  // The signed-in user's email, from Supabase Auth. Nothing typed into the app can set it.
  const studentEmail = auth.email
  const { saved, isSaved, toggleSaved } = useSavedItems(studentEmail)
  const rsvp = useJoinedEvents(auth.user?.id ?? null, studentEmail)
  const reducedMotion = useReducedMotion() ?? false
  // Sample records, then everything clubs have published, read from the server.
  const campus = useCampusItems(false)
  const campusRecords = campus.items

  useEffect(() => {
    const sync = () => setLocation(getRoute())
    window.addEventListener("popstate", sync)
    return () => window.removeEventListener("popstate", sync)
  }, [])

  // The mobile tab bar scrolls sideways; keep the current tab in view.
  useEffect(() => {
    document.querySelector('.student-tabbar a[aria-current="page"]')?.scrollIntoView({ inline: "center", block: "nearest" })
  }, [location.route])

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

  const [signingOut, setSigningOut] = useState(false)
  const signOut = async () => {
    setSigningOut(true)
    await auth.signOut()
    window.location.assign("/get-started")
  }

  const handleSave = (item: CampusItem) => {
    // Saved items are kept per signed-in student, so there is nothing to save under without a session.
    if (!studentEmail) {
      enterStudentDemo(item.id)
      return
    }
    toggleSaved(item.id)
    setSavedNotice(isSaved(item.id) ? `${item.title} removed from Saved.` : `${item.title} saved for later.`)
    window.setTimeout(() => setSavedNotice(""), 2200)
  }

  const item = location.route === "item" ? campusRecords.find((entry) => entry.id === location.id) ?? null : null

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
            ["ask", "Ask"],
            ["assignments", "Assignments"],
            ["saved", `Saved${saved.length ? ` · ${saved.length}` : ""}`],
            ["joined", "Joined"],
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
              {route === "joined" && rsvp.joined.length > 0 && <span className="student-nav-count">{rsvp.joined.length}</span>}
            </a>
          ))}
        </nav>
        <div className="student-sidebar-footer">
          <p>Example period</p>
          <strong>18—25 OCT 2026</strong>
          <span>Illustrative campus data. No live institutional feed is connected.</span>
          {studentEmail ? (
            <>
              <span>Signed in as {studentEmail}</span>
              <button type="button" className="student-session-action" onClick={() => window.location.assign("/login/club")}>Club workspace</button>
              <button type="button" className="student-session-action" disabled={signingOut} onClick={signOut}>{signingOut ? "Signing out…" : "Sign out"}</button>
            </>
          ) : (
            <button type="button" className="student-session-action" onClick={() => enterStudentDemo()}>Sign in</button>
          )}
        </div>
      </aside>
      <nav className="student-tabbar" aria-label="Student application tabs">
        {[["today", "Today"], ["discover", "Discover"], ["ask", "Ask"], ["assignments", "Assignments"], ["saved", "Saved"], ["joined", "Joined"], ["profile", "Profile"]].map(([route, label]) => (
          <a key={route} href={`/app/${route}`} aria-current={location.route === route ? "page" : undefined} onClick={(event) => { event.preventDefault(); go(`/app/${route}`) }}>{label}{route === "saved" && saved.length > 0 && <b>{saved.length}</b>}{route === "joined" && rsvp.joined.length > 0 && <b>{rsvp.joined.length}</b>}</a>
        ))}
      </nav>
      {mobileNav && <button className="student-scrim" aria-label="Close navigation" onClick={() => setMobileNav(false)} />}
      <main className="student-main">
        <header className="student-topbar">
          <button className="student-mobile-menu" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu size={21} /></button>
          <div className="student-breadcrumb">
            <a href="/" onClick={(event) => { event.preventDefault(); go("/") }}>UniFlow</a>
            <ChevronRight size={15} />
            <span>{routeTitles[location.route]}</span>
          </div>
          <button className="student-profile-mini" type="button" onClick={() => go("/app/profile")}>
            <span>{profile.displayName.slice(0, 1).toUpperCase()}</span>
            <strong>{profile.displayName}</strong>
          </button>
        </header>
        {savedNotice && <div className="student-toast" role="status"><Check size={15} />{savedNotice}</div>}
        {campus.status === "error" && <p className="student-personalization-note" role="alert"><CircleAlert size={15} /> {campus.message} Club updates may be missing or out of date. <button type="button" className="student-session-action" onClick={() => void refreshPublishedEvents()}>Try again</button></p>}
        {/* No exit-then-enter here: the next page mounts at once and stays visible while it settles. */}
          <motion.div key={`${location.route}-${location.id ?? ""}`} initial={reducedMotion ? false : { y: 10 }} animate={{ y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.25 }}>
            {location.route === "today" && <TodayPage items={campusRecords} profile={profile} saved={isSaved} onSave={handleSave} onOpen={(id) => go(`/app/item/${id}`)} onDiscover={() => go("/app/discover")} />}
            {location.route === "discover" && <DiscoverPage items={campusRecords} interests={profile.interests} saved={isSaved} onSave={handleSave} onOpen={(id) => go(`/app/item/${id}`)} />}
            {location.route === "ask" && (
              <section className="student-page">
                <div className="student-page-heading"><div><p className="student-eyebrow">AI DISCOVERY · PUBLISHED UPDATES ONLY</p><h1>Ask UniFlow.</h1></div></div>
                <AskCampus signedIn={Boolean(studentEmail)} onSignIn={() => enterStudentDemo()} onOpenItem={(id) => go(`/app/item/${id}`)} />
              </section>
            )}
            {location.route === "assignments" && <AssignmentsPage signedIn={Boolean(studentEmail)} email={studentEmail} onSignIn={() => enterStudentDemo()} />}
            {location.route === "saved" && <SavedPage email={studentEmail} items={campusRecords} savedItems={saved.map((entry) => campusRecords.find((itemEntry) => itemEntry.id === entry.itemId)).filter((entry): entry is CampusItem => Boolean(entry))} saved={isSaved} onSave={handleSave} onOpen={(id) => go(`/app/item/${id}`)} onDiscover={() => go("/app/discover")} />}
            {location.route === "profile" && <ProfilePage profile={profile} onSave={(next) => { setProfile(next); localStorage.setItem("uniflow-student-profile", JSON.stringify(next)); setSavedNotice("Demo preferences saved.") }} />}
            {location.route === "joined" && <JoinedPage rsvp={rsvp} joinedItems={rsvp.joined.map((entry) => campusRecords.find((itemEntry) => itemEntry.id === entry.itemId)).filter((entry): entry is CampusItem => Boolean(entry))} saved={isSaved} onSave={handleSave} onOpen={(id) => go(`/app/item/${id}`)} onDiscover={() => go("/app/discover")} />}
            {location.route === "item" && <DetailPage loading={campus.status === "loading"} rsvp={rsvp} items={campusRecords} item={item} saved={item ? isSaved(item.id) : false} onSave={item ? () => handleSave(item) : undefined} onBack={() => window.history.back()} onOpen={(id) => go(`/app/item/${id}`)} />}
          </motion.div>
      </main>
    </div>
  )
}

function TodayPage({ items, profile, saved, onSave, onOpen, onDiscover }: { items: CampusItem[]; profile: StudentProfile; saved: (id: string) => boolean; onSave: (item: CampusItem) => void; onOpen: (id: string) => void; onDiscover: () => void }) {
  const personalized = items.filter((item) => profile.preferredCategories.includes(item.category) || item.tags.some((tag) => profile.interests.some((interest) => tag.toLowerCase().includes(interest.split(" ")[0].toLowerCase()))))
  const featured = items.find((item) => item.isClubPublication) ?? items.find((item) => item.id === "build-first-web-app") ?? items[0]
  // Urgency decides membership: the two earliest deadlines. Interests only reorder within the section.
  const mostUrgent = items.filter((item) => item.deadline && item.id !== featured.id && !item.isClubPublication).sort((a, b) => a.deadline!.localeCompare(b.deadline!)).slice(0, 2)
  const needsAttention = orderByInterests(mostUrgent, profile.interests)
  const comingUp = orderByInterests(items.filter((item) => !needsAttention.includes(item) && item.id !== featured.id), profile.interests).slice(0, 3)
  void personalized
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
          {needsAttention.map((item) => <CampusItemRow key={item.id} item={item} matches={matchInterests(item, profile.interests)} saved={saved(item.id)} onToggleSaved={() => onSave(item)} onOpen={() => onOpen(item.id)} />)}
        </section>
        <section className="student-feature-column">
          <div className="student-section-label"><span>FEATURED</span><span className="student-section-rule" /></div>
          <CampusItemRow item={featured} featured matches={matchInterests(featured, profile.interests)} saved={saved(featured.id)} onToggleSaved={() => onSave(featured)} onOpen={() => onOpen(featured.id)} />
        </section>
      </div>
      <section className="student-coming-section">
        <div className="student-section-label"><span>02</span><h2>Coming up</h2><span className="student-section-rule" /><button type="button" onClick={onDiscover}>View all <ArrowUpRight size={15} /></button></div>
        <div className="student-coming-list">{comingUp.map((item) => <CampusItemRow key={item.id} item={item} matches={matchInterests(item, profile.interests)} saved={saved(item.id)} onToggleSaved={() => onSave(item)} onOpen={() => onOpen(item.id)} />)}</div>
      </section>
      <p className="student-demo-footnote"><CircleAlert size={15} /> Prototype records are illustrative and are not official institutional notices.</p>
    </section>
  )
}

function DiscoverPage({ items, interests, saved, onSave, onOpen }: { items: CampusItem[]; interests: string[]; saved: (id: string) => boolean; onSave: (item: CampusItem) => void; onOpen: (id: string) => void }) {
  const [filters, setFilters] = useState<DiscoverFilters>({ query: "", category: "All", department: "All", timing: "all", sort: "relevant" })
  const departments = useMemo(() => [...new Set(items.map((item) => item.department))], [items])
  const results = useMemo(() => filterCampusItems(items, filters, interests), [filters, items, interests])
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
          {results.map((item) => <CampusItemRow key={item.id} item={item} matches={matchInterests(item, interests)} saved={saved(item.id)} onToggleSaved={() => onSave(item)} onOpen={() => onOpen(item.id)} />)}
        </AnimatePresence>
      </div>
      {results.length === 0 && <div className="student-empty-state"><Filter size={25} /><h2>Nothing matches those filters.</h2><p>Try a broader search or clear the current view.</p><button type="button" onClick={reset}>Reset discovery</button></div>}
    </section>
  )
}

function SavedPage({ email, items: _items, savedItems, saved, onSave, onOpen, onDiscover }: { email: string | null; items: CampusItem[]; savedItems: CampusItem[]; saved: (id: string) => boolean; onSave: (item: CampusItem) => void; onOpen: (id: string) => void; onDiscover: () => void }) {
  const [category, setCategory] = useState<CampusCategory | "All">("All")
  const filtered = savedItems.filter((item) => category === "All" || item.category === category)
  return (
    <section className="student-page">
      <div className="student-page-heading"><div><p className="student-eyebrow">YOUR SHORTLIST · {savedItems.length} SAVED</p><h1>Keep it close.</h1><p>{email ? <>Saved for <strong>{email}</strong> in this browser. Important notices and opportunities, gathered without losing their source context.</> : "Sign in to keep a shortlist under your own account."}</p></div><label className="student-inline-filter"><span>Show</span><select value={category} onChange={(event) => setCategory(event.target.value as CampusCategory | "All")}><option>All</option>{categories.slice(1).map((entry) => <option key={entry}>{entry}</option>)}</select></label></div>
      {!email ? <div className="student-empty-state"><Bookmark size={25} /><h2>You’re not signed in.</h2><p>Saved items are kept per student, so you need to sign in first.</p><button type="button" onClick={() => enterStudentDemo()}>Sign in</button></div> : filtered.length ? <div className="student-saved-list">{filtered.map((item) => <CampusItemRow key={item.id} item={item} saved={saved(item.id)} onToggleSaved={() => onSave(item)} onOpen={() => onOpen(item.id)} />)}</div> : <div className="student-empty-state"><Bookmark size={25} /><h2>Nothing saved yet.</h2><p>Keep important notices and opportunities close.</p><button type="button" onClick={onDiscover}>Discover campus information</button></div>}
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

const RSVP_NOTE = "Your RSVP is saved to your account. The club sees how many students joined, not who."

function JoinedPage({ rsvp, joinedItems, saved, onSave, onOpen, onDiscover }: { rsvp: JoinedEvents; joinedItems: CampusItem[]; saved: (id: string) => boolean; onSave: (item: CampusItem) => void; onOpen: (id: string) => void; onDiscover: () => void }) {
  return (
    <section className="student-page">
      <div className="student-page-heading"><div><p className="student-eyebrow">YOUR RSVPS · {joinedItems.length} JOINED</p><h1>Events you’ve joined.</h1><p>{rsvp.email ? <>RSVPs for <strong>{rsvp.email}</strong>. Saved items stay in Saved.</> : "Sign in to keep RSVPs under your own account."}</p></div></div>
      <p className="student-personalization-note"><CircleAlert size={15} /> {RSVP_NOTE}</p>
      {rsvp.email && rsvp.status === "loading" ? (
        <p className="student-personalization-note" role="status" aria-live="polite">Loading your RSVPs…</p>
      ) : rsvp.email && rsvp.status === "error" ? (
        <div className="student-empty-state"><CircleAlert size={25} /><h2>Your RSVPs couldn’t be loaded.</h2><p role="alert">{rsvp.error}</p><button type="button" onClick={rsvp.reload}>Try again</button></div>
      ) : !rsvp.email ? (
        <div className="student-empty-state"><CalendarDays size={25} /><h2>You’re not signed in.</h2><p>RSVPs are kept per student, so you need to sign in first.</p><button type="button" onClick={() => enterStudentDemo()}>Sign in</button></div>
      ) : joinedItems.length ? (
        <div className="student-saved-list">{joinedItems.map((item) => <CampusItemRow key={item.id} item={item} saved={saved(item.id)} onToggleSaved={() => onSave(item)} onOpen={() => onOpen(item.id)} />)}</div>
      ) : (
        <div className="student-empty-state"><CalendarDays size={25} /><h2>No events joined yet.</h2><p>Open an event and choose Join event. It will be listed here.</p><button type="button" onClick={onDiscover}>Find an event</button></div>
      )}
    </section>
  )
}

function JoinAction({ item, rsvp }: { item: CampusItem; rsvp: JoinedEvents }) {
  const { email, isJoined, join, cancel, pendingId, error, status } = rsvp
  const joined = isJoined(item.id)
  const busy = pendingId === item.id
  // Sample records have no row on the server for an RSVP to point at.
  if (!acceptsRsvps(item)) {
    return (
      <div className="student-join" role="status">
        <strong className="student-join-state is-closed"><CircleAlert size={16} aria-hidden="true" /> RSVPs aren’t open for this sample event</strong>
        <p>This is a sample record that ships with the prototype. Events published by a club can be joined.</p>
      </div>
    )
  }
  const closed = isRegistrationClosed(item)
  const cutoff = registrationCutoff(item)
  const closedReason = item.deadline ? `Registration closed on ${formatDate(cutoff)}.` : "This event has already started."
  return (
    <div className={`student-join ${joined ? "is-joined" : ""}`} role="status">
      {joined ? (
        <>
          <strong className="student-join-state"><Check size={16} aria-hidden="true" /> You’ve joined this event</strong>
          <button type="button" className="student-secondary-action" disabled={busy} onClick={() => void cancel(item.id)}>{busy ? "Cancelling…" : "Cancel RSVP"}</button>
        </>
      ) : closed ? (
        <strong className="student-join-state is-closed"><CircleAlert size={16} aria-hidden="true" /> Registration closed</strong>
      ) : !email ? (
        <button type="button" className="student-primary-action" onClick={() => enterStudentDemo(item.id)}><CalendarDays size={16} aria-hidden="true" /> Sign in to join</button>
      ) : status === "loading" ? (
        <strong className="student-join-state">Checking your RSVP…</strong>
      ) : status === "error" ? (
        <button type="button" className="student-secondary-action" onClick={rsvp.reload}>Try loading your RSVP again</button>
      ) : (
        <button type="button" className="student-primary-action" disabled={busy} onClick={() => void join(item.id)}><CalendarDays size={16} aria-hidden="true" /> {busy ? "Joining…" : "Join event"}</button>
      )}
      {error && <p role="alert"><strong>{error}</strong></p>}
      <p>
        {joined
          ? closed ? `${closedReason} If you cancel, you won’t be able to join again. ${RSVP_NOTE}` : `Joined as ${email}. ${RSVP_NOTE}`
          : closed ? closedReason : !email ? "Joining needs you to be signed in, so the RSVP is recorded under your own account. Nothing is recorded until you sign in." : RSVP_NOTE}
      </p>
    </div>
  )
}

function DetailPage({ loading, rsvp, items, item, saved, onSave, onBack, onOpen }: { loading: boolean; rsvp: JoinedEvents; items: CampusItem[]; item: CampusItem | null; saved: boolean; onSave?: () => void; onBack: () => void; onOpen: (id: string) => void }) {
  // A club update is only known once the server has answered, so don't call it missing before then.
  if (!item && loading) return <section className="student-page"><p className="student-personalization-note" role="status" aria-live="polite">Loading this update…</p></section>
  if (!item) return <section className="student-page student-not-found"><ArrowLeft size={25} /><p className="student-eyebrow">404 · INFORMATION NOT FOUND</p><h1>This record isn’t available.</h1><p>The link may be outdated, or this illustrative item has moved.</p><button type="button" onClick={onBack}>Go back</button></section>
  const related = items.filter((entry) => entry.id !== item.id && (entry.department === item.department || entry.category === item.category)).slice(0, 2)
  return (
    <article className="student-detail-page">
      <button type="button" className="student-back-action" onClick={onBack}><ArrowLeft size={16} /> Back to campus information</button>
      <div className="student-detail-layout">
        <div className="student-detail-main">
          <div className="student-detail-kicker"><span className={categoryColors[item.category]}>{item.category}</span><span>{item.status}</span></div>
          <h1>{item.title}</h1><p className="student-detail-summary">{item.summary}</p>
          {canJoin(item) && <JoinAction item={item} rsvp={rsvp} />}
          <div className="student-detail-actions"><SaveButton item={item} isSaved={saved} onToggle={() => onSave?.()} />{item.sourceUrl && <button type="button" className="student-primary-action" onClick={() => window.open(item.sourceUrl!, "_blank", "noopener,noreferrer")}>Open source <ArrowUpRight size={16} /></button>}</div>
          {item.image && <img className="student-detail-image" src={item.image} alt="" />}
          {item.description && item.description !== item.summary && <p className="student-detail-description">{item.description}</p>}
          <div className="student-detail-facts"><div><span>WHO IT’S FOR</span><strong>{item.audience}</strong></div><div><span>DEPARTMENT</span><strong>{item.department}</strong></div>{hasRegistration(item) ? <><div className="student-fact-date"><span>EVENT DATE</span><strong>{formatDate(item.startDate)}</strong></div><div className="student-fact-date is-deadline"><span>REGISTRATION DEADLINE</span><strong>{formatDate(item.deadline)}</strong></div></> : <div><span>{item.deadline ? "DEADLINE" : "WHEN"}</span><strong>{formatDate(item.deadline ?? item.startDate)}</strong></div>}<div><span>WHERE</span><strong>{item.venue ?? "To be confirmed"}</strong></div></div>
        </div>
        <aside className="student-provenance"><p className="student-eyebrow">SOURCE NOTES</p><h2>Keep the context close.</h2><div className="student-provenance-block"><span>Publisher identity</span><strong>{item.publisher}</strong>{item.sourceType === "Student group" && <a className="student-publisher-link" href={`/explore/club/${clubSlug(item.publisher)}`}>View public club profile <ArrowUpRight size={14} /></a>}</div><div className="student-provenance-block"><span>Original source</span><strong>{item.sourceLabel ?? (item.sourceUrl ? "External source available" : "Source unavailable in this demo.")}</strong></div><div className="student-provenance-block"><span>Review status</span><strong><SourceBadge item={item} /></strong></div><div className="student-provenance-block"><span>Last checked</span><strong>{item.lastVerifiedAt ? formatDate(item.lastVerifiedAt) : "Not recorded"}</strong></div><p className="student-provenance-note">Human review does not make a fictional record an official institutional notice.</p></aside>
      </div>
      {related.length > 0 && <section className="student-related"><div className="student-section-label"><span>MORE TO EXPLORE</span><span className="student-section-rule" /></div>{related.map((entry) => <button type="button" key={entry.id} onClick={() => onOpen(entry.id)}><span>{entry.category}</span><strong>{entry.title}</strong><ArrowUpRight size={16} /></button>)}</section>}
    </article>
  )
}

export default StudentApp
