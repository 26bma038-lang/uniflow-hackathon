import { useEffect, useMemo, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  FileImage,
  FileText,
  Menu,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react"
import type { EventDraft } from "../components/poster-to-event/types"
import { exitDemo } from "../demo-session"

type ClubRoute = "overview" | "drafts" | "create" | "published" | "profile"
type ClubDraft = EventDraft & {
  id: string
  status: "Draft" | "Needs review"
  updatedAt: string
  source: string
}
type ClubProfile = {
  name: string
  description: string
  category: string
  contact: string
  departments: string
  campusId: string
}
type ClubActivity = {
  id: string
  label: string
  detail: string
  createdAt: string
}

const DRAFTS_KEY = "uniflow-club-drafts"
const PROFILE_KEY = "uniflow-club-profile"
const ACTIVITY_KEY = "uniflow-club-activity"
const blankDraft: EventDraft = {
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
}
const defaultProfile: ClubProfile = {
  name: "Campus Code Collective",
  description: "A student-led group for curious builders and first-time makers.",
  category: "Technology",
  contact: "",
  departments: "Computer Science, Design",
  campusId: "demo-campus",
}

function read<T>(key: string, fallback: T): T {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? "null")
    return value ?? fallback
  } catch {
    return fallback
  }
}

function routeFromPath(): ClubRoute {
  const part = window.location.pathname.split("/").filter(Boolean)[1]
  return ["overview", "drafts", "create", "published", "profile"].includes(part)
    ? (part as ClubRoute)
    : "overview"
}

function go(path: string) {
  window.history.pushState({}, "", path)
  window.dispatchEvent(new PopStateEvent("popstate"))
  window.scrollTo({ top: 0, behavior: "smooth" })
}

function saveDrafts(drafts: ClubDraft[]) {
  localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts))
}

function addActivity(activity: Omit<ClubActivity, "id" | "createdAt">) {
  const next = [{ ...activity, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...read<ClubActivity[]>(ACTIVITY_KEY, [])].slice(0, 8)
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(next))
}

function DraftRow({
  draft,
  onOpen,
  onDelete,
}: {
  draft: ClubDraft
  onOpen: () => void
  onDelete: () => void
}) {
  return (
    <motion.article layout className="club-draft-row">
      <div className="club-draft-type"><FileText size={18} /><span>{draft.category || "Uncategorised"}</span></div>
      <button type="button" className="club-draft-main" onClick={onOpen}>
        <strong>{draft.title || "Untitled campus update"}</strong>
        <span>{draft.source} · edited {new Date(draft.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</span>
      </button>
      <span className={`club-draft-status ${draft.status === "Needs review" ? "is-review" : ""}`}>{draft.status}</span>
      <button type="button" className="club-icon-button" aria-label={`Edit ${draft.title || "draft"}`} onClick={onOpen}><Pencil size={16} /></button>
      <button type="button" className="club-icon-button club-danger" aria-label={`Delete ${draft.title || "draft"}`} onClick={onDelete}><Trash2 size={16} /></button>
    </motion.article>
  )
}

function ClubNav({ route, mobileOpen, setMobileOpen }: { route: ClubRoute; mobileOpen: boolean; setMobileOpen: (value: boolean) => void }) {
  const links: Array<[ClubRoute, string]> = [["overview", "Overview"], ["drafts", "Drafts"], ["create", "Create update"], ["published", "Published"], ["profile", "Club profile"]]
  return (
    <>
      {mobileOpen && <button className="club-mobile-scrim" aria-label="Close navigation" onClick={() => setMobileOpen(false)} />}
      <aside className={`club-sidebar ${mobileOpen ? "is-open" : ""}`}>
        <a className="club-brand" href="/club/overview" onClick={(event) => { event.preventDefault(); go("/club/overview") }}><span>U</span>UniFlow</a>
        <p className="club-sidebar-kicker">CLUB WORKSPACE · DEMO</p>
        <nav aria-label="Club workspace">
          {links.map(([key, label]) => <a key={key} href={`/club/${key}`} className={route === key ? "is-active" : ""} onClick={(event) => { event.preventDefault(); setMobileOpen(false); go(`/club/${key}`) }}><i />{label}{key === "create" && <Plus size={14} />}</a>)}
        </nav>
        <div className="club-sidebar-bottom"><strong>Campus Code Collective</strong><span>Demo identity · not verified</span><button type="button" onClick={() => { exitDemo(); window.location.assign("/get-started") }}>Switch demo role</button></div>
      </aside>
    </>
  )
}

function WorkspaceHeader({ route, onMenu }: { route: ClubRoute; onMenu: () => void }) {
  const labels: Record<ClubRoute, string> = { overview: "Overview", drafts: "Drafts", create: "Create update", published: "Published", profile: "Club profile" }
  return <header className="club-topbar"><button className="club-mobile-menu" aria-label="Open club navigation" onClick={onMenu}><Menu size={20} /></button><div><span>UniFlow / Club workspace</span><strong>{labels[route]}</strong></div><span className="club-topbar-status"><i /> Local demo</span></header>
}

function Workflow() {
  return <div className="club-workflow"><div className="club-workflow-line" /><div><b>01</b><strong>Draft</strong><span>Shape the update</span></div><div><b>02</b><strong>Extract</strong><span>Structure the source</span></div><div><b>03</b><strong>Review</strong><span>Check every detail</span></div><div><b>04</b><strong>Publish</strong><span>Milestone 4B</span></div></div>
}

function Overview({ drafts, activity, onCreate, onOpenDraft }: { drafts: ClubDraft[]; activity: ClubActivity[]; onCreate: () => void; onOpenDraft: (id: string) => void }) {
  return <section className="club-page">
    <div className="club-page-heading"><div><p className="club-eyebrow">CLUB WORKSPACE · 18 OCT 2026</p><h1>Your club,<br />your campus.</h1><p>Prepare updates, review drafts, and keep students informed without losing the source.</p></div><button className="club-primary-action" type="button" onClick={onCreate}><Plus size={17} /> Create campus update</button></div>
    <div className="club-overview-grid-new">
      <div className="club-overview-main">
        <div className="club-section-title"><span>01</span><h2>Recent drafts</h2><button type="button" onClick={() => go("/club/drafts")}>View all <ArrowUpRight size={14} /></button></div>
        {drafts.length ? drafts.slice(0, 3).map((draft) => <DraftRow key={draft.id} draft={draft} onOpen={() => onOpenDraft(draft.id)} onDelete={() => {}} />) : <div className="club-empty-inline"><FileText size={20} /><strong>No drafts yet.</strong><span>Start with a source document or create an update manually.</span></div>}
      </div>
      <aside className="club-overview-side"><p className="club-eyebrow">PREPARATION FLOW</p><h2>From source<br />to signal.</h2><Workflow /><button type="button" onClick={onCreate}>Start a new update <ArrowUpRight size={15} /></button></aside>
    </div>
    <div className="club-activity-strip"><div className="club-section-title"><span>02</span><h2>Recent activity</h2></div>{activity.length ? <div className="club-activity-list">{activity.slice(0, 3).map((item) => <div key={item.id}><span>{item.label}</span><strong>{item.detail}</strong><time>{new Date(item.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}</time></div>)}</div> : <p className="club-activity-empty">Your local draft and profile actions will appear here.</p>}</div>
    <div className="club-quick-grid"><button type="button" onClick={onCreate}><Plus size={18} /><span><b>Create update</b><small>Start manually or from a document</small></span></button><button type="button" onClick={() => go("/poster-to-event")}><FileImage size={18} /><span><b>Try poster extraction</b><small>Use the existing local demo</small></span></button><button type="button" onClick={() => go("/app/today")}><Users size={18} /><span><b>Preview student experience</b><small>See the student-facing surface</small></span></button></div>
  </section>
}

function CreatePage({ initial, onSaved }: { initial?: ClubDraft; onSaved: (draft: ClubDraft) => void }) {
  const [form, setForm] = useState<EventDraft>(initial ?? blankDraft)
  const [mode, setMode] = useState<"manual" | "source">("manual")
  const [error, setError] = useState("")
  const update = (field: keyof EventDraft, value: string) => setForm((current) => ({ ...current, [field]: value }))
  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    if (!form.title.trim() || !form.category.trim() || !form.description.trim()) { setError("Add a title, category, and description before saving."); return }
    onSaved({ ...form, id: initial?.id ?? crypto.randomUUID(), status: "Draft", updatedAt: new Date().toISOString(), source: mode === "source" ? "Source document" : "Manual entry" })
    setError("")
  }
  const fields: Array<[keyof EventDraft, string, string]> = [["title", "Title", "e.g. Build Your First Web App"], ["category", "Category", "Technical workshop"], ["description", "Description", "What should students know?"], ["startDate", "Date", "2026-10-18"], ["startTime", "Time", "16:00"], ["venue", "Venue", "Innovation Lab"], ["eligibility", "Audience", "All interested students"], ["registrationDeadline", "Registration deadline", "Optional"]]
  return <section className="club-page club-create-page"><div className="club-page-heading compact"><div><p className="club-eyebrow">CREATE CAMPUS UPDATE</p><h1>Start with the source.</h1><p>Build an editable local draft. Nothing is sent to a backend or published from this screen.</p></div></div><div className="club-create-switch"><button type="button" className={mode === "manual" ? "is-active" : ""} onClick={() => setMode("manual")}><Pencil size={16} /> Create manually</button><button type="button" className={mode === "source" ? "is-active" : ""} onClick={() => setMode("source")}><FileImage size={16} /> Upload source document</button></div>{mode === "source" && <div className="club-source-drop"><FileImage size={25} /><strong>Choose a poster or notice</strong><span>JPEG, PNG, or WebP · 10 MB maximum · illustrative local preview</span><button type="button" onClick={() => go("/poster-to-event")}>Open poster extraction demo <ArrowUpRight size={15} /></button></div>}<form className="club-update-form" onSubmit={submit}><div className="club-form-grid">{fields.map(([field, label, placeholder]) => <label key={field} className={field === "description" ? "is-wide" : ""}>{label}{field === "description" ? <textarea value={form[field]} placeholder={placeholder} onChange={(event) => update(field, event.target.value)} /> : <input type={field.includes("Date") || field === "startDate" ? "date" : field === "startTime" ? "time" : "text"} value={form[field]} placeholder={placeholder} onChange={(event) => update(field, event.target.value)} />}</label>)}</div>{error && <p className="club-form-error" role="alert"><X size={15} />{error}</p>}<div className="club-form-footer"><span>Required for this prototype: title, category, description.</span><button className="club-primary-action" type="submit"><Check size={16} /> Save draft</button></div></form></section>
}

function DraftsPage({ drafts, onOpen, onDelete }: { drafts: ClubDraft[]; onOpen: (id: string) => void; onDelete: (id: string) => void }) {
  const [query, setQuery] = useState("")
  const filtered = drafts.filter((draft) => `${draft.title} ${draft.category}`.toLowerCase().includes(query.toLowerCase()))
  return <section className="club-page"><div className="club-page-heading compact"><div><p className="club-eyebrow">LOCAL DRAFTS · {drafts.length}</p><h1>Keep the work<br />in motion.</h1><p>Drafts are stored in this browser only and remain editable until the next step is built.</p></div><button className="club-primary-action" type="button" onClick={() => go("/club/create")}><Plus size={17} /> Create campus update</button></div><label className="club-draft-search"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search drafts by title or category" /></label><div className="club-draft-list">{filtered.map((draft) => <DraftRow key={draft.id} draft={draft} onOpen={() => onOpen(draft.id)} onDelete={() => onDelete(draft.id)} />)}</div>{!filtered.length && <div className="club-empty-state"><FileText size={26} /><h2>{drafts.length ? "No drafts match that search." : "No drafts yet."}</h2><p>Create a local draft to see it here.</p></div>}</section>
}

function PublishedPage() {
  return <section className="club-page"><div className="club-page-heading compact"><div><p className="club-eyebrow">PUBLISHED DEMOS</p><h1>Nothing published<br />yet.</h1><p>Only updates that complete the future simulated approval flow will appear here.</p></div></div><div className="club-empty-state club-published-empty"><Check size={27} /><h2>The publication shelf is intentionally empty.</h2><p>Milestone 4B will add the approval gate and local simulated publication.</p><button type="button" onClick={() => go("/club/create")}>Create a draft instead <ArrowUpRight size={15} /></button></div></section>
}

function ProfilePage() {
  const [profile, setProfile] = useState<ClubProfile>(() => read(PROFILE_KEY, defaultProfile))
  const [saved, setSaved] = useState(false)
  const update = (field: keyof ClubProfile, value: string) => setProfile((current) => ({ ...current, [field]: value }))
  return <section className="club-page"><div className="club-page-heading compact"><div><p className="club-eyebrow">CLUB IDENTITY · LOCAL DEMO</p><h1>Make the club<br />feel clear.</h1><p>These details stay in this browser. This demo does not grant publisher permissions or official verification.</p></div></div><form className="club-profile-form" onSubmit={(event) => { event.preventDefault(); localStorage.setItem(PROFILE_KEY, JSON.stringify(profile)); setSaved(true); window.setTimeout(() => setSaved(false), 1800) }}><label>Club display name<input value={profile.name} onChange={(event) => update("name", event.target.value)} required /></label><label>Description<textarea value={profile.description} onChange={(event) => update("description", event.target.value)} /></label><div className="club-form-grid"><label>Club category<input value={profile.category} onChange={(event) => update("category", event.target.value)} /></label><label>Contact (optional demo value)<input value={profile.contact} onChange={(event) => update("contact", event.target.value)} /></label><label>Relevant departments<input value={profile.departments} onChange={(event) => update("departments", event.target.value)} /></label><label>Campus identifier<input value={profile.campusId} onChange={(event) => update("campusId", event.target.value)} /></label></div><div className="club-form-footer"><span>Demo identity · not officially verified</span><button className="club-primary-action" type="submit">{saved ? "Saved" : "Save profile"} <Check size={16} /></button></div></form></section>
}

export default function ClubWorkspace() {
  const [route, setRoute] = useState<ClubRoute>(routeFromPath)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [drafts, setDrafts] = useState<ClubDraft[]>(() => read(DRAFTS_KEY, []))
  const [activity, setActivity] = useState<ClubActivity[]>(() => read(ACTIVITY_KEY, []))
  const [editingId, setEditingId] = useState<string | undefined>()
  const reducedMotion = useReducedMotion() ?? false
  useEffect(() => { const sync = () => setRoute(routeFromPath()); window.addEventListener("popstate", sync); return () => window.removeEventListener("popstate", sync) }, [])
  const recordActivity = (item: Omit<ClubActivity, "id" | "createdAt">) => { addActivity(item); setActivity((current) => [{ ...item, id: crypto.randomUUID(), createdAt: new Date().toISOString() }, ...current].slice(0, 8)) }
  const persistDraft = (draft: ClubDraft) => { const isExisting = drafts.some((item) => item.id === draft.id); const next = isExisting ? drafts.map((item) => item.id === draft.id ? draft : item) : [draft, ...drafts]; setDrafts(next); saveDrafts(next); recordActivity({ label: isExisting ? "Draft updated" : "Draft created", detail: draft.title || "Untitled campus update" }); setRoute("drafts"); go("/club/drafts") }
  const deleteDraft = (id: string) => { if (!window.confirm("Delete this local draft?")) return; const removed = drafts.find((draft) => draft.id === id); const next = drafts.filter((draft) => draft.id !== id); setDrafts(next); saveDrafts(next); if (removed) recordActivity({ label: "Draft deleted", detail: removed.title || "Untitled campus update" }) }
  const editing = useMemo(() => drafts.find((draft) => draft.id === editingId), [drafts, editingId])
  return <div className="club-app"><ClubNav route={route} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} /><main className="club-main"><WorkspaceHeader route={route} onMenu={() => setMobileOpen(true)} /><AnimatePresence mode="wait" initial={false}><motion.div key={route} initial={reducedMotion ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={reducedMotion ? undefined : { opacity: 0 }} transition={{ duration: reducedMotion ? 0 : 0.22 }}>{route === "overview" && <Overview drafts={drafts} activity={activity} onCreate={() => go("/club/create")} onOpenDraft={(id) => { setEditingId(id); go("/club/create") }} />}{route === "create" && <CreatePage initial={editing} onSaved={persistDraft} />}{route === "drafts" && <DraftsPage drafts={drafts} onOpen={(id) => { setEditingId(id); go("/club/create") }} onDelete={deleteDraft} />}{route === "published" && <PublishedPage />}{route === "profile" && <ProfilePage />}</motion.div></AnimatePresence></main></div>
}
