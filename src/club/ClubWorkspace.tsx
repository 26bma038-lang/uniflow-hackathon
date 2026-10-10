import { useEffect, useMemo, useState, useRef } from "react"
import { motion, useReducedMotion } from "motion/react"
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  FileImage,
  FileText,
  Menu,
  Pencil,
  Plus,
  Search,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react"
import { allowedClubIds, useAuth } from "../auth/AuthProvider"
import {
  blankRecord,
  CLUB_ACTIVITY_KEY,
  demoClubs,
  getCurrentClubId,
  getDemoClub,
  readClubProfile,
  setCurrentClubId,
  writeClubProfile,
  toCampusItem,
  sampleRecordValues,
} from "./publishing"
import type { ClubProfile, ClubRecord, DemoClub } from "./publishing"
import { canJoin } from "../student-app/useJoinedEvents"
import { deleteEvent, fetchRsvpCounts, listClubEvents, saveEvent, validateRecord } from "./events-api"
import { refreshPublishedEvents } from "./published-events"
import PosterExtraction from "../ai/components/PosterExtraction"
import ExtractionFlags from "../ai/components/ExtractionFlags"
import type { ExtractionFlag, ExtractPosterResponse } from "../ai/contracts"
import type { EventDraftField } from "../components/poster-to-event/types"

type ClubRoute = "overview" | "drafts" | "create" | "review" | "published" | "profile"
type ClubLocation = { route: ClubRoute; id?: string }
// Activity saved before clubs could be switched has no clubId and belongs to the default club.
type Activity = { id: string; label: string; detail: string; createdAt: string; clubId?: string }
type Profile = ClubProfile
// What the model returned for a record in this session: which fields it filled and what a
// person still has to check. Kept in memory only; it is not part of the saved record.
type Extraction = { fields: EventDraftField[]; flags: ExtractionFlag[]; model: string }
// The draft fields the create form has inputs for, with the labels it uses.
const CREATE_FORM_FIELDS: EventDraftField[] = ["title", "category", "description", "startDate", "startTime", "venue", "eligibility", "registrationDeadline", "registrationUrl"]
const DRAFT_FIELD_LABELS: Partial<Record<EventDraftField, string>> = { startDate: "Event date", startTime: "Start time", eligibility: "Audience", registrationDeadline: "Registration deadline" }

function read<T>(key: string, fallback: T): T {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null")
    return value ?? fallback
  } catch {
    return fallback
  }
}

function locationFromPath(): ClubLocation {
  const parts = window.location.pathname.split("/").filter(Boolean)
  const route = parts[1]
  if (route === "review" && parts[2]) return { route: "review", id: parts[2] }
  if (route === "create" && parts[2]) return { route: "create", id: parts[2] }
  return {
    route: ["overview", "drafts", "create", "published", "profile"].includes(route)
      ? (route as ClubRoute)
      : "overview",
  }
}

function go(path: string) {
  window.history.pushState({}, "", path)
  window.dispatchEvent(new PopStateEvent("popstate"))
  window.scrollTo({ top: 0, behavior: "smooth" })
}

function readActivity(clubId: string) {
  return read<Activity[]>(CLUB_ACTIVITY_KEY, []).filter((entry) => getDemoClub(entry.clubId).id === clubId)
}

function recordActivity(clubId: string, label: string, detail: string) {
  const all = read<Activity[]>(CLUB_ACTIVITY_KEY, [])
  const mine = [{ id: crypto.randomUUID(), label, detail, createdAt: new Date().toISOString(), clubId }, ...all.filter((entry) => getDemoClub(entry.clubId).id === clubId)].slice(0, 8)
  localStorage.setItem(CLUB_ACTIVITY_KEY, JSON.stringify([...mine, ...all.filter((entry) => getDemoClub(entry.clubId).id !== clubId)]))
}

function documentLabel(record: ClubRecord) {
  return record.source === "Sample document" ? "Sample workshop brief" : record.sourceName
}

function DraftRow({ record, onOpen, onDelete }: { record: ClubRecord; onOpen: () => void; onDelete: () => void }) {
  return (
    <motion.article layout className="club-draft-row">
      <div className="club-draft-type"><FileText size={18} /><span>{record.category || "Uncategorised"}</span></div>
      <button type="button" className="club-draft-main" onClick={onOpen}>
        <strong>{record.title || "Untitled campus update"}</strong>
        <span>{documentLabel(record)} · edited {new Date(record.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
      </button>
      <span className={`club-draft-status ${record.status !== "draft" ? "is-review" : ""}`}>{record.status.replace(/_/g, " ")}</span>
      <button type="button" className="club-icon-button" aria-label={`Resume ${record.title || "draft"}`} onClick={onOpen}><Pencil size={16} /></button>
      <button type="button" className="club-icon-button club-danger" aria-label={`Delete ${record.title || "draft"}`} onClick={onDelete}><Trash2 size={16} /></button>
    </motion.article>
  )
}

function ClubNav({ location, mobileOpen, setMobileOpen, club, clubs, email, onSwitchClub, onSignOut }: { location: ClubLocation; mobileOpen: boolean; setMobileOpen: (value: boolean) => void; club: DemoClub; clubs: DemoClub[]; email: string | null; onSwitchClub: (clubId: string) => void; onSignOut: () => void }) {
  const links: Array<[ClubRoute, string]> = [["overview", "Overview"], ["drafts", "Drafts"], ["create", "Create update"], ["published", "Published"], ["profile", "Club profile"]]
  return (
    <>
      {mobileOpen && <button className="club-mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`club-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <a className="club-brand" href="/club/overview" onClick={(event) => { event.preventDefault(); go("/club/overview") }}><span>U</span>UniFlow</a>
        <p className="club-sidebar-kicker">CLUB WORKSPACE · DEMO</p>
        <nav aria-label="Club workspace">
          {links.map(([key, label]) => <a key={key} href={`/club/${key}`} className={location.route === key ? "is-active" : ""} onClick={(event) => { event.preventDefault(); setMobileOpen(false); go(`/club/${key}`) }}><i />{label}{key === "create" && <Plus size={14} />}</a>)}
        </nav>
        <div className="club-sidebar-bottom"><strong>{club.name}</strong><span>Signed in as {email} · club member</span>{clubs.length > 1 && <label className="club-identity-switch"><span>Switch club</span><select value={club.id} onChange={(event) => { setMobileOpen(false); onSwitchClub(event.target.value) }}>{clubs.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label>}<span>Only clubs this account is a member of are listed.</span><button type="button" onClick={onSignOut}>Sign out</button></div>
      </aside>
    </>
  )
}

function WorkspaceHeader({ location, onMenu, club, sync }: { location: ClubLocation; onMenu: () => void; club: DemoClub; sync: string }) {
  const labels: Record<ClubRoute, string> = { overview: "Overview", drafts: "Drafts", create: "Create update", review: "Human review", published: "Published", profile: "Club profile" }
  return <header className="club-topbar"><button className="club-mobile-menu" aria-label="Open club navigation" onClick={onMenu}><Menu size={20} /></button><div><span>Club workspace / {club.name}</span><strong>{labels[location.route]}</strong></div><span className="club-topbar-status" role="status" aria-live="polite"><i /> {sync}</span></header>
}

function Workflow({ active = 1 }: { active?: number }) {
  return <div className="club-workflow"><div className="club-workflow-line" /><div className={active >= 1 ? "is-active" : ""}><b>01</b><strong>Draft</strong><span>Shape the update</span></div><div className={active >= 2 ? "is-active" : ""}><b>02</b><strong>Extract</strong><span>Structure the source</span></div><div className={active >= 3 ? "is-active" : ""}><b>03</b><strong>Review</strong><span>Check every detail</span></div><div className={active >= 4 ? "is-active" : ""}><b>04</b><strong>Publish</strong><span>Visible to students</span></div></div>
}

// Events this club published, with RSVP counts from club_rsvp_counts() on the server.
// counts is null while they load or when they could not be read.
type RsvpCounts = Map<string, number> | null

function usePublishedEventRsvps(records: ClubRecord[], counts: RsvpCounts) {
  return useMemo(() => {
    return records
      .filter((record) => record.status === "published_demo" && canJoin(toCampusItem(record)))
      .map((record) => ({ id: record.id, title: record.title, count: counts ? counts.get(record.id) ?? 0 : null }))
  }, [records, counts])
}

function rsvpLabel(count: number | null) {
  if (count === null) return "RSVP count unavailable"
  return `${count} ${count === 1 ? "RSVP" : "RSVPs"}`
}

const RSVP_DISCLAIMER = "RSVP numbers count signed-in students who joined. They show how many, never who, and are not attendance."

function Overview({ records, counts, activity, onCreate, onOpen }: { records: ClubRecord[]; counts: RsvpCounts; activity: Activity[]; onCreate: () => void; onOpen: (id: string) => void }) {
  const drafts = records.filter((record) => record.status !== "published_demo").slice(0, 3)
  const eventRsvps = usePublishedEventRsvps(records, counts)
  return <section className="club-page">
    <div className="club-page-heading"><div><p className="club-eyebrow">CLUB WORKSPACE · 18 OCT 2026</p><h1>Your club,<br />your campus.</h1><p>Prepare updates, review the source, and publish only when a human is ready to stand behind the details.</p></div><button className="club-primary-action" type="button" onClick={onCreate}><Plus size={17} /> Create campus update</button></div>
    <div className="club-overview-grid-new">
      <div className="club-overview-main">
        <div className="club-section-title"><span>01</span><h2>Work in progress</h2><button type="button" onClick={() => go("/club/drafts")}>View all <ArrowUpRight size={14} /></button></div>
        {drafts.length ? drafts.map((record) => <DraftRow key={record.id} record={record} onOpen={() => onOpen(record.id)} onDelete={() => {}} />) : <div className="club-empty-inline"><FileText size={20} /><strong>No drafts yet.</strong><span>Start with a source document or create an update manually.</span></div>}
      </div>
      <aside className="club-overview-side"><p className="club-eyebrow">PREPARATION FLOW</p><h2>From source<br />to signal.</h2><Workflow /><button type="button" onClick={onCreate}>Start a new update <ArrowUpRight size={15} /></button></aside>
    </div>
    <div className="club-activity-strip"><div className="club-section-title"><span>02</span><h2>Recent activity</h2></div>{activity.length ? <div className="club-activity-list">{activity.slice(0, 3).map((item) => <div key={item.id}><span>{item.label}</span><strong>{item.detail}</strong><time>{new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</time></div>)}</div> : <p className="club-activity-empty">Your draft and profile actions in this browser will appear here.</p>}</div>
    {eventRsvps.length > 0 && <div className="club-activity-strip club-rsvp-strip"><div className="club-section-title"><span>03</span><h2>RSVPs</h2><button type="button" onClick={() => go("/club/published")}>View published <ArrowUpRight size={14} /></button></div><div className="club-activity-list">{eventRsvps.slice(0, 3).map((entry) => <div key={entry.id}><span>Event</span><strong>{entry.title}</strong><time>{rsvpLabel(entry.count)}</time></div>)}</div><p className="club-rsvp-note">{RSVP_DISCLAIMER}</p></div>}
    <div className="club-quick-grid"><button type="button" onClick={onCreate}><Plus size={18} /><span><b>Create update</b><small>Start manually or from a document</small></span></button><button type="button" onClick={onCreate}><FileImage size={18} /><span><b>Use the sample brief</b><small>See simulated extraction</small></span></button><button type="button" onClick={() => go("/app/today")}><Users size={18} /><span><b>Preview student experience</b><small>See published updates</small></span></button></div>
  </section>
}

function SourceDocument({ preview, sample, highlight }: { preview: string | null; sample: boolean; highlight?: string }) {
  return <div className="club-document-preview">
    <div className="club-document-toolbar"><span>{sample ? "WORKSHOP BRIEF · EXAMPLE" : "SOURCE DOCUMENT"}</span><span>{sample ? "JPG · illustrative" : "Preview only"}</span></div>
    {preview ? <img src={preview} alt="Uploaded source document preview" /> : <div className="club-paper">
      <span className="club-paper-mark">CC</span><span className="club-paper-kicker">CAMPUS CODE COLLECTIVE</span>
      <h3 className={highlight === "title" ? "is-highlighted" : ""}>Build Your<br />First Web App</h3>
      <p>A beginner-friendly evening for students to form teams, explore an idea, and leave with a small working prototype.</p>
      <div className="club-paper-facts"><span className={highlight === "date" ? "is-highlighted" : ""}>18 OCT 2026<br /><b>DATE</b></span><span>4:00—6:00 PM<br /><b>TIME</b></span><span className={highlight === "venue" ? "is-highlighted" : ""}>Innovation Lab<br /><b>VENUE</b></span></div>
      <small>OPEN TO ALL INTERESTED STUDENTS · SOURCE REMAINS VISIBLE DURING REVIEW</small>
    </div>}
  </div>
}

function CreatePage({ clubId, initial, onSaved, onReview, onExtraction }: { clubId: string; initial?: ClubRecord; onSaved: (record: ClubRecord) => void; onReview: (record: ClubRecord, preview: string | null) => void; onExtraction: (recordId: string, extraction: Extraction | null) => void }) {
  const [form, setForm] = useState<ClubRecord>(() => initial ?? blankRecord(clubId))
  const [mode, setMode] = useState<"sample" | "upload" | "manual">(initial?.source === "Uploaded document" ? "upload" : initial?.source === "Sample document" ? "sample" : "manual")
  const [preview, setPreview] = useState<string | null>(null)
  // The chosen image itself, kept so it can be sent for extraction if the member asks.
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState("")
  const update = (field: keyof ClubRecord, value: string) => setForm((current) => ({ ...current, [field]: value }))
  // Fills the form with what the model read. Nothing is saved or published by this.
  const applyExtraction = (result: ExtractPosterResponse) => {
    setForm((current) => ({ ...current, ...result.values, source: "Uploaded document", sourceName: file?.name || "Uploaded document" }))
    setMode("upload")
    setError("")
    onExtraction(form.id, { fields: result.extractedFields, flags: result.flags, model: result.model })
  }
  const chooseFile = (file: File | undefined) => {
    if (!file) return
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setError("Use a PNG, JPEG, or WebP source document."); return }
    if (file.size > 10 * 1024 * 1024) { setError("That file is larger than 10 MB. Choose a smaller source document."); return }
    const reader = new FileReader()
    reader.onload = () => { setPreview(String(reader.result)); setFile(file); setMode("upload"); setError("") }
    reader.readAsDataURL(file)
  }
  const applySample = () => { onExtraction(form.id, null); setForm((current) => ({ ...current, ...sampleRecordValues, department: "Computer Science", source: "Sample document", sourceName: "WORKSHOP.JPG" })); setMode("sample"); setError("") }
  const save = (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.title.trim() || !form.category.trim() || !form.description.trim()) { setError("Add a title, category, and description before saving."); return }
    const source: ClubRecord["source"] = mode === "sample" ? "Sample document" : mode === "upload" ? "Uploaded document" : "Manual entry"
    const next: ClubRecord = { ...form, source, sourceName: mode === "sample" ? "WORKSHOP.JPG" : form.sourceName || "Manual entry", updatedAt: new Date().toISOString() }
    const problem = validateRecord(next)
    if (problem) { setError(problem); return }
    onSaved(next)
    setError("")
  }
  const fields: Array<[keyof ClubRecord, string, string]> = [["title", "Title", "e.g. Build Your First Web App"], ["category", "Category", "Opportunity, notice, event..."], ["description", "Description", "What should students know?"], ["startDate", "Event date", "2026-10-18"], ["startTime", "Start time", "16:00"], ["venue", "Venue", "Innovation Lab"], ["eligibility", "Audience", "All interested students"], ["department", "Department", "Computer Science"], ["registrationDeadline", "Registration deadline", "Optional"], ["registrationUrl", "Registration link", "Optional, https://…"]]
  return <section className="club-page club-create-page">
    <div className="club-page-heading compact"><div><p className="club-eyebrow">CREATE CAMPUS UPDATE</p><h1>Start with the source.</h1><p>Keep the original document close while you turn it into a structured, editable campus record.</p></div></div>
    <div className="club-create-layout">
      <div className="club-create-source"><div className="club-section-title"><span>01</span><h2>Source document</h2></div><SourceDocument preview={preview} sample={mode === "sample"} /><div className="club-source-actions"><label className="club-upload-button"><Upload size={16} /> Choose image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => chooseFile(event.target.files?.[0])} /></label><button type="button" onClick={applySample}>Use sample brief</button>{preview && <button type="button" onClick={() => { setPreview(null); setFile(null); setMode("manual") }}><X size={15} /> Remove</button>}</div><p className="club-source-note">JPEG, PNG, or WebP · 10 MB maximum. The image is not stored: it is only sent for extraction if you ask, and previews must be reattached after refresh.</p><PosterExtraction clubId={clubId} file={file} onExtracted={applyExtraction} fields={CREATE_FORM_FIELDS} fieldLabels={DRAFT_FIELD_LABELS} /></div>
      <form className="club-update-form club-create-form" onSubmit={save}><div className="club-section-title"><span>02</span><h2>Structured update</h2></div><div className="club-form-grid">{fields.map(([field, label, placeholder]) => <label key={field} className={field === "description" ? "is-wide" : ""}>{label}{field === "description" ? <textarea value={String(form[field] ?? "")} placeholder={placeholder} onChange={(event) => update(field, event.target.value)} /> : <input type={field === "startDate" ? "date" : field === "startTime" ? "time" : "text"} value={String(form[field] ?? "")} placeholder={placeholder} onChange={(event) => update(field, event.target.value)} />}</label>)}</div>{error && <p className="club-form-error" role="alert"><X size={15} />{error}</p>}<div className="club-form-footer"><span>Nothing publishes from this screen.</span><div><button className="club-secondary-action" type="button" onClick={() => { const problem = validateRecord(form); if (problem) { setError(problem); return } onReview({ ...form, source: mode === "sample" ? "Sample document" : mode === "upload" ? "Uploaded document" : "Manual entry" }, preview) }}>Continue to review <ChevronRight size={15} /></button><button className="club-primary-action" type="submit"><Check size={16} /> Save draft</button></div></div></form>
    </div>
  </section>
}

function ReviewPage({ record, preview, extraction, publishing, onChange, onConfirm, onPublish }: { record: ClubRecord; preview: string | null; extraction: Extraction | null; publishing: boolean; onChange: (record: ClubRecord) => void; onConfirm: () => void; onPublish: () => void }) {
  const reducedMotion = useReducedMotion() ?? false
  const [revealed, setRevealed] = useState(reducedMotion ? 4 : 0)
  const [error, setError] = useState("")
  useEffect(() => {
    if (reducedMotion) return
    const timers = [300, 800, 1300, 1800].map((delay, index) => window.setTimeout(() => setRevealed(index + 1), delay))
    return () => timers.forEach(window.clearTimeout)
  }, [reducedMotion])
  const update = (field: keyof ClubRecord, value: string) => onChange({ ...record, [field]: value, status: "needs_review", reviewConfirmed: false })
  const requiredMissing = [record.title, record.category, record.description].some((value) => !value.trim())
  const attentionMissing = !record.startDate || !record.venue
  const canConfirm = !requiredMissing && !attentionMissing
  const published = record.status === "published_demo"
  const confirmed = record.reviewConfirmed && (record.status === "ready_for_approval" || published)
  const status = record.status === "published_demo" ? "Published" : confirmed ? "Ready for approval" : "Needs attention"
  // Where the values came from decides what this screen may claim about them.
  const sample = record.source === "Sample document"
  const origin = extraction ? "AI EXTRACTION" : sample ? "SIMULATED AI EXTRACTION" : "MANUAL ENTRY"
  const originNote = extraction
    ? `These values were read from your image by an AI model (${extraction.model}). They are suggestions: compare each one with the source before confirming.`
    : sample
      ? "Every value remains editable. This sample is simulated: no document was sent to an AI service."
      : "Every value remains editable. These details were typed in by hand."
  const fieldTag = (field: string, index: number) => extraction ? (extraction.fields.includes(field as EventDraftField) ? "AI read" : null) : sample && index < 3 ? (index < revealed ? "Extracted" : "Queued") : null
  const handleConfirm = () => { if (!canConfirm) { setError("Resolve the highlighted required fields before confirming review."); return } const problem = validateRecord(record); if (problem) { setError(problem); return } onConfirm(); setError("") }
  return <section className="club-page club-review-page">
    <div className="club-review-heading"><div><button type="button" className="club-back-action" onClick={() => go("/club/drafts")}><ArrowLeft size={15} /> Back to drafts</button><p className="club-eyebrow">{origin} · HUMAN REVIEW</p><h1>Check the source,<br />then make it yours.</h1><p>{originNote}</p></div><span className={`club-review-status ${confirmed ? "is-ready" : ""}`}><i />{status}</span></div>
    <Workflow active={confirmed ? 4 : 3} />
    <div className="club-review-layout"><div><SourceDocument preview={preview} sample={record.source === "Sample document"} highlight={revealed === 1 ? "title" : revealed === 2 ? "date" : revealed === 3 ? "venue" : undefined} /><div className="club-source-note">Source: {record.sourceName || "Manual entry"} · publisher: {record.publisher} · illustrative document</div></div><div className="club-review-fields"><div className="club-review-field-head"><div><span>{extraction || sample ? "EXTRACTED INFORMATION" : "ENTERED INFORMATION"}</span><h2>Structured campus update</h2></div><span className="club-extraction-badge"><span /> {extraction ? "AI extraction · unverified" : sample ? "Simulated AI extraction" : "Manual entry"}</span></div>{extraction && <ExtractionFlags flags={extraction.flags} fieldLabels={DRAFT_FIELD_LABELS} />}{[["title", "Title"], ["category", "Category"], ["description", "Description"], ["startDate", "Event date"], ["venue", "Venue"], ["eligibility", "Audience"], ["department", "Department"], ["registrationUrl", "Registration link"]].map(([field, label], index) => <label key={field} className={`${field === "description" ? "is-wide " : ""}${(field === "startDate" || field === "venue") && !record[field as keyof ClubRecord] ? "needs-attention" : ""}`}><span>{label}{fieldTag(field, index) && <small>{fieldTag(field, index)}</small>}</span>{field === "description" ? <textarea value={String(record[field as keyof ClubRecord] ?? "")} onChange={(event) => update(field as keyof ClubRecord, event.target.value)} readOnly={published} /> : <input value={String(record[field as keyof ClubRecord] ?? "")} onChange={(event) => update(field as keyof ClubRecord, event.target.value)} readOnly={published} />}</label>)}{(requiredMissing || attentionMissing) && <p className="club-review-warning" role="alert"><X size={15} />{requiredMissing ? "Title, category, and description are required." : "Add an event date and venue so students can act on this update."}</p>}<div className="club-review-checklist"><strong>Approval checklist</strong><label><input type="checkbox" checked={record.reviewConfirmed} onChange={(event) => onChange({ ...record, reviewConfirmed: event.target.checked, status: "needs_review" })} disabled={published} /> I compared the fields with the original source.</label><label><input type="checkbox" checked={Boolean(record.startDate && record.venue)} readOnly /> Required timing and venue are present.</label></div><div className="club-form-footer"><span>Source remains visible to the reviewer.</span>{published ? <button className="club-primary-action" type="button" onClick={() => go("/club/published")}>View published shelf <ArrowUpRight size={15} /></button> : confirmed ? <button className="club-primary-action" type="button" onClick={onPublish} disabled={publishing}><Check size={16} /> {publishing ? "Publishing…" : "Approve & publish"}</button> : <button className="club-primary-action" type="button" onClick={handleConfirm} disabled={!canConfirm || !record.reviewConfirmed}><Check size={16} /> Confirm human review</button>}</div>{error && <p className="club-form-error" role="alert"><X size={15} />{error}</p>}</div></div>
  </section>
}

function DraftsPage({ records, onOpen, onDelete }: { records: ClubRecord[]; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
  const [query, setQuery] = useState("")
  const drafts = records.filter((record) => record.status !== "published_demo")
  const filtered = drafts.filter((record) => `${record.title} ${record.category} ${record.status}`.toLowerCase().includes(query.toLowerCase()))
  return <section className="club-page"><div className="club-page-heading compact"><div><p className="club-eyebrow">DRAFTS · {drafts.length}</p><h1>Keep the work<br />in motion.</h1><p>Resume extraction, resolve review notes, or continue editing. Nothing is removed without confirmation.</p></div><button className="club-primary-action" type="button" onClick={() => go("/club/create")}><Plus size={17} /> Create campus update</button></div><label className="club-draft-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search drafts by title, category, or status" /></label><div className="club-draft-list">{filtered.map((record) => <DraftRow key={record.id} record={record} onOpen={() => onOpen(record.id)} onDelete={() => onDelete(record.id)} />)}</div>{!filtered.length && <div className="club-empty-state"><FileText size={26} /><h2>{drafts.length ? "No drafts match that search." : "No drafts yet."}</h2><p>Create a draft or use the sample brief to start the publishing loop.</p></div>}</section>
}

function PublishedPage({ records, counts }: { records: ClubRecord[]; counts: RsvpCounts }) {
  const published = records.filter((record) => record.status === "published_demo")
  const rsvps = new Map(usePublishedEventRsvps(records, counts).map((entry) => [entry.id, entry.count]))
  return <section className="club-page"><div className="club-page-heading compact"><div><p className="club-eyebrow">PUBLISHED · {published.length}</p><h1>What students<br />can discover.</h1><p>Only records that passed human review appear here. This shelf is not an official institutional feed.</p></div><button className="club-primary-action" type="button" onClick={() => go("/club/create")}><Plus size={17} /> Create campus update</button></div>{published.length ? <><div className="club-publication-success"><Check size={18} /><div><strong>Published to UniFlow.</strong><span>Students can find it in Discover and Explore from any browser.</span></div><button type="button" onClick={() => go("/app/today")}>Preview student experience <ArrowUpRight size={15} /></button></div><div className="club-published-list">{published.map((record) => <article key={record.id} className="club-published-row"><div><span>{record.category} · published {new Date(record.publishedAt || record.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span><h2>{record.title}</h2><p>{record.publisher} · {documentLabel(record)}</p>{rsvps.has(record.id) && <p className="club-rsvp-count"><Users size={15} aria-hidden="true" /><strong>{rsvpLabel(rsvps.get(record.id) ?? null)}</strong></p>}</div><div className="club-published-status"><strong>Human reviewed</strong><span>Visible to students</span></div><button type="button" onClick={() => go(`/app/item/${record.id}`)}>View student update <ArrowUpRight size={15} /></button></article>)}</div>{rsvps.size > 0 && <p className="club-rsvp-note">{RSVP_DISCLAIMER}</p>}</> : <div className="club-empty-state club-published-empty"><Check size={27} /><h2>The publication shelf is intentionally empty.</h2><p>Complete a source review and approval to publish the first update.</p><button type="button" onClick={() => go("/club/create")}>Create a draft instead <ArrowUpRight size={15} /></button></div>}</section>
}

function ProfilePage({ clubId }: { clubId: string }) {
  const [profile, setProfile] = useState<Profile>(() => readClubProfile(clubId))
  const [saved, setSaved] = useState(false)
  const update = (field: keyof Profile, value: string) => setProfile((current) => ({ ...current, [field]: value }))
  return <section className="club-page"><div className="club-page-heading compact"><div><p className="club-eyebrow">CLUB IDENTITY · LOCAL DEMO</p><h1>Make the club<br />feel clear.</h1><p>These details stay in this browser. This demo does not grant publisher permissions or official verification.</p></div></div><form className="club-profile-form" onSubmit={(event) => { event.preventDefault(); writeClubProfile(clubId, profile); recordActivity(clubId, "Profile saved", profile.name); setSaved(true); window.setTimeout(() => setSaved(false), 1800) }}><label>Club display name<input value={profile.name} onChange={(event) => update("name", event.target.value)} required /></label><label>Description<textarea value={profile.description} onChange={(event) => update("description", event.target.value)} /></label><div className="club-form-grid"><label>Club category<input value={profile.category} onChange={(event) => update("category", event.target.value)} /></label><label>Contact (optional demo value)<input value={profile.contact} onChange={(event) => update("contact", event.target.value)} /></label><label>Relevant departments<input value={profile.departments} onChange={(event) => update("departments", event.target.value)} /></label><label>Campus identifier<input value={profile.campusId} onChange={(event) => update("campusId", event.target.value)} /></label></div><div className="club-form-footer"><span>Demo identity · not officially verified</span><button className="club-primary-action" type="submit">{saved ? "Saved" : "Save profile"} <Check size={16} /></button></div></form></section>
}

function ClubGateMessage({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="club-app"><main className="club-main"><section className="club-page"><div className="club-empty-state"><FileText size={27} /><h2>{title}</h2>{children}</div></section></main></div>
}

// Every /club/ URL passes through here. The workspace renders only for a signed-in user whose
// club_members rows were read successfully and include at least one club. A failed or missing
// check keeps it closed.
export default function ClubWorkspace() {
  const auth = useAuth()
  const { memberships } = auth
  const signedOut = auth.status === "signed-out"
  // A deliberate sign-out leaves for the access page; arriving without a session goes to sign-in.
  const leaving = useRef(false)
  const signOut = () => { leaving.current = true; void auth.signOut() }
  useEffect(() => {
    if (signedOut) window.location.replace(leaving.current ? "/get-started" : "/login/club")
  }, [signedOut])
  const clubs = useMemo(() => { const ids = allowedClubIds(memberships, demoClubs.map((entry) => entry.id)); return demoClubs.filter((entry) => ids.includes(entry.id)) }, [memberships])
  if (signedOut) return <ClubGateMessage title={leaving.current ? "Signed out." : "Sign in to open the club workspace."}><p role="status">{leaving.current ? "Taking you back…" : "Taking you to sign-in…"}</p></ClubGateMessage>
  if (auth.status === "loading" || memberships.status === "loading" || memberships.status === "idle") {
    return <ClubGateMessage title="Checking your access…"><p role="status" aria-live="polite">Confirming your session and club membership.</p></ClubGateMessage>
  }
  if (memberships.status === "error") {
    return <ClubGateMessage title="We couldn’t confirm club access."><p role="alert">{memberships.message} The workspace stays closed until membership can be confirmed.</p><button type="button" onClick={auth.reloadMemberships}>Check again</button><button type="button" onClick={() => window.location.assign("/login/club")}>Back to club sign-in</button></ClubGateMessage>
  }
  if (!clubs.length) {
    return <ClubGateMessage title="This account isn’t a member of a club."><p role="alert">Signed in as {auth.email}. No club workspace is open to this account. Club access is granted by the UniFlow team, per club.</p><button type="button" onClick={() => window.location.assign("/app/today")}>Go to the student app</button><button type="button" onClick={signOut}>Sign out</button></ClubGateMessage>
  }
  return <MemberWorkspace key={auth.user?.id} clubs={clubs} email={auth.email} onSignOut={signOut} />
}

function MemberWorkspace({ clubs, email, onSignOut }: { clubs: DemoClub[]; email: string | null; onSignOut: () => void }) {
  const [location, setLocation] = useState<ClubLocation>(locationFromPath)
  const [mobileOpen, setMobileOpen] = useState(false)
  // The stored choice is only a preference among the clubs this account belongs to.
  const [storedClubId, setClubId] = useState(getCurrentClubId)
  const club = clubs.find((entry) => entry.id === storedClubId) ?? clubs[0]
  const clubId = club.id
  // This club's rows in public.events. The server only returns and accepts them for members,
  // so one club cannot open, edit, or delete another's.
  const [records, setRecords] = useState<ClubRecord[]>([])
  const [load, setLoad] = useState<{ status: "loading" | "ready" | "error"; message?: string }>({ status: "loading" })
  const [reloadToken, setReloadToken] = useState(0)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [writesInFlight, setWritesInFlight] = useState(0)
  const [publishing, setPublishing] = useState(false)
  const [counts, setCounts] = useState<RsvpCounts>(null)
  const [activity, setActivity] = useState<Activity[]>(() => readActivity(clubId))
  useEffect(() => { setActivity(readActivity(clubId)) }, [clubId])
  const [sourcePreview, setSourcePreview] = useState<string | null>(null)
  const [extractions, setExtractions] = useState<Record<string, Extraction>>({})
  const noteExtraction = (recordId: string, extraction: Extraction | null) => setExtractions((current) => { const next = { ...current }; if (extraction) next[recordId] = extraction; else delete next[recordId]; return next })
  const reducedMotion = useReducedMotion() ?? false
  useEffect(() => { const sync = () => setLocation(locationFromPath()); window.addEventListener("popstate", sync); return () => window.removeEventListener("popstate", sync) }, [])

  useEffect(() => {
    let cancelled = false
    setLoad({ status: "loading" })
    setRecords([])
    setCounts(null)
    listClubEvents(clubId).then((result) => {
      if (cancelled) return
      if (result.ok) { setRecords(result.value); setLoad({ status: "ready" }); setSyncError(null) }
      else setLoad({ status: "error", message: result.message })
    })
    return () => { cancelled = true }
  }, [clubId, reloadToken])

  // Counts are read again each time the overview or the published shelf is opened.
  const showsCounts = location.route === "overview" || location.route === "published"
  useEffect(() => {
    if (load.status !== "ready" || !showsCounts) return
    let cancelled = false
    fetchRsvpCounts(clubId).then((result) => { if (!cancelled) setCounts(result.ok ? result.value : null) })
    return () => { cancelled = true }
  }, [clubId, load.status, showsCounts])

  // Writes go to the server one at a time, in the order they were made. Typing in review is
  // held back briefly so a burst of keystrokes becomes one write.
  const queue = useRef<Promise<unknown>>(Promise.resolve())
  const waiting = useRef(new Map<string, { record: ClubRecord; timer: number }>())
  const putLocal = (record: ClubRecord) => setRecords((current) => current.some((item) => item.id === record.id) ? current.map((item) => item.id === record.id ? record : item) : [record, ...current])
  const write = (record: ClubRecord) => {
    setWritesInFlight((count) => count + 1)
    const done = queue.current.then(() => saveEvent(record)).then((result) => {
      setWritesInFlight((count) => count - 1)
      if (result.ok) {
        setSyncError(null)
        // Keep what is on screen; take only the values the database sets.
        const saved = result.value
        setRecords((current) => current.map((item) => item.id === saved.id ? { ...item, createdAt: saved.createdAt, updatedAt: saved.updatedAt, publishedAt: saved.publishedAt, approvedAt: saved.approvedAt } : item))
      } else {
        setSyncError(`“${record.title || "Untitled update"}” wasn’t saved. ${result.message}`)
      }
      return result
    })
    queue.current = done.catch(() => undefined)
    return done
  }
  const saveNow = (record: ClubRecord) => {
    const held = waiting.current.get(record.id)
    if (held) { window.clearTimeout(held.timer); waiting.current.delete(record.id) }
    putLocal(record)
    return write(record)
  }
  const saveSoon = (record: ClubRecord) => {
    const held = waiting.current.get(record.id)
    if (held) window.clearTimeout(held.timer)
    putLocal(record)
    const timer = window.setTimeout(() => { waiting.current.delete(record.id); void write(record) }, 600)
    waiting.current.set(record.id, { record, timer })
  }
  const flushWaiting = () => { for (const [id, held] of waiting.current) { window.clearTimeout(held.timer); waiting.current.delete(id); void write(held.record) } }
  useEffect(() => () => flushWaiting(), [])

  const addLocalActivity = (label: string, detail: string) => { recordActivity(clubId, label, detail); setActivity(readActivity(clubId)) }
  const switchClub = (nextId: string) => { const next = clubs.find((entry) => entry.id === nextId); if (!next) return; flushWaiting(); setCurrentClubId(next.id); setClubId(next.id); setActivity(readActivity(next.id)); setSourcePreview(null); go("/club/overview") }
  const upsert = (record: ClubRecord) => { void saveNow(record); addLocalActivity(record.status === "draft" ? "Draft saved" : "Review updated", record.title || "Untitled update") }
  const startReview = (record: ClubRecord, preview: string | null) => { const next = { ...record, status: "needs_review" as const, source: record.source, updatedAt: new Date().toISOString() }; setSourcePreview(preview); upsert(next); go(`/club/review/${next.id}`) }
  const deleteRecord = async (id: string) => {
    if (!window.confirm("Delete this draft? It is removed for every member of the club.")) return
    const item = records.find((entry) => entry.id === id)
    const held = waiting.current.get(id)
    if (held) { window.clearTimeout(held.timer); waiting.current.delete(id) }
    setRecords((current) => current.filter((entry) => entry.id !== id))
    await queue.current
    const result = await deleteEvent(id)
    if (!result.ok) { setSyncError(`“${item?.title || "Untitled update"}” wasn’t deleted. ${result.message}`); setReloadToken((value) => value + 1); return }
    if (item) addLocalActivity("Draft deleted", item.title || "Untitled update")
  }
  const record = useMemo(() => records.find((item) => item.id === location.id), [records, location.id])
  const saveReview = (next: ClubRecord) => saveSoon({ ...next, updatedAt: new Date().toISOString() })
  const confirmReview = () => { if (!record) return; const next = { ...record, status: "ready_for_approval" as const, reviewedAt: new Date().toISOString(), reviewConfirmed: true, updatedAt: new Date().toISOString() }; void saveNow(next); addLocalActivity("Human review confirmed", next.title) }
  // Nothing is shown as published until the server has accepted it.
  const publish = async () => {
    if (!record || publishing) return
    setPublishing(true)
    const before = record
    const held = waiting.current.get(before.id)
    if (held) { window.clearTimeout(held.timer); waiting.current.delete(before.id) }
    const result = await write({ ...before, status: "published_demo", approvedAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
    setPublishing(false)
    if (!result.ok) return
    putLocal(result.value)
    void refreshPublishedEvents()
    addLocalActivity("Published", result.value.title)
    go("/club/published")
  }
  const sync = load.status === "loading" ? "Loading…" : load.status === "error" || syncError ? "Not saved" : writesInFlight > 0 ? "Saving…" : "Saved to UniFlow"
  const reload = () => { setSyncError(null); setReloadToken((value) => value + 1) }
  return <div className="club-app"><ClubNav location={location} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} club={club} clubs={clubs} email={email} onSwitchClub={switchClub} onSignOut={onSignOut} /><main className="club-main"><WorkspaceHeader location={location} onMenu={() => setMobileOpen(true)} club={club} sync={sync} />{syncError && <p className="club-form-error" role="alert"><X size={15} />{syncError} <button type="button" className="club-secondary-action" onClick={reload}>Reload from server</button></p>}<motion.div key={`${clubId}-${location.route}-${location.id ?? ""}`} initial={reducedMotion ? false : { y: 8 }} animate={{ y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.22 }}>{load.status === "loading" && <section className="club-page"><div className="club-empty-state"><FileText size={27} /><h2>Loading {club.name}’s updates…</h2><p role="status" aria-live="polite">Reading drafts and publications from the server.</p></div></section>}{load.status === "error" && <section className="club-page"><div className="club-empty-state"><FileText size={27} /><h2>{club.name}’s updates couldn’t be loaded.</h2><p role="alert">{load.message}</p><button type="button" onClick={reload}>Try again</button></div></section>}{load.status === "ready" && <>{location.route === "overview" && <Overview records={records} counts={counts} activity={activity} onCreate={() => go("/club/create")} onOpen={(id) => go(`/club/review/${id}`)} />}{location.route === "create" && <CreatePage clubId={clubId} initial={record} onSaved={(next) => { upsert(next); go("/club/drafts") }} onReview={startReview} onExtraction={noteExtraction} />}{location.route === "drafts" && <DraftsPage records={records} onOpen={(id) => { const item = records.find((entry) => entry.id === id); go(item?.status === "draft" ? `/club/create/${id}` : `/club/review/${id}`) }} onDelete={deleteRecord} />}{location.route === "review" && !record && <section className="club-page"><div className="club-empty-state"><FileText size={27} /><h2>This draft isn’t in {club.name}’s workspace.</h2><p>It may belong to another club, or it was deleted.</p><button type="button" onClick={() => go("/club/drafts")}>Open {club.name}’s drafts <ArrowUpRight size={15} /></button></div></section>}{location.route === "review" && record && <ReviewPage record={record} preview={sourcePreview} extraction={extractions[record.id] ?? null} publishing={publishing} onChange={saveReview} onConfirm={confirmReview} onPublish={publish} />}{location.route === "published" && <PublishedPage records={records} counts={counts} />}{location.route === "profile" && <ProfilePage clubId={clubId} />}</>}</motion.div></main></div>
}
