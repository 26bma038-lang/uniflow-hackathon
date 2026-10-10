import { useEffect, useMemo, useRef, useState } from "react"
import { motion, useReducedMotion } from "motion/react"
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  CircleAlert,
  Compass,
  Sparkles,
  Users,
} from "lucide-react"
import { allowedClubIds, useAuth } from "../auth/AuthProvider"
import { clearPendingDestination, peekPendingDestination, takePendingDestination } from "../demo-session"
import { defaultProfile } from "../student-app/data"
import { interestOptions, type CampusItem, type StudentProfile } from "../student-app/types"
import { clubIdForPublisher, clubSlug, demoClubs, getCurrentClubId, readClubProfile, setCurrentClubId } from "../club/publishing"
import { useCampusItems, useImportedClubs, usePublishedEvents } from "../club/published-events"
import type { PublicClubRow } from "../club/events-api"

type EntryRoute = "roles" | "explore" | "explore-item" | "explore-club" | "student" | "student-interests" | "club"

const STUDENT_EMAIL_DOMAIN = "nith.ac.in"
const STUDENT_ACCESS_KEY = "uniflow-student-access"
const STUDENT_PROFILE_KEY = "uniflow-student-profile"

type StudentAccessDraft = { interests: string[] }

export function routeFromPath(path: string): EntryRoute {
  if (path === "/explore") return "explore"
  if (path.startsWith("/explore/item/")) return "explore-item"
  if (path.startsWith("/explore/club/")) return "explore-club"
  if (path === "/login/student/interests") return "student-interests"
  if (path === "/login/student") return "student"
  if (path === "/login/club") return "club"
  return "roles"
}

function replaceRoute(path: string) {
  window.history.replaceState({}, "", path)
  window.dispatchEvent(new PopStateEvent("popstate"))
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
    interests: Array.isArray(value?.interests) ? value.interests.filter((entry) => interestOptions.includes(entry)) : [],
  }
}

function writeAccessDraft(draft: StudentAccessDraft) {
  localStorage.setItem(STUDENT_ACCESS_KEY, JSON.stringify(draft))
}

// Catches obvious typos before a request is made. Supabase Auth decides who the visitor is.
export function validateEmail(raw: string): string | null {
  const email = raw.trim().toLowerCase()
  if (!email) return "Enter the email address for your account."
  if (/\s/.test(email)) return "Email addresses can’t contain spaces."
  const parts = email.split("@")
  if (parts.length !== 2 || !parts[0] || !parts[1].includes(".")) return `Enter a full email address, like name@${STUDENT_EMAIL_DOMAIN}.`
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
        {back ? <LinkButton to="/get-started" className="access-switch"><ArrowLeft size={15} /> All ways in</LinkButton> : <span className="entry-header-note">Prototype</span>}
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
        <span>Prototype with sample campus content. Not an official NIT Hamirpur service.</span>
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
      description: "Sign in with your account, pick your interests, and get a Today feed shaped around them.",
      points: ["Today & Soon, Discover, and Saved", "Interests you can change later", "Stays on this device"],
      action: "Continue as student",
      note: "Sign in with the account you were given",
    },
    {
      key: "club",
      to: "/login/club",
      icon: <Users size={24} />,
      title: "I’m a club organizer",
      description: "Turn a poster or notice into a structured update, review it, and publish it to the student feed.",
      points: ["Create and review updates", "Publish to the student feed", "See RSVP counts for your events"],
      action: "Open club workspace",
      note: "Sign in required, club members only",
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
      <p className="entry-disclaimer"><CircleAlert size={15} /> Student and club access need an account we’ve set up for you. A club workspace opens only for accounts listed as members of that club. Saved items and interests are still stored in this browser.</p>
    </EntryShell>
  )
}

function formatDay(value: string | null) {
  if (!value) return "Date to be confirmed"
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: value.includes("T") ? undefined : "UTC" }).format(new Date(value))
}

// A value with no time is shown as a date only: no time is made up for it.
function formatDateTime(value: string | null) {
  if (!value) return "Date to be confirmed"
  if (!value.includes("T")) return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }).format(new Date(value))
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(value))
}

function formatSpan(entry: CampusItem) {
  if (!entry.startDate) return entry.isImported ? "No date given by the source" : "Date to be confirmed"
  if (!entry.endDate || entry.endDate.slice(0, 10) === entry.startDate.slice(0, 10)) return formatDateTime(entry.startDate)
  return `${formatDateTime(entry.startDate)} to ${formatDateTime(entry.endDate)}`
}

function originNote(entry: CampusItem) {
  if (entry.isImported) return `Imported from ${entry.publisher}. ${entry.publisher} does not post on UniFlow, and this is not an endorsement.`
  if (entry.isClubPublication) return "Published by a club through UniFlow, not an official institutional notice"
  return "Sample data for the prototype, not an official notice"
}

// Events and opportunities run on startDate; any deadline on them is a registration cutoff.
function hasRegistration(entry: CampusItem) {
  return Boolean(entry.startDate && entry.deadline) && (entry.category === "Event" || entry.category === "Opportunity")
}

function PublicLoadNote({ status, message }: { status: "loading" | "ready" | "error"; message: string | null }) {
  if (status === "loading") return <p className="access-hint" role="status" aria-live="polite">Loading club updates…</p>
  if (status === "error") return <p className="access-error" role="alert"><CircleAlert size={15} /> {message} Club updates may be missing; the sample records below are still shown.</p>
  return null
}

function PublicItemDetail() {
  const id = decodeURIComponent(window.location.pathname.split("/")[3] ?? "")
  // Club updates first, then the sample records they do not replace.
  const campus = useCampusItems(true)
  const item = useMemo(() => campus.items.find((entry) => entry.id === id) ?? null, [campus.items, id])
  const backLink = <LinkButton to="/explore" className="access-switch"><ArrowLeft size={15} /> Back to Explore</LinkButton>
  if (!item && campus.status === "loading") {
    return (
      <EntryShell back eyebrow="Public view" title="Loading this update…" description="Checking the latest club updates.">
        <p className="access-detail-back">{backLink}</p>
      </EntryShell>
    )
  }
  if (!item) {
    return (
      <EntryShell back eyebrow="Public view" title="This update isn’t available." description={campus.status === "error" ? "Club updates couldn’t be loaded just now. Try again in a moment." : "The link may be outdated, or the update is no longer published."}>
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
          <p className="access-sample-tag">{originNote(item)}</p>
          {item.description && item.description !== item.summary && <p className="access-detail-description">{item.description}</p>}
          <dl className="access-detail-facts">
            {hasRegistration(item) ? (
              <>
                <div className="is-date"><dt>Event date</dt><dd>{formatSpan(item)}</dd></div>
                <div className="is-date is-deadline"><dt>Registration deadline</dt><dd>{formatDateTime(item.deadline)}</dd></div>
              </>
            ) : (
              <div className={item.deadline ? "is-date is-deadline" : "is-date"}><dt>{item.deadline ? "Deadline" : "When"}</dt><dd>{item.deadline ? formatDateTime(item.deadline) : formatSpan(item)}</dd></div>
            )}
            <div><dt>Where</dt><dd>{item.venue ?? (item.isImported ? "Not stated by the source" : "To be confirmed")}</dd></div>
            <div><dt>Who it’s for</dt><dd>{item.audience}</dd></div>
          </dl>
        </article>
        <aside className="access-detail-source" aria-label="Source notes">
          <h2>Source notes</h2>
          <dl>
            <div><dt>Publisher</dt><dd>{item.sourceType === "Student group" ? <LinkButton to={`/explore/club/${clubSlug(item.publisher)}`}>{item.publisher}</LinkButton> : item.publisher}</dd></div>
            <div><dt>Source</dt><dd>{item.isImported && item.sourceUrl ? <>{item.sourceLabel}. <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Open original source</a></> : item.sourceLabel ?? (item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Open original source</a> : `${item.sourceType}, no link available in this demo`)}</dd></div>
            {item.registrationUrl && item.registrationUrl !== item.sourceUrl && <div><dt>Apply or register</dt><dd><a href={item.registrationUrl} target="_blank" rel="noopener noreferrer">Open application link</a></dd></div>}
            <div><dt>Review status</dt><dd>{item.isImported ? "Checked against the original source" : item.isClubPublication ? "Reviewed by the publishing club" : item.reviewStatus}</dd></div>
            <div><dt>Last checked</dt><dd>{item.lastVerifiedAt ? formatDateTime(item.lastVerifiedAt) : "Not recorded"}</dd></div>
          </dl>
          <p>{item.isImported ? "UniFlow is independent of NIT Hamirpur. Rely on the original source for anything that matters." : "Review in this prototype does not make a record an official institutional notice."}</p>
        </aside>
      </div>
      <div className="access-detail-invite">
        <div>
          <h2>Want this in your own feed?</h2>
          <p>Signing in as a student adds Today & Soon, Discover, and Saved, shaped by your interests.</p>
        </div>
        <LinkButton to="/login/student" className="entry-primary-action">Sign in as a student <ArrowUpRight size={17} /></LinkButton>
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
              <small>{entry.category} from {entry.publisher}{entry.isImported ? " (imported)" : entry.isClubPublication ? (/^\s*test\b/i.test(entry.title) ? " (test record)" : " (club update)") : " (sample)"}</small>
            </span>
            <ArrowUpRight size={17} aria-hidden="true" />
          </a>
        </li>
      ))}
    </ul>
  )
}

// clubId is set when the publisher is one of the demo clubs that can be selected in the workspace.
// imported is set for a club copied from public sources into the database.
type PublicClub = { name: string; slug: string; updates: CampusItem[]; clubId: string | null; imported?: PublicClubRow }

// Sample and UniFlow clubs are the student-group publishers of the public items. Imported
// clubs come from the clubs table, with any updates that belong to them.
function readPublicClubs(items: CampusItem[], importedClubs: PublicClubRow[] = []): PublicClub[] {
  const groups = new Map<string, CampusItem[]>()
  items.filter((entry) => entry.sourceType === "Student group").forEach((entry) => groups.set(entry.publisher, [...(groups.get(entry.publisher) ?? []), entry]))
  const derived = [...groups.entries()].map(([name, updates]) => ({ name, slug: clubSlug(name), updates, clubId: clubIdForPublisher(name) }))
  const imported = importedClubs
    .filter((club) => !groups.has(club.name))
    .map((club) => ({ name: club.name, slug: club.id, updates: items.filter((entry) => entry.clubId === club.id), clubId: null, imported: club }))
  return [...imported, ...derived]
}

function ImportedClubProfile({ club, backLink }: { club: PublicClub & { imported: PublicClubRow }; backLink: React.ReactNode }) {
  const { imported } = club
  const checked = imported.sourceCheckedOn ? formatDateTime(imported.sourceCheckedOn) : null
  return (
    <EntryShell back eyebrow="Public view · Club" title={club.name} description={imported.description || "No description was imported for this club."}>
      <p className="access-detail-back">{backLink}</p>
      <p className="access-sample-tag access-club-status">
        Imported from NIT Hamirpur’s public sources{checked ? `, checked on ${checked}` : ""}. This club does not run this page or post on UniFlow, and UniFlow is not endorsed by NIT Hamirpur. No logo is shown because none was provided with permission to reuse it.
      </p>
      <dl className="access-detail-facts access-club-facts">
        {imported.category && <div><dt>Category</dt><dd>{imported.category}</dd></div>}
        {imported.website && <div><dt>Official page</dt><dd><a href={imported.website} target="_blank" rel="noopener noreferrer">{new URL(imported.website).hostname}</a></dd></div>}
        <div><dt>Source</dt><dd><a href={imported.sourceUrl} target="_blank" rel="noopener noreferrer">Open the source this entry is based on</a></dd></div>
      </dl>
      <div className="access-sections">
        <section className="access-section" aria-labelledby="club-updates-title">
          <div className="access-section-heading">
            <h2 id="club-updates-title">Imported updates</h2>
            <span className="access-sample-tag">{club.updates.length === 1 ? "1 update" : `${club.updates.length} updates`}</span>
          </div>
          {club.updates.length ? <PublicUpdateList items={club.updates} /> : <p className="access-hint">No current updates were imported for this club. Past recruitment notices are not shown as open opportunities.</p>}
        </section>
      </div>
    </EntryShell>
  )
}

function PublicClubProfile() {
  const slug = decodeURIComponent(window.location.pathname.split("/")[3] ?? "")
  const campus = useCampusItems(true)
  const importedClubs = useImportedClubs()
  const club = useMemo(() => readPublicClubs(campus.items, importedClubs).find((entry) => entry.slug === slug) ?? null, [campus.items, importedClubs, slug])
  const backLink = <LinkButton to="/explore" className="access-switch"><ArrowLeft size={15} /> Back to Explore</LinkButton>
  if (!club && campus.status === "loading") {
    return (
      <EntryShell back eyebrow="Public view" title="Loading this club…" description="Checking the latest club updates.">
        <p className="access-detail-back">{backLink}</p>
      </EntryShell>
    )
  }
  if (!club) {
    return (
      <EntryShell back eyebrow="Public view" title="This club isn’t listed." description="The link may be outdated, or the club has no public updates yet.">
        <p className="access-detail-back">{backLink}</p>
      </EntryShell>
    )
  }
  if (club.imported) return <ImportedClubProfile club={{ ...club, imported: club.imported }} backLink={backLink} />
  const profile = club.clubId ? readClubProfile(club.clubId) : null
  const publishedCount = club.updates.filter((entry) => entry.isClubPublication).length
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
        {club.clubId ? " Updates marked “club update” were published by a signed-in member of this club. Its profile text is stored in this browser." : ""}
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
              {publishedCount > 0 ? `, ${publishedCount} published by the club` : ", sample data"}
            </span>
          </div>
          <PublicUpdateList items={club.updates} />
          <p className="access-hint">Updates without the “club update” note are sample records that ship with the prototype.</p>
        </section>
      </div>
    </EntryShell>
  )
}

function ExplorePublic() {
  const campus = useCampusItems(true)
  const items = campus.items
  const importedClubs = useImportedClubs()
  const clubs = useMemo(() => readPublicClubs(items, importedClubs), [items, importedClubs])
  const places = useMemo(() => {
    const venues = new Map<string, CampusItem[]>()
    // The guide is built from sample venues only; imported records are not mixed into it.
    items.filter((entry) => entry.venue && !entry.isImported).forEach((entry) => venues.set(entry.venue!, [...(venues.get(entry.venue!) ?? []), entry]))
    return [...venues.entries()]
  }, [items])
  return (
    <EntryShell
      back
      eyebrow="Public view"
      title="Explore the campus."
      description="Campus information anyone can read, without an account. Each record says where it comes from: imported from a public NIT Hamirpur source, published by a club member, or a sample that ships with the prototype."
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
        <PublicLoadNote status={campus.status} message={campus.message} />
        <PublicUpdateList items={items} />
        <p className="access-hint">Want to save items or filter by interest? <LinkButton to="/login/student">Continue as a student</LinkButton>.</p>
      </section>

      <section id="club-directory" className="access-section" aria-labelledby="club-directory-title">
        <div className="access-section-heading">
          <h2 id="club-directory-title">Clubs</h2>
          <span className="access-sample-tag">{importedClubs.length ? `${importedClubs.length} imported from public sources, the rest are samples` : "Sample directory"}</span>
        </div>
        <ul className="access-club-list">
          {clubs.map((club) => (
            <li key={club.slug}>
              <a href={`/explore/club/${club.slug}`} onClick={(event) => { event.preventDefault(); navigate(`/explore/club/${club.slug}`) }}>
                <span className="access-club-mark" aria-hidden="true">{club.name.split(" ").map((word) => word[0]).slice(0, 2).join("")}</span>
                <strong>{club.name}</strong>
                <span>{club.updates.length === 1 ? "1 update listed here" : `${club.updates.length} updates listed here`}</span>
                <small>{club.imported ? "Imported from NIT Hamirpur public sources" : "Sample club"}{club.updates[0] ? ` · Latest: ${club.updates[0].title}` : ""}</small>
              </a>
            </li>
          ))}
        </ul>
        <p className="access-hint">Clubs marked “Imported” were copied from NIT Hamirpur’s public pages and notices; they do not run these entries. Clubs marked “Sample club” are examples from the prototype data. Run a club? <LinkButton to="/login/club">Sign in to the club workspace</LinkButton>.</p>
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
  return <p className="access-return-notice"><CircleAlert size={15} /> After signing in you’ll go back to the item you were viewing. Nothing is joined or saved for you.</p>
}

function SessionChecking({ label = "Checking your session…" }: { label?: string }) {
  return <p className="access-identity" role="status" aria-live="polite">{label}</p>
}

// Email and password sign-in for an account that already exists. There is no sign-up here:
// accounts are created by the UniFlow team.
function SignInForm({ idPrefix, pill, submitLabel, links }: { idPrefix: string; pill: React.ReactNode; submitLabel: string; links: React.ReactNode }) {
  const auth = useAuth()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [emailError, setEmailError] = useState<string | null>(null)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const emailRef = useRef<HTMLInputElement>(null)
  const passwordRef = useRef<HTMLInputElement>(null)
  const mounted = useRef(true)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    setFormError(null)
    const emailProblem = validateEmail(email)
    if (emailProblem) {
      setEmailError(emailProblem)
      emailRef.current?.focus()
      return
    }
    if (!password) {
      setPasswordError("Enter your password.")
      passwordRef.current?.focus()
      return
    }
    setBusy(true)
    const problem = await auth.signIn(email, password)
    // On success the auth state changes and the page moves on by itself.
    if (!mounted.current) return
    setBusy(false)
    if (problem) {
      setFormError(problem)
      setPassword("")
      passwordRef.current?.focus()
    }
  }

  return (
    <form className="access-panel" onSubmit={submit} noValidate aria-busy={busy}>
      {pill}
      <label htmlFor={`${idPrefix}-email`} className="access-label">Email</label>
      <input
        id={`${idPrefix}-email`}
        ref={emailRef}
        className="access-input"
        type="email"
        inputMode="email"
        autoComplete="username"
        autoCapitalize="none"
        spellCheck={false}
        placeholder={`name@${STUDENT_EMAIL_DOMAIN}`}
        value={email}
        readOnly={busy}
        aria-invalid={Boolean(emailError)}
        aria-describedby={emailError ? `${idPrefix}-email-error` : undefined}
        onChange={(event) => { setEmail(event.target.value); if (emailError) setEmailError(null) }}
      />
      {emailError && <p id={`${idPrefix}-email-error`} className="access-error" role="alert"><CircleAlert size={15} /> {emailError}</p>}
      <label htmlFor={`${idPrefix}-password`} className="access-label">Password</label>
      <input
        id={`${idPrefix}-password`}
        ref={passwordRef}
        className="access-input"
        type="password"
        autoComplete="current-password"
        value={password}
        readOnly={busy}
        aria-invalid={Boolean(passwordError)}
        aria-describedby={passwordError ? `${idPrefix}-password-error` : undefined}
        onChange={(event) => { setPassword(event.target.value); if (passwordError) setPasswordError(null) }}
      />
      {passwordError && <p id={`${idPrefix}-password-error`} className="access-error" role="alert"><CircleAlert size={15} /> {passwordError}</p>}
      {formError && <p className="access-error" role="alert"><CircleAlert size={15} /> {formError}</p>}
      {!auth.configured && <p className="access-error" role="alert"><CircleAlert size={15} /> Sign-in isn’t set up in this build, so no account can be checked.</p>}
      <button type="submit" className="entry-primary-action" disabled={busy}>{busy ? "Signing in…" : submitLabel} {!busy && <ArrowUpRight size={17} />}</button>
      <p className="access-notice"><CircleAlert size={15} /> Use the account we set up for you. There is no public sign-up; ask the UniFlow team if you need an account or a new password.</p>
      <div className="entry-login-links">{links}</div>
    </form>
  )
}

function SignedInAs({ email }: { email: string | null }) {
  const auth = useAuth()
  return <p className="access-identity">Signed in as <strong>{email}</strong> <a href="/get-started" onClick={(event) => { event.preventDefault(); void auth.signOut() }}>Sign out</a></p>
}

function StudentEmailStep() {
  const auth = useAuth()
  // Already signed in, or just signed in: carry on to interests.
  useEffect(() => {
    if (auth.status === "signed-in") replaceRoute("/login/student/interests")
  }, [auth.status])
  return (
    <EntryShell
      back
      eyebrow="Student access · step 1 of 2"
      title="Sign in with your college account."
      description="Use the email and password we gave you. Next, you’ll pick what you care about."
    >
      <ReturnNotice />
      <div className="access-panel-layout">
        {auth.status === "signed-out" ? (
          <SignInForm
            idPrefix="student"
            pill={<div className="entry-role-pill"><Sparkles size={15} /> Student sign-in</div>}
            submitLabel="Sign in"
            links={<><LinkButton to="/explore">Explore without an account</LinkButton><LinkButton to="/login/club">I’m a club organizer instead</LinkButton></>}
          />
        ) : (
          <div className="access-panel"><SessionChecking /></div>
        )}
        <StudentPreview />
      </div>
    </EntryShell>
  )
}

function StudentInterestsStep() {
  const auth = useAuth()
  const [draft, setDraft] = useState<StudentAccessDraft>(() => {
    const stored = readAccessDraft()
    if (stored.interests.length) return stored
    const existing = readJson<StudentProfile>(STUDENT_PROFILE_KEY)
    return { interests: Array.isArray(existing?.interests) ? existing.interests.filter((entry) => interestOptions.includes(entry)) : [] }
  })
  const [error, setError] = useState<string | null>(null)

  // This step is only for a signed-in user. Without a session it goes back to sign-in.
  useEffect(() => {
    if (auth.status === "signed-out") replaceRoute("/login/student")
  }, [auth.status])

  const toggle = (interest: string) => {
    const interests = draft.interests.includes(interest) ? draft.interests.filter((entry) => entry !== interest) : [...draft.interests, interest]
    const next = { ...draft, interests }
    setDraft(next)
    writeAccessDraft(next)
    if (interests.length) setError(null)
  }

  const finish = (event: React.FormEvent) => {
    event.preventDefault()
    if (!auth.email) return
    if (!draft.interests.length) {
      setError("Pick at least one interest so Today has something to work with.")
      return
    }
    const existing = readJson<StudentProfile>(STUDENT_PROFILE_KEY)
    const displayName = existing?.displayName && existing.displayName !== defaultProfile.displayName ? existing.displayName : nameFromEmail(auth.email)
    localStorage.setItem(STUDENT_PROFILE_KEY, JSON.stringify({ ...defaultProfile, ...existing, displayName, interests: draft.interests }))
    // Back to the item that asked for sign-in, if there was one. Nothing is joined or saved here.
    navigate(takePendingDestination() ?? "/app/today")
  }

  if (auth.status !== "signed-in") {
    return (
      <EntryShell back eyebrow="Student access · step 2 of 2" title="What do you care about?" description="Your picks shape Today & Soon. You can change them later in Profile.">
        <div className="access-panel-layout"><div className="access-panel"><SessionChecking /></div><StudentPreview /></div>
      </EntryShell>
    )
  }
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
          <SignedInAs email={auth.email} />
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
          <p className="access-notice"><CircleAlert size={15} /> Your account is verified by sign-in. Your interests and saved items are still kept in this browser only.</p>
        </form>
        <StudentPreview />
      </div>
    </EntryShell>
  )
}

function ClubAccess() {
  const auth = useAuth()
  const { memberships } = auth
  // Only clubs this account is a member of, as read from club_members. Nothing typed or
  // picked on this page can add one.
  const allowed = useMemo(() => { const ids = allowedClubIds(memberships, demoClubs.map((club) => club.id)); return demoClubs.filter((entry) => ids.includes(entry.id)) }, [memberships])
  const [pickedId, setPickedId] = useState(getCurrentClubId)
  const club = allowed.find((entry) => entry.id === pickedId) ?? allowed[0] ?? null
  const publishedEvents = usePublishedEvents()
  const published = useMemo(() => (club ? publishedEvents.items.filter((entry) => entry.publisher === club.name) : []), [club, publishedEvents.items])
  const otherLinks = <><LinkButton to="/login/student">I’m a student instead</LinkButton><LinkButton to="/explore">Explore without an account</LinkButton></>

  let panel: React.ReactNode
  if (auth.status === "signed-out") {
    panel = (
      <SignInForm
        idPrefix="club"
        pill={<div className="entry-role-pill"><Users size={15} /> Club organizer sign-in</div>}
        submitLabel="Sign in"
        links={otherLinks}
      />
    )
  } else if (auth.status === "loading" || memberships.status === "loading" || memberships.status === "idle") {
    panel = <div className="access-panel"><SessionChecking label={auth.status === "loading" ? "Checking your session…" : "Checking your club membership…"} /></div>
  } else if (memberships.status === "error") {
    panel = (
      <div className="access-panel">
        <div className="entry-role-pill"><Users size={15} /> Club workspace</div>
        <h2 className="access-panel-title">We couldn’t confirm club access.</h2>
        <SignedInAs email={auth.email} />
        <p className="access-error" role="alert"><CircleAlert size={15} /> {memberships.message}</p>
        <p className="access-help">The workspace stays closed until membership can be confirmed.</p>
        <button type="button" className="entry-primary-action" onClick={auth.reloadMemberships}>Check again <ArrowUpRight size={17} /></button>
        <div className="entry-login-links"><LinkButton to="/app/today">Go to the student app</LinkButton><LinkButton to="/explore">Explore</LinkButton></div>
      </div>
    )
  } else if (!club) {
    panel = (
      <div className="access-panel">
        <div className="entry-role-pill"><Users size={15} /> Club workspace</div>
        <h2 className="access-panel-title">This account isn’t a member of a club.</h2>
        <SignedInAs email={auth.email} />
        <p className="access-error" role="alert"><CircleAlert size={15} /> No club workspace is open to this account.</p>
        <p className="access-help">Club access is granted by the UniFlow team, per club. If you organize a club, ask them to add this account, then check again.</p>
        <button type="button" className="entry-primary-action" onClick={auth.reloadMemberships}>Check again <ArrowUpRight size={17} /></button>
        <div className="entry-login-links"><LinkButton to="/app/today">Go to the student app</LinkButton><LinkButton to="/explore">Explore</LinkButton></div>
      </div>
    )
  } else {
    panel = (
      <div className="access-panel">
        <div className="entry-role-pill"><Users size={15} /> Club workspace</div>
        <h2 className="access-panel-title">Enter as {club.name}</h2>
        <SignedInAs email={auth.email} />
        <p className="access-help">{allowed.length === 1 ? "This account is a member of one club." : "This account is a member of these clubs. You can switch between them inside the workspace."}</p>
        <fieldset className="access-club-choice">
          <legend className="access-label">Your clubs</legend>
          {allowed.map((entry) => (
            <label key={entry.id}>
              <input type="radio" name="member-club" value={entry.id} checked={entry.id === club.id} onChange={() => setPickedId(entry.id)} />
              <span>{entry.name}</span>
            </label>
          ))}
        </fieldset>
        <p className="access-identity">{publishedEvents.status === "loading" ? "Checking published updates…" : publishedEvents.status === "error" ? "Published updates couldn’t be loaded just now." : published.length === 0 ? "No published updates yet." : published.length === 1 ? "1 published update." : `${published.length} published updates.`}</p>
        <button type="button" className="entry-primary-action" onClick={() => { setCurrentClubId(club.id); navigate("/club/overview") }}>Open {club.name}’s workspace <ArrowUpRight size={17} /></button>
        <p className="access-notice"><CircleAlert size={15} /> Your membership is checked on the server, and so is every draft and publication you save.</p>
        <div className="entry-login-links">{otherLinks}</div>
      </div>
    )
  }

  return (
    <EntryShell
      back
      eyebrow="Club organizer access"
      title="Bring your campus updates to life."
      description="Prepare, review, and publish information for your campus community."
    >
      <div className="access-panel-layout">
        {panel}
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
    </div>
  )
}
