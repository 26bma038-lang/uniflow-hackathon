import { useEffect, useMemo, useState } from "react"
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
import { enterDemo, exitDemo } from "../demo-session"
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
  readClubRecords,
  sampleRecordValues,
  writeClubRecords,
} from "./publishing"
import type { ClubProfile, ClubRecord, DemoClub } from "./publishing"
import { canJoin, readRsvpCounts } from "../student-app/useJoinedEvents"

type ClubRoute = "overview" | "drafts" | "create" | "review" | "published" | "profile"
type ClubLocation = { route: ClubRoute; id?: string }
// Activity saved before clubs could be switched has no clubId and belongs to the default club.
type Activity = { id: string; label: string; detail: string; createdAt: string; clubId?: string }
type Profile = ClubProfile

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

function ClubNav({ location, mobileOpen, setMobileOpen, club, onSwitchClub }: { location: ClubLocation; mobileOpen: boolean; setMobileOpen: (value: boolean) => void; club: DemoClub; onSwitchClub: (clubId: string) => void }) {
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
        <div className="club-sidebar-bottom"><strong>{club.name}</strong><span>Demo identity · not verified</span><label className="club-identity-switch"><span>Switch demo club</span><select value={club.id} onChange={(event) => { setMobileOpen(false); onSwitchClub(event.target.value) }}>{demoClubs.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}</select></label><span>Switching is a demo convenience in this browser, not organizer permission.</span><button type="button" onClick={() => { exitDemo(); window.location.assign("/get-started") }}>Switch demo role</button></div>
      </aside>
    </>
  )
}

function WorkspaceHeader({ location, onMenu, club }: { location: ClubLocation; onMenu: () => void; club: DemoClub }) {
  const labels: Record<ClubRoute, string> = { overview: "Overview", drafts: "Drafts", create: "Create update", review: "Human review", published: "Published", profile: "Club profile" }
  return <header className="club-topbar"><button className="club-mobile-menu" aria-label="Open club navigation" onClick={onMenu}><Menu size={20} /></button><div><span>Club workspace / {club.name}</span><strong>{labels[location.route]}</strong></div><span className="club-topbar-status"><i /> Local demo</span></header>
}

function Workflow({ active = 1 }: { active?: number }) {
  return <div className="club-workflow"><div className="club-workflow-line" /><div className={active >= 1 ? "is-active" : ""}><b>01</b><strong>Draft</strong><span>Shape the update</span></div><div className={active >= 2 ? "is-active" : ""}><b>02</b><strong>Extract</strong><span>Structure the source</span></div><div className={active >= 3 ? "is-active" : ""}><b>03</b><strong>Review</strong><span>Check every detail</span></div><div className={active >= 4 ? "is-active" : ""}><b>04</b><strong>Publish</strong><span>Local demo only</span></div></div>
}

// Events this workspace published, with RSVP counts from the same records the student app writes.
// Only this workspace's own records are passed in, and only those students can join as events.
function usePublishedEventRsvps(records: ClubRecord[]) {
  return useMemo(() => {
    const counts = readRsvpCounts()
    return records
      .filter((record) => record.status === "published_demo" && canJoin(toCampusItem(record)))
      .map((record) => ({ id: record.id, title: record.title, count: counts.get(record.id) ?? 0 }))
  }, [records])
}

function rsvpLabel(count: number) {
  return `${count} ${count === 1 ? "RSVP" : "RSVPs"}`
}

const RSVP_DISCLAIMER = "RSVP numbers count demo students who joined in this browser. They are not real attendance or server analytics."

function Overview({ records, activity, onCreate, onOpen }: { records: ClubRecord[]; activity: Activity[]; onCreate: () => void; onOpen: (id: string) => void }) {
  const drafts = records.filter((record) => record.status !== "published_demo").slice(0, 3)
  const eventRsvps = usePublishedEventRsvps(records)
  return <section className="club-page">
    <div className="club-page-heading"><div><p className="club-eyebrow">CLUB WORKSPACE · 18 OCT 2026</p><h1>Your club,<br />your campus.</h1><p>Prepare updates, review the source, and publish only when a human is ready to stand behind the details.</p></div><button className="club-primary-action" type="button" onClick={onCreate}><Plus size={17} /> Create campus update</button></div>
    <div className="club-overview-grid-new">
      <div className="club-overview-main">
        <div className="club-section-title"><span>01</span><h2>Work in progress</h2><button type="button" onClick={() => go("/club/drafts")}>View all <ArrowUpRight size={14} /></button></div>
        {drafts.length ? drafts.map((record) => <DraftRow key={record.id} record={record} onOpen={() => onOpen(record.id)} onDelete={() => {}} />) : <div className="club-empty-inline"><FileText size={20} /><strong>No drafts yet.</strong><span>Start with a source document or create an update manually.</span></div>}
      </div>
      <aside className="club-overview-side"><p className="club-eyebrow">PREPARATION FLOW</p><h2>From source<br />to signal.</h2><Workflow /><button type="button" onClick={onCreate}>Start a new update <ArrowUpRight size={15} /></button></aside>
    </div>
    <div className="club-activity-strip"><div className="club-section-title"><span>02</span><h2>Recent activity</h2></div>{activity.length ? <div className="club-activity-list">{activity.slice(0, 3).map((item) => <div key={item.id}><span>{item.label}</span><strong>{item.detail}</strong><time>{new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</time></div>)}</div> : <p className="club-activity-empty">Your local draft and profile actions will appear here.</p>}</div>
    {eventRsvps.length > 0 && <div className="club-activity-strip club-rsvp-strip"><div className="club-section-title"><span>03</span><h2>Demo RSVPs</h2><button type="button" onClick={() => go("/club/published")}>View published <ArrowUpRight size={14} /></button></div><div className="club-activity-list">{eventRsvps.slice(0, 3).map((entry) => <div key={entry.id}><span>Event</span><strong>{entry.title}</strong><time>{rsvpLabel(entry.count)}</time></div>)}</div><p className="club-rsvp-note">{RSVP_DISCLAIMER}</p></div>}
    <div className="club-quick-grid"><button type="button" onClick={onCreate}><Plus size={18} /><span><b>Create update</b><small>Start manually or from a document</small></span></button><button type="button" onClick={onCreate}><FileImage size={18} /><span><b>Use the sample brief</b><small>See simulated extraction</small></span></button><button type="button" onClick={() => go("/app/today")}><Users size={18} /><span><b>Preview student experience</b><small>See published demo updates</small></span></button></div>
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

function CreatePage({ clubId, initial, onSaved, onReview }: { clubId: string; initial?: ClubRecord; onSaved: (record: ClubRecord) => void; onReview: (record: ClubRecord, preview: string | null) => void }) {
  const [form, setForm] = useState<ClubRecord>(() => initial ?? blankRecord(clubId))
  const [mode, setMode] = useState<"sample" | "upload" | "manual">(initial?.source === "Uploaded document" ? "upload" : initial?.source === "Sample document" ? "sample" : "manual")
  const [preview, setPreview] = useState<string | null>(null)
  const [error, setError] = useState("")
  const update = (field: keyof ClubRecord, value: string) => setForm((current) => ({ ...current, [field]: value }))
  const chooseFile = (file: File | undefined) => {
    if (!file) return
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) { setError("Use a PNG, JPEG, or WebP source document."); return }
    if (file.size > 10 * 1024 * 1024) { setError("That file is larger than 10 MB. Choose a smaller source document."); return }
    const reader = new FileReader()
    reader.onload = () => { setPreview(String(reader.result)); setMode("upload"); setError("") }
    reader.readAsDataURL(file)
  }
  const applySample = () => { setForm((current) => ({ ...current, ...sampleRecordValues, department: "Computer Science", source: "Sample document", sourceName: "WORKSHOP.JPG" })); setMode("sample"); setError("") }
  const save = (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.title.trim() || !form.category.trim() || !form.description.trim()) { setError("Add a title, category, and description before saving."); return }
    const source: ClubRecord["source"] = mode === "sample" ? "Sample document" : mode === "upload" ? "Uploaded document" : "Manual entry"
    const next: ClubRecord = { ...form, source, sourceName: mode === "sample" ? "WORKSHOP.JPG" : form.sourceName || "Manual entry", updatedAt: new Date().toISOString() }
    onSaved(next)
    setError("")
  }
  const fields: Array<[keyof ClubRecord, string, string]> = [["title", "Title", "e.g. Build Your First Web App"], ["category", "Category", "Opportunity, notice, event..."], ["description", "Description", "What should students know?"], ["startDate", "Event date", "2026-10-18"], ["startTime", "Start time", "16:00"], ["venue", "Venue", "Innovation Lab"], ["eligibility", "Audience", "All interested students"], ["department", "Department", "Computer Science"], ["registrationDeadline", "Registration deadline", "Optional"]]
  return <section className="club-page club-create-page">
    <div className="club-page-heading compact"><div><p className="club-eyebrow">CREATE CAMPUS UPDATE</p><h1>Start with the source.</h1><p>Keep the original document close while you turn it into a structured, editable campus record.</p></div></div>
    <div className="club-create-layout">
      <div className="club-create-source"><div className="club-section-title"><span>01</span><h2>Source document</h2></div><SourceDocument preview={preview} sample={mode === "sample"} /><div className="club-source-actions"><label className="club-upload-button"><Upload size={16} /> Choose image<input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => chooseFile(event.target.files?.[0])} /></label><button type="button" onClick={applySample}>Use sample brief</button>{preview && <button type="button" onClick={() => { setPreview(null); setMode("manual") }}><X size={15} /> Remove</button>}</div><p className="club-source-note">JPEG, PNG, or WebP · 10 MB maximum. Uploaded previews stay in this session and must be reattached after refresh.</p></div>
      <form className="club-update-form club-create-form" onSubmit={save}><div className="club-section-title"><span>02</span><h2>Structured update</h2></div><div className="club-form-grid">{fields.map(([field, label, placeholder]) => <label key={field} className={field === "description" ? "is-wide" : ""}>{label}{field === "description" ? <textarea value={String(form[field] ?? "")} placeholder={placeholder} onChange={(event) => update(field, event.target.value)} /> : <input type={field === "startDate" ? "date" : field === "startTime" ? "time" : "text"} value={String(form[field] ?? "")} placeholder={placeholder} onChange={(event) => update(field, event.target.value)} />}</label>)}</div>{error && <p className="club-form-error" role="alert"><X size={15} />{error}</p>}<div className="club-form-footer"><span>Nothing publishes from this screen.</span><div><button className="club-secondary-action" type="button" onClick={() => onReview({ ...form, source: mode === "sample" ? "Sample document" : mode === "upload" ? "Uploaded document" : "Manual entry" }, preview)}>Continue to review <ChevronRight size={15} /></button><button className="club-primary-action" type="submit"><Check size={16} /> Save draft</button></div></div></form>
    </div>
  </section>
}

function ReviewPage({ record, preview, onChange, onConfirm, onPublish }: { record: ClubRecord; preview: string | null; onChange: (record: ClubRecord) => void; onConfirm: () => void; onPublish: () => void }) {
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
  const status = record.status === "published_demo" ? "Published demo" : confirmed ? "Ready for approval" : "Needs attention"
  const handleConfirm = () => { if (!canConfirm) { setError("Resolve the highlighted required fields before confirming review."); return } onConfirm(); setError("") }
  return <section className="club-page club-review-page">
    <div className="club-review-heading"><div><button type="button" className="club-back-action" onClick={() => go("/club/drafts")}><ArrowLeft size={15} /> Back to drafts</button><p className="club-eyebrow">SIMULATED AI EXTRACTION · HUMAN REVIEW</p><h1>Check the source,<br />then make it yours.</h1><p>Every extracted value remains editable. This local demo never sends the document to an AI service.</p></div><span className={`club-review-status ${confirmed ? "is-ready" : ""}`}><i />{status}</span></div>
    <Workflow active={confirmed ? 4 : 3} />
    <div className="club-review-layout"><div><SourceDocument preview={preview} sample={record.source === "Sample document"} highlight={revealed === 1 ? "title" : revealed === 2 ? "date" : revealed === 3 ? "venue" : undefined} /><div className="club-source-note">Source: {record.sourceName || "Manual entry"} · publisher: {record.publisher} · illustrative local document</div></div><div className="club-review-fields"><div className="club-review-field-head"><div><span>EXTRACTED INFORMATION</span><h2>Structured campus update</h2></div><span className="club-extraction-badge"><span /> Simulated AI extraction</span></div>{[["title", "Title"], ["category", "Category"], ["description", "Description"], ["startDate", "Event date"], ["venue", "Venue"], ["eligibility", "Audience"], ["department", "Department"]].map(([field, label], index) => <label key={field} className={`${field === "description" ? "is-wide " : ""}${(field === "startDate" || field === "venue") && !record[field as keyof ClubRecord] ? "needs-attention" : ""}`}><span>{label}{index < 3 && <small>{index < revealed ? "Extracted" : "Queued"}</small>}</span>{field === "description" ? <textarea value={String(record[field as keyof ClubRecord] ?? "")} onChange={(event) => update(field as keyof ClubRecord, event.target.value)} readOnly={published} /> : <input value={String(record[field as keyof ClubRecord] ?? "")} onChange={(event) => update(field as keyof ClubRecord, event.target.value)} readOnly={published} />}</label>)}{(requiredMissing || attentionMissing) && <p className="club-review-warning" role="alert"><X size={15} />{requiredMissing ? "Title, category, and description are required." : "Add an event date and venue so students can act on this update."}</p>}<div className="club-review-checklist"><strong>Approval checklist</strong><label><input type="checkbox" checked={record.reviewConfirmed} onChange={(event) => onChange({ ...record, reviewConfirmed: event.target.checked, status: "needs_review" })} disabled={published} /> I compared the fields with the original source.</label><label><input type="checkbox" checked={Boolean(record.startDate && record.venue)} readOnly /> Required timing and venue are present.</label></div><div className="club-form-footer"><span>Source remains visible to the reviewer.</span>{published ? <button className="club-primary-action" type="button" onClick={() => go("/club/published")}>View published shelf <ArrowUpRight size={15} /></button> : confirmed ? <button className="club-primary-action" type="button" onClick={onPublish}><Check size={16} /> Approve & publish demo</button> : <button className="club-primary-action" type="button" onClick={handleConfirm} disabled={!canConfirm || !record.reviewConfirmed}><Check size={16} /> Confirm human review</button>}</div>{error && <p className="club-form-error" role="alert"><X size={15} />{error}</p>}</div></div>
  </section>
}

function DraftsPage({ records, onOpen, onDelete }: { records: ClubRecord[]; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
  const [query, setQuery] = useState("")
  const drafts = records.filter((record) => record.status !== "published_demo")
  const filtered = drafts.filter((record) => `${record.title} ${record.category} ${record.status}`.toLowerCase().includes(query.toLowerCase()))
  return <section className="club-page"><div className="club-page-heading compact"><div><p className="club-eyebrow">LOCAL DRAFTS · {drafts.length}</p><h1>Keep the work<br />in motion.</h1><p>Resume extraction, resolve review notes, or continue editing. Nothing is removed without confirmation.</p></div><button className="club-primary-action" type="button" onClick={() => go("/club/create")}><Plus size={17} /> Create campus update</button></div><label className="club-draft-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search drafts by title, category, or status" /></label><div className="club-draft-list">{filtered.map((record) => <DraftRow key={record.id} record={record} onOpen={() => onOpen(record.id)} onDelete={() => onDelete(record.id)} />)}</div>{!filtered.length && <div className="club-empty-state"><FileText size={26} /><h2>{drafts.length ? "No drafts match that search." : "No drafts yet."}</h2><p>Create a local draft or use the sample brief to start the publishing loop.</p></div>}</section>
}

function PublishedPage({ records }: { records: ClubRecord[] }) {
  const published = records.filter((record) => record.status === "published_demo")
  const rsvps = new Map(usePublishedEventRsvps(records).map((entry) => [entry.id, entry.count]))
  return <section className="club-page"><div className="club-page-heading compact"><div><p className="club-eyebrow">PUBLISHED DEMOS · {published.length}</p><h1>What students<br />can discover.</h1><p>Only records that passed local human review appear here. This shelf is not an official institutional feed.</p></div><button className="club-primary-action" type="button" onClick={() => go("/club/create")}><Plus size={17} /> Create campus update</button></div>{published.length ? <><div className="club-publication-success"><Check size={18} /><div><strong>Published in your local UniFlow demo.</strong><span>It is now available in the student discovery experience.</span></div><button type="button" onClick={() => go("/app/today")}>Preview student experience <ArrowUpRight size={15} /></button></div><div className="club-published-list">{published.map((record) => <article key={record.id} className="club-published-row"><div><span>{record.category} · published {new Date(record.publishedAt || record.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span><h2>{record.title}</h2><p>{record.publisher} · {documentLabel(record)}</p>{rsvps.has(record.id) && <p className="club-rsvp-count"><Users size={15} aria-hidden="true" /><strong>{rsvpLabel(rsvps.get(record.id) ?? 0)}</strong> in this browser’s demo</p>}</div><div className="club-published-status"><strong>Human reviewed</strong><span>Local demo publication</span></div><button type="button" onClick={() => go(`/app/item/${record.id}`)}>View student update <ArrowUpRight size={15} /></button></article>)}</div>{rsvps.size > 0 && <p className="club-rsvp-note">{RSVP_DISCLAIMER}</p>}</> : <div className="club-empty-state club-published-empty"><Check size={27} /><h2>The publication shelf is intentionally empty.</h2><p>Complete a source review and approval to create the first local demo publication.</p><button type="button" onClick={() => go("/club/create")}>Create a draft instead <ArrowUpRight size={15} /></button></div>}</section>
}

function ProfilePage({ clubId }: { clubId: string }) {
  const [profile, setProfile] = useState<Profile>(() => readClubProfile(clubId))
  const [saved, setSaved] = useState(false)
  const update = (field: keyof Profile, value: string) => setProfile((current) => ({ ...current, [field]: value }))
  return <section className="club-page"><div className="club-page-heading compact"><div><p className="club-eyebrow">CLUB IDENTITY · LOCAL DEMO</p><h1>Make the club<br />feel clear.</h1><p>These details stay in this browser. This demo does not grant publisher permissions or official verification.</p></div></div><form className="club-profile-form" onSubmit={(event) => { event.preventDefault(); writeClubProfile(clubId, profile); recordActivity(clubId, "Profile saved", profile.name); setSaved(true); window.setTimeout(() => setSaved(false), 1800) }}><label>Club display name<input value={profile.name} onChange={(event) => update("name", event.target.value)} required /></label><label>Description<textarea value={profile.description} onChange={(event) => update("description", event.target.value)} /></label><div className="club-form-grid"><label>Club category<input value={profile.category} onChange={(event) => update("category", event.target.value)} /></label><label>Contact (optional demo value)<input value={profile.contact} onChange={(event) => update("contact", event.target.value)} /></label><label>Relevant departments<input value={profile.departments} onChange={(event) => update("departments", event.target.value)} /></label><label>Campus identifier<input value={profile.campusId} onChange={(event) => update("campusId", event.target.value)} /></label></div><div className="club-form-footer"><span>Demo identity · not officially verified</span><button className="club-primary-action" type="submit">{saved ? "Saved" : "Save profile"} <Check size={16} /></button></div></form></section>
}

export default function ClubWorkspace() {
  const [location, setLocation] = useState<ClubLocation>(locationFromPath)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [clubId, setClubId] = useState(getCurrentClubId)
  const club = getDemoClub(clubId)
  // Every club's records share one store. Everything below this line sees only the selected
  // club's records, so one club cannot open, edit, or delete another's through the UI.
  // That is a demo boundary in the browser, not access control.
  const [allRecords, setAllRecords] = useState<ClubRecord[]>(readClubRecords)
  const records = useMemo(() => allRecords.filter((item) => item.clubId === clubId), [allRecords, clubId])
  const [activity, setActivity] = useState<Activity[]>(() => readActivity(clubId))
  const [sourcePreview, setSourcePreview] = useState<string | null>(null)
  const reducedMotion = useReducedMotion() ?? false
  useEffect(() => { const sync = () => setLocation(locationFromPath()); window.addEventListener("popstate", sync); return () => window.removeEventListener("popstate", sync) }, [])
  const saveRecords = (next: ClubRecord[]) => { const merged = [...next.filter((item) => item.clubId === clubId), ...allRecords.filter((item) => item.clubId !== clubId)]; setAllRecords(merged); writeClubRecords(merged) }
  const addLocalActivity = (label: string, detail: string) => { recordActivity(clubId, label, detail); setActivity(readActivity(clubId)) }
  const switchClub = (nextId: string) => { const next = getDemoClub(nextId); setCurrentClubId(next.id); enterDemo("club", next.name); setClubId(next.id); setActivity(readActivity(next.id)); setSourcePreview(null); go("/club/overview") }
  const upsert = (record: ClubRecord) => { const next = records.some((item) => item.id === record.id) ? records.map((item) => item.id === record.id ? record : item) : [record, ...records]; saveRecords(next); addLocalActivity(record.status === "draft" ? "Draft saved" : "Review updated", record.title || "Untitled update") }
  const startReview = (record: ClubRecord, preview: string | null) => { const next = { ...record, status: "needs_review" as const, source: record.source, updatedAt: new Date().toISOString() }; setSourcePreview(preview); upsert(next); go(`/club/review/${next.id}`) }
  const deleteRecord = (id: string) => { if (!window.confirm("Delete this local draft?")) return; const item = records.find((record) => record.id === id); const next = records.filter((record) => record.id !== id); saveRecords(next); if (item) addLocalActivity("Draft deleted", item.title || "Untitled update") }
  const record = useMemo(() => records.find((item) => item.id === location.id), [records, location.id])
  const saveReview = (next: ClubRecord) => saveRecords(records.map((item) => item.id === next.id ? { ...next, updatedAt: new Date().toISOString() } : item))
  const confirmReview = () => { if (!record) return; const next = { ...record, status: "ready_for_approval" as const, reviewedAt: new Date().toISOString(), reviewConfirmed: true, updatedAt: new Date().toISOString() }; saveReview(next); addLocalActivity("Human review confirmed", next.title) }
  const publish = () => { if (!record) return; const next = { ...record, status: "published_demo" as const, approvedAt: new Date().toISOString(), publishedAt: new Date().toISOString(), updatedAt: new Date().toISOString() }; saveReview(next); addLocalActivity("Published in local demo", next.title); go("/club/published") }
  return <div className="club-app"><ClubNav location={location} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} club={club} onSwitchClub={switchClub} /><main className="club-main"><WorkspaceHeader location={location} onMenu={() => setMobileOpen(true)} club={club} /><motion.div key={`${clubId}-${location.route}-${location.id ?? ""}`} initial={reducedMotion ? false : { y: 8 }} animate={{ y: 0 }} transition={{ duration: reducedMotion ? 0 : 0.22 }}>{location.route === "overview" && <Overview records={records} activity={activity} onCreate={() => go("/club/create")} onOpen={(id) => go(`/club/review/${id}`)} />}{location.route === "create" && <CreatePage clubId={clubId} initial={record} onSaved={(next) => { upsert(next); go("/club/drafts") }} onReview={startReview} />}{location.route === "drafts" && <DraftsPage records={records} onOpen={(id) => { const item = records.find((entry) => entry.id === id); go(item?.status === "draft" ? `/club/create/${id}` : `/club/review/${id}`) }} onDelete={deleteRecord} />}{location.route === "review" && !record && <section className="club-page"><div className="club-empty-state"><FileText size={27} /><h2>This draft isn’t in {club.name}’s workspace.</h2><p>It may belong to another demo club, or it was deleted in this browser.</p><button type="button" onClick={() => go("/club/drafts")}>Open {club.name}’s drafts <ArrowUpRight size={15} /></button></div></section>}{location.route === "review" && record && <ReviewPage record={record} preview={sourcePreview} onChange={saveReview} onConfirm={confirmReview} onPublish={publish} />}{location.route === "published" && <PublishedPage records={records} />}{location.route === "profile" && <ProfilePage clubId={clubId} />}</motion.div></main></div>
}
