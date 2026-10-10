import { useEffect, useMemo, useRef, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CircleAlert,
  Compass,
  FileText,
  Home,
  Sparkles,
  Users,
} from "lucide-react"
import { clearPendingDestination, enterDemo, exitDemo, peekPendingDestination, takePendingDestination } from "../demo-session"
import { campusItems, defaultProfile } from "../student-app/data"
import { interestOptions, type CampusItem, type StudentProfile } from "../student-app/types"
import { clubIdForPublisher, clubSlug, demoClubs, getCurrentClubId, getDemoClub, getPublishedCampusItems, publishedClubRecords, readClubProfile, setCurrentClubId } from "../club/publishing"

type EntryRoute = "roles" | "explore" | "explore-item" | "explore-club" | "student" | "student-interests" | "club" | "club-overview"

const STUDENT_EMAIL_DOMAIN = "nith.ac.in"
const STUDENT_ACCESS_KEY = "uniflow-student-access"
const STUDENT_PROFILE_KEY = "uniflow-student-profile"

type StudentAccessDraft = { email: string; interests: string[] }

export function routeFromPath(path: string): EntryRoute {
  if (path === "/explore") return "explore"
  if (path.startsWith("/explore/item/")) return "explore-item"
  if (path.startsWith("/explore/club/")) return "explore-club"
  if (path === "/login/student/interests") return "student-interests"
  if (path === "/login/student") return "student"
  if (path === "/login/club") return "club"
  if (path === "/club/overview") return "club-overview"
  return "roles"
}

function navigate(path: string) {
  window.history.pushState({}, "", path)
  window.dispatchEvent(new PopStateEvent("popstate"))
  window.scrollTo({ top: 0, behavior: "smooth" })
}

function readJson<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null") as T | null
  } catch {
    return null
  }
}

function readAccessDraft(): StudentAccessDraft {
  const value = readJson<Partial<StudentAccessDraft>>(STUDENT_ACCESS_KEY)
  return {
    email: typeof value?.email === "string" ? value.email : "",
    interests: Array.isArray(value?.interests) ? value.interests.filter((entry) => interestOptions.includes(entry)) : [],
  }
}

function writeAccessDraft(draft: StudentAccessDraft) {
  localStorage.setItem(STUDENT_ACCESS_KEY, JSON.stringify(draft))
}

// Format check only. Nothing here proves the address exists or belongs to the visitor.
export function validateStudentEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase()
  if (!email) return "Enter your college email address."
  if (/\s/.test(email)) return "Email addresses can’t contain spaces."
  const parts = email.split("@")
  if (parts.length !== 2 || !parts[0] || !parts[1]) return "Enter a full email address, like name@nith.ac.in."
  if (parts[1] !== STUDENT_EMAIL_DOMAIN) return `Use your @${STUDENT_EMAIL_DOMAIN} address. Other domains aren’t accepted.`
  if (!/^[a-z0-9._%+-]+$/.test(parts[0])) return "The part before @ has characters an email address can’t use."
  return null
}

function nameFromEmail(email: string) {
  const local = email.split("@")[0]
  const word = local.split(/[._-]/)[0]
  return /^[a-z]+$/.test(word) ? word[0].toUpperCase() + word.slice(1) : local
}

function LinkButton({ to, children, className }: { to: string; children: React.ReactNode; className?: string }) {
  return <a href={to} className={className} onClick={(event) => { event.preventDefault(); navigate(to) }}>{children}</a>
}

function EntryShell({
  children,
  eyebrow,
  title,
  description,
  back,
}: {
  children: React.ReactNode
  eyebrow: string
  title: React.ReactNode
  description: string
  back?: boolean
}) {
  const reducedMotion = useReducedMotion() ?? false
  return (
    <div className="entry-page access-page">
      <header className="entry-header">
        <LinkButton to="/" className="entry-logo">
          <span className="entry-logo-mark">U</span>
          UniFlow
        </LinkButton>
        {back ? <LinkButton to="/get-started" className="access-switch"><ArrowLeft size={15} /> All ways in</LinkButton> : <span className="entry-header-note">Local demo</span>}
      </header>
      <main className="entry-main">
        <motion.div
          className="entry-heading"
          initial={reducedMotion ? false : { y: 14 }}
          animate={{ y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.35 }}
        >
          <p className="entry-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </motion.div>
        {children}
      </main>
      <footer className="entry-footer">
        <span>Frontend-only prototype. No real sign-in, and not an official NIT Hamirpur service.</span>
        <LinkButton to="/">Return to UniFlow <ArrowUpRight size={15} /></LinkButton>
      </footer>
    </div>
  )
}

function AccessSelection() {
  const paths = [
    {
      key: "explore",
      to: "/explore",
      icon: <Compass size={24} />,
      title: "Explore publicly",
      description: "Browse campus information, clubs, and a simple campus guide. No account needed.",
      points: ["Notices, events, and deadlines", "Sample club directory", "Illustrative campus guide"],
      action: "Start exploring",
      note: "Open to everyone",
    },
    {
      key: "student",
      to: "/login/student",
      icon: <Sparkles size={24} />,
      title: "I’m a student",
      description: "Enter your college email, pick your interests, and get a Today feed shaped around them.",
      points: ["Today & Soon, Discover, and Saved", "Interests you can change later", "Stays on this device"],
      action: "Continue as student",
      note: "Demo access with an @nith.ac.in email",
    },
    {
      key: "club",
      to: "/login/club",
      icon: <Users size={24} />,
      title: "I’m a club organizer",
      description: "Turn a poster or notice into a structured update, review it, and publish it to the student feed.",
      points: ["Create and review updates", "Publish to the demo student feed", "See your demo publications"],
      action: "Open club workspace",
      note: "Demo access, permissions not verified",
    },
  ]
  return (
    <EntryShell
      eyebrow="Welcome to UniFlow"
      title="How would you like to come in?"
      description="Three ways into campus life. Pick one now; you can switch at any time."
    >
      <ul className="access-grid">
        {paths.map((path) => (
          <li key={path.key}>
            <a href={path.to} className={`access-card access-card-${path.key}`} onClick={(event) => { event.preventDefault(); navigate(path.to) }}>
              <span className="access-card-icon">{path.icon}</span>
              <span className="access-card-title">{path.title}</span>
              <span className="access-card-description">{path.description}</span>
              <span className="access-card-points">
                {path.points.map((point) => <span key={point}><Check size={14} />{point}</span>)}
              </span>
              <span className="access-card-action">{path.action} <ArrowUpRight size={17} /></span>
              <span className="access-card-note">{path.note}</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="entry-disclaimer"><CircleAlert size={15} /> Student and club access are local demos. Nothing here verifies identity or publisher permissions.</p>
    </EntryShell>
  )
}

function formatDay(value: string | null) {
  if (!value) return "Date to be confirmed"
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" }).format(new Date(value))
}

function formatDateTime(value: string | null) {
  if (!value) return "Date to be confirmed"
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value))
}

// Events and opportunities run on startDate; any deadline on them is a registration cutoff.
function hasRegistration(entry: CampusItem) {
  return Boolean(entry.startDate && entry.deadline) && (entry.category === "Event" || entry.category === "Opportunity")
}

// Local demo publications first, then the sample records they do not replace.
function readPublicItems() {
  const published = getPublishedCampusItems()
  const key = (entry: CampusItem) => `${entry.title.toLowerCase()}::${entry.publisher.toLowerCase()}`
  const ids = new Set(published.map((entry) => entry.id))
  const keys = new Set(published.map(key))
  return [...published, ...campusItems.filter((entry) => !ids.has(entry.id) && !keys.has(key(entry)))]
}

function PublicItemDetail() {
  const id = decodeURIComponent(window.location.pathname.split("/")[3] ?? "")
  const item = useMemo(() => readPublicItems().find((entry) => entry.id === id) ?? null, [id])
  const backLink = <LinkButton to="/explore" className="access-switch"><ArrowLeft size={15} /> Back to Explore</LinkButton>
  if (!item) {
    return (
      <EntryShell back eyebrow="Public view" title="This update isn’t available." description="The link may be outdated, or the update was published in a different browser.">
        <p className="access-detail-back">{backLink}</p>
      </EntryShell>
    )
  }
  return (
    <EntryShell
      back
      eyebrow={`Public view · ${item.category}`}
      title={item.title}
      description={item.summary}
    >
      <p className="access-detail-back">{backLink}</p>
      <div className="access-detail-layout">
        <article className="access-detail-main">
          <p className="access-sample-tag">{item.isDemoPublication ? "Local demo publication, saved in this browser only" : "Sample data for the prototype, not an official notice"}</p>
          {item.description && item.description !== item.summary && <p className="access-detail-description">{item.description}</p>}
          <dl className="access-detail-facts">
            {hasRegistration(item) ? (
              <>
                <div className="is-date"><dt>Event date</dt><dd>{formatDateTime(item.startDate)}</dd></div>
                <div className="is-date is-deadline"><dt>Registration deadline</dt><dd>{formatDateTime(item.deadline)}</dd></div>
              </>
            ) : (
              <div className={item.deadline ? "is-date is-deadline" : "is-date"}><dt>{item.deadline ? "Deadline" : "When"}</dt><dd>{formatDateTime(item.deadline ?? item.startDate)}</dd></div>
            )}
            <div><dt>Where</dt><dd>{item.venue ?? "To be confirmed"}</dd></div>
            <div><dt>Who it’s for</dt><dd>{item.audience}</dd></div>
          </dl>
        </article>
        <aside className="access-detail-source" aria-label="Source notes">
          <h2>Source notes</h2>
          <dl>
            <div><dt>Publisher</dt><dd>{item.sourceType === "Student group" ? <LinkButton to={`/explore/club/${clubSlug(item.publisher)}`}>{item.publisher}</LinkButton> : item.publisher}</dd></div>
            <div><dt>Source</dt><dd>{item.sourceLabel ?? (item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Open original source</a> : `${item.sourceType}, no link available in this demo`)}</dd></div>
            <div><dt>Review status</dt><dd>{item.isDemoPublication ? "Reviewed in the local club demo" : item.reviewStatus}</dd></div>
            <div><dt>Last checked</dt><dd>{item.lastVerifiedAt ? formatDateTime(item.lastVerifiedAt) : "Not recorded"}</dd></div>
          </dl>
          <p>Review in this prototype does not make a record an official institutional notice.</p>
        </aside>
      </div>
      <div className="access-detail-invite">
        <div>
          <h2>Want this in your own feed?</h2>
          <p>The student demo adds Today & Soon, Discover, and Saved, shaped by your interests.</p>
        </div>
        <LinkButton to="/login/student" className="entry-primary-action">Enter the student demo <ArrowUpRight size={17} /></LinkButton>
      </div>
    </EntryShell>
  )
}

function PublicUpdateList({ items }: { items: CampusItem[] }) {
  return (
    <ul className="access-info-list">
      {items.map((entry) => (
        <li key={entry.id}>
          <a href={`/explore/item/${encodeURIComponent(entry.id)}`} onClick={(event) => { event.preventDefault(); navigate(`/explore/item/${encodeURIComponent(entry.id)}`) }}>
            <span className="access-info-date">{formatDay(hasRegistration(entry) || !entry.deadline ? entry.startDate : entry.deadline)}</span>
            <span className="access-info-body">
              <strong>{entry.title}</strong>
              <span>{entry.summary}</span>
              <small>{entry.category} from {entry.publisher}{entry.isDemoPublication ? " (published in this demo)" : ""}</small>
            </span>
            <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  )
}

// clubId is set when the publisher is one of the demo clubs that can be selected in the workspace.
type PublicClub = { name: string; slug: string; updates: CampusItem[]; clubId: string | null }

// Clubs are the student-group publishers in the public items; nothing is stored separately for them.
function readPublicClubs(items: CampusItem[]): PublicClub[] {
  const groups = new Map<string, CampusItem[]>()
  items.filter((entry) => entry.sourceType === "Student group").forEach((entry) => groups.set(entry.publisher, [...(groups.get(entry.publisher) ?? []), entry]))
  return [...groups.entries()].map(([name, updates]) => ({ name, slug: clubSlug(name), updates, clubId: clubIdForPublisher(name) }))
}

function PublicClubProfile() {
  const slug = decodeURIComponent(window.location.pathname.split("/")[3] ?? "")
  const club = useMemo(() => readPublicClubs(readPublicItems()).find((entry) => entry.slug === slug) ?? null, [slug])
  const backLink = <LinkButton to="/explore" className="access-switch"><ArrowLeft size={15} /> Back to Explore</LinkButton>
  if (!club) {
    return (
      <EntryShell back eyebrow="Public view" title="This club isn’t listed." description="The link may be outdated, or the club has no public updates in this browser.">
        <p className="access-detail-back">{backLink}</p>
      </EntryShell>
    )
  }
  const profile = club.clubId ? readClubProfile(club.clubId) : null
  const demoCount = club.updates.filter((entry) => entry.isDemoPublication).length
  return (
    <EntryShell
      back
      eyebrow="Public view · Club"
      title={club.name}
      description={profile?.description || "A sample student group from the prototype data. No profile text has been published for it."}
    >
      <p className="access-detail-back">{backLink}</p>
      <p className="access-sample-tag access-club-status">
        Sample club from the prototype data.
        {club.clubId ? " Its profile text and any updates marked “published in this demo” come from the demo club workspace in this browser." : ""}
        {" "}Not a verified NIT Hamirpur club.
      </p>
      {profile && (profile.category || profile.departments) && (
        <dl className="access-detail-facts access-club-facts">
          {profile.category && <div><dt>Category</dt><dd>{profile.category}</dd></div>}
          {profile.departments && <div><dt>Departments</dt><dd>{profile.departments}</dd></div>}
        </dl>
      )}
      <div className="access-sections">
        <section className="access-section" aria-labelledby="club-updates-title">
          <div className="access-section-heading">
            <h2 id="club-updates-title">Published updates</h2>
            <span className="access-sample-tag">
              {club.updates.length === 1 ? "1 update" : `${club.updates.length} updates`}
              {demoCount > 0 ? `, ${demoCount} published in this browser’s demo` : ", sample data"}
            </span>
          </div>
          <PublicUpdateList items={club.updates} />
          <p className="access-hint">Updates without the “published in this demo” note are sample records that ship with the prototype.</p>
        </section>
      </div>
    </EntryShell>
  )
}

function ExplorePublic() {
  const items = useMemo(readPublicItems, [])
  const clubs = useMemo(() => readPublicClubs(items), [items])
  const places = useMemo(() => {
    const venues = new Map<string, CampusItem[]>()
    items.filter((entry) => entry.venue).forEach((entry) => venues.set(entry.venue!, [...(venues.get(entry.venue!) ?? []), entry]))
    return [...venues.entries()]
  }, [items])
  return (
    <EntryShell
      back
      eyebrow="Public view"
      title="Explore the campus."
      description="Campus information anyone can read, without an account. Everything on this page is sample content for the prototype."
    >
      <nav className="access-jump" aria-label="On this page">
        <a href="#campus-information">Campus information</a>
        <a href="#club-directory">Clubs</a>
        <a href="#campus-guide">Campus guide</a>
      </nav>

      <div className="access-sections">
      <section id="campus-information" className="access-section" aria-labelledby="campus-information-title">
        <div className="access-section-heading">
          <h2 id="campus-information-title">Campus information</h2>
          <LinkButton to="/events">Open the events feed <ArrowUpRight size={15} /></LinkButton>
        </div>
        <PublicUpdateList items={items} />
        <p className="access-hint">Want to save items or filter by interest? <LinkButton to="/login/student">Continue as a student</LinkButton>.</p>
      </section>

      <section id="club-directory" className="access-section" aria-labelledby="club-directory-title">
        <div className="access-section-heading">
          <h2 id="club-directory-title">Clubs</h2>
          <span className="access-sample-tag">Sample directory</span>
        </div>
        <ul className="access-club-list">
          {clubs.map((club) => (
            <li key={club.slug}>
              <a href={`/explore/club/${club.slug}`} onClick={(event) => { event.preventDefault(); navigate(`/explore/club/${club.slug}`) }}>
                <span className="access-club-mark" aria-hidden="true">{club.name.split(" ").map((word) => word[0]).slice(0, 2).join("")}</span>
                <strong>{club.name}</strong>
                <span>{club.updates.length === 1 ? "1 update listed here" : `${club.updates.length} updates listed here`}</span>
                <small>Sample club · Latest: {club.updates[0].title}</small>
              </a>
            </li>
          ))}
        </ul>
        <p className="access-hint">These are example student groups from the prototype data, not a list of real NIT Hamirpur clubs. Run a club? <LinkButton to="/login/club">Open the club workspace</LinkButton>.</p>
      </section>

      <section id="campus-guide" className="access-section" aria-labelledby="campus-guide-title">
        <div className="access-section-heading">
          <h2 id="campus-guide-title">Campus guide</h2>
          <span className="access-sample-tag">Illustrative, not an official map</span>
        </div>
        <ul className="access-place-list">
          {places.map(([venue, entries]) => (
            <li key={venue}>
              <strong>{venue}</strong>
              <span>{entries.map((entry) => `${entry.title} (${formatDay(entry.startDate ?? entry.deadline)})`).join(", ")}</span>
            </li>
          ))}
        </ul>
        <p className="access-hint">Place names come from the sample records above. They are not real NIT Hamirpur locations, and no campus map is connected yet.</p>
      </section>
      </div>
    </EntryShell>
  )
}

function ReturnNotice() {
  if (!peekPendingDestination()) return null
  return <p className="access-return-notice"><CircleAlert size={15} /> After this you’ll go back to the item you were viewing. Nothing is joined or saved for you.</p>
}

function StudentEmailStep() {
  const [email, setEmail] = useState(() => readAccessDraft().email)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const problem = validateStudentEmail(email)
    if (problem) {
      setError(problem)
      inputRef.current?.focus()
      return
    }
    writeAccessDraft({ ...readAccessDraft(), email: email.trim().toLowerCase() })
    navigate("/login/student/interests")
  }
  return (
    <EntryShell
      back
      eyebrow="Student access · step 1 of 2"
      title="Start with your college email."
      description="We use it to label your demo session. Next, you’ll pick what you care about."
    >
      <ReturnNotice />
      <div className="access-panel-layout">
        <form className="access-panel" onSubmit={submit} noValidate>
          <div className="entry-role-pill"><Sparkles size={15} /> Student demo</div>
          <label htmlFor="student-email" className="access-label">College email</label>
          <input
            id="student-email"
            ref={inputRef}
            className="access-input"
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
            placeholder={`name@${STUDENT_EMAIL_DOMAIN}`}
            value={email}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? "student-email-error student-email-help" : "student-email-help"}
            onChange={(event) => { setEmail(event.target.value); if (error) setError(null) }}
          />
          {error && <p id="student-email-error" className="access-error" role="alert"><CircleAlert size={15} /> {error}</p>}
          <p id="student-email-help" className="access-help">Only @{STUDENT_EMAIL_DOMAIN} addresses are accepted.</p>
          <button type="submit" className="entry-primary-action">Continue <ArrowUpRight size={17} /></button>
          <p className="access-notice"><CircleAlert size={15} /> This is not a real sign-in. We check the format only: no email is sent, and nothing confirms the address is yours until a backend is connected. It is saved in this browser.</p>
          <div className="entry-login-links">
            <LinkButton to="/explore">Explore without an account</LinkButton>
            <LinkButton to="/login/club">I’m a club organizer instead</LinkButton>
          </div>
        </form>
        <StudentPreview />
      </div>
    </EntryShell>
  )
}

function StudentInterestsStep() {
  const [draft, setDraft] = useState(readAccessDraft)
  const [error, setError] = useState<string | null>(null)
  const hasEmail = validateStudentEmail(draft.email) === null

  useEffect(() => {
    if (!hasEmail) {
      window.history.replaceState({}, "", "/login/student")
      window.dispatchEvent(new PopStateEvent("popstate"))
    }
  }, [hasEmail])

  const toggle = (interest: string) => {
    const interests = draft.interests.includes(interest) ? draft.interests.filter((entry) => entry !== interest) : [...draft.interests, interest]
    const next = { ...draft, interests }
    setDraft(next)
    writeAccessDraft(next)
    if (interests.length) setError(null)
  }

  const finish = (event: React.FormEvent) => {
    event.preventDefault()
    if (!draft.interests.length) {
      setError("Pick at least one interest so Today has something to work with.")
      return
    }
    const existing = readJson<StudentProfile>(STUDENT_PROFILE_KEY)
    const displayName = existing?.displayName && existing.displayName !== defaultProfile.displayName ? existing.displayName : nameFromEmail(draft.email)
    localStorage.setItem(STUDENT_PROFILE_KEY, JSON.stringify({ ...defaultProfile, ...existing, displayName, interests: draft.interests }))
    enterDemo("student", displayName, draft.email)
    // Back to the item that asked for entry, if there was one. Nothing is joined or saved here.
    navigate(takePendingDestination() ?? "/app/today")
  }

  if (!hasEmail) return null
  return (
    <EntryShell
      back
      eyebrow="Student access · step 2 of 2"
      title="What do you care about?"
      description="Your picks shape Today & Soon. You can change them later in Profile."
    >
      <ReturnNotice />
      <div className="access-panel-layout">
        <form className="access-panel" onSubmit={finish} noValidate>
          <p className="access-identity">Continuing in demo mode as <strong>{draft.email}</strong> <LinkButton to="/login/student">Change</LinkButton></p>
          <fieldset className="access-interests" aria-describedby={error ? "student-interests-error" : undefined}>
            <legend className="access-label">Interests</legend>
            <div className="student-interest-list">
              {interestOptions.map((interest) => {
                const selected = draft.interests.includes(interest)
                return <button key={interest} type="button" className={selected ? "is-selected" : ""} aria-pressed={selected} onClick={() => toggle(interest)}>{selected && <Check size={14} />}{interest}</button>
              })}
            </div>
          </fieldset>
          {error && <p id="student-interests-error" className="access-error" role="alert"><CircleAlert size={15} /> {error}</p>}
          <button type="submit" className="entry-primary-action">Open Today & Soon <ArrowUpRight size={17} /></button>
          <p className="access-notice"><CircleAlert size={15} /> Your email and interests are saved in this browser only. This is a demo session, not a verified account.</p>
        </form>
        <StudentPreview />
      </div>
    </EntryShell>
  )
}

function ClubAccess() {
  const [clubId, setClubId] = useState(getCurrentClubId)
  const club = getDemoClub(clubId)
  const published = useMemo(() => publishedClubRecords().filter((record) => record.clubId === clubId), [clubId])
  return (
    <EntryShell
      back
      eyebrow="Club organizer access"
      title="Bring your campus updates to life."
      description="Prepare, review, and publish information for your campus community."
    >
      <div className="access-panel-layout">
        <div className="access-panel">
          <div className="entry-role-pill"><Users size={15} /> Club demo</div>
          <h2 className="access-panel-title">Enter as {club.name}</h2>
          <p className="access-help">Pick one of the sample clubs. Each has its own profile, drafts, and published updates in this browser, and you can switch again inside the workspace.</p>
          <fieldset className="access-club-choice">
            <legend className="access-label">Demo club identity</legend>
            {demoClubs.map((entry) => (
              <label key={entry.id}>
                <input type="radio" name="demo-club" value={entry.id} checked={entry.id === clubId} onChange={() => setClubId(entry.id)} />
                <span>{entry.name}</span>
              </label>
            ))}
          </fieldset>
          <p className="access-identity">{published.length === 0 ? "No demo publications in this browser yet." : published.length === 1 ? "1 demo publication saved in this browser." : `${published.length} demo publications saved in this browser.`}</p>
          <button type="button" className="entry-primary-action" onClick={() => { setCurrentClubId(club.id); enterDemo("club", club.name); navigate("/club/overview") }}>Open {club.name}’s workspace <ArrowUpRight size={17} /></button>
          <p className="access-notice"><CircleAlert size={15} /> Demo identity switching, not verified organizer permission. UniFlow does not check that you run this club, anyone using this browser can pick any of them, and published updates stay in this browser.</p>
          <div className="entry-login-links">
            <LinkButton to="/login/student">I’m a student instead</LinkButton>
            <LinkButton to="/explore">Explore without an account</LinkButton>
          </div>
        </div>
        <PublisherPreview />
      </div>
    </EntryShell>
  )
}

function StudentPreview() {
  return (
    <div className="access-preview" aria-hidden="true">
      <span className="entry-student-preview">
        <span className="entry-preview-topline"><b>Today & Soon</b><small>Sample preview</small></span>
        <span className="entry-preview-feature">
          <small>NEEDS ATTENTION</small>
          <b>Student support scholarship</b>
          <span>Deadline · 19 Oct, 5:00 PM</span>
        </span>
        <span className="entry-preview-rows">
          <span><b>22 OCT</b><span>Campus Open Mic</span><i>Source checked</i></span>
          <span><b>25 OCT</b><span>Research poster deadline</span><i>Review status visible</i></span>
        </span>
      </span>
    </div>
  )
}

function PublisherPreview({ compact = false }: { compact?: boolean }) {
  const preview = (
    <span className={`entry-publisher-preview ${compact ? "is-compact" : ""}`}>
      <span className="entry-preview-topline"><b>Source → structured draft</b><small>Illustrative only</small></span>
      <span className="entry-publisher-columns">
        <span className="entry-mini-document"><small>WORKSHOP BRIEF</small><b>Build Your<br />First Web App</b><span>18 OCT · 4 PM</span></span>
        <span className="entry-mini-fields"><span><small>TITLE</small><b>Build Your First Web App</b></span><span><small>VENUE</small><b>Innovation Lab</b></span><span><small>STATUS</small><b>Needs human review</b></span></span>
      </span>
    </span>
  )
  return compact ? preview : <div className="access-preview access-preview-club" aria-hidden="true">{preview}</div>
}

function ClubOverview() {
  return (
    <EntryShell
      eyebrow="CLUB WORKSPACE · DEMO"
      title={<>Welcome back,<br />Campus Code Collective.</>}
      description="A starting workspace for club organizers. Milestone 4 will grow this into the complete publishing application."
    >
      <div className="club-overview-grid">
        <section className="club-welcome-panel">
          <div className="entry-role-pill"><Users size={15} /> Demo club identity</div>
          <h2>Make the next update easier to trust.</h2>
          <p>Prepare a source document, review the structured details, and keep the original context close to every campus update.</p>
          <button type="button" className="club-primary-action" onClick={() => navigate("/poster-to-event")}>Create campus update <ArrowUpRight size={17} /></button>
          <div className="club-status"><span /> Prototype workspace active</div>
        </section>
        <section className="club-actions-panel">
          <p className="entry-eyebrow">YOUR NEXT MOVE</p>
          <div className="club-workflow-preview"><PublisherPreview compact /></div>
          <button type="button" onClick={() => navigate("/poster-to-event")}><FileText size={20} /><span><strong>Try poster extraction</strong><small>Reuse the existing local publishing workflow</small></span><ArrowUpRight size={17} /></button>
          <button type="button" onClick={() => navigate("/app/today")}><Home size={20} /><span><strong>Preview the student view</strong><small>See how a published update reaches students</small></span><ArrowUpRight size={17} /></button>
          <button type="button" onClick={() => { exitDemo(); navigate("/get-started") }}><ArrowLeft size={18} /><span><strong>Switch demo role</strong><small>Return to the role selection screen</small></span><ArrowUpRight size={17} /></button>
        </section>
      </div>
    </EntryShell>
  )
}

export default function EntryExperience({ route }: { route: EntryRoute }) {
  const [currentRoute, setCurrentRoute] = useState(route)
  // A pending return only applies while the visitor is in student entry. Choosing the public
  // or club path, or going back to the access page, drops it.
  useEffect(() => {
    if (currentRoute !== "student" && currentRoute !== "student-interests") clearPendingDestination()
  }, [currentRoute])
  useEffect(() => {
    const sync = () => setCurrentRoute(routeFromPath(window.location.pathname))
    window.addEventListener("popstate", sync)
    return () => window.removeEventListener("popstate", sync)
  }, [])

  return (
    <div key={currentRoute}>
        {currentRoute === "roles" && <AccessSelection />}
        {currentRoute === "explore" && <ExplorePublic />}
        {currentRoute === "explore-item" && <PublicItemDetail />}
        {currentRoute === "explore-club" && <PublicClubProfile />}
        {currentRoute === "student" && <StudentEmailStep />}
        {currentRoute === "student-interests" && <StudentInterestsStep />}
        {currentRoute === "club" && <ClubAccess />}
        {currentRoute === "club-overview" && <ClubOverview />}
    </div>
  )
}
