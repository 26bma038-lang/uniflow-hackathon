import { useEffect, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import {
  ArrowLeft,
  ArrowUpRight,
  Check,
  FileText,
  Home,
  Sparkles,
  Users,
} from "lucide-react"
import { enterDemo, exitDemo, type DemoRole } from "../demo-session"

type EntryRoute = "roles" | "student" | "club" | "club-overview"

function navigate(path: string) {
  window.history.pushState({}, "", path)
  window.dispatchEvent(new PopStateEvent("popstate"))
  window.scrollTo({ top: 0, behavior: "smooth" })
}

function EntryShell({
  children,
  eyebrow,
  title,
  description,
}: {
  children: React.ReactNode
  eyebrow: string
  title: React.ReactNode
  description: string
}) {
  const reducedMotion = useReducedMotion() ?? false
  return (
    <div className="entry-page">
      <header className="entry-header">
        <a href="/" onClick={(event) => { event.preventDefault(); navigate("/") }} className="entry-logo">
          <span className="entry-logo-mark">U</span>
          UniFlow
        </a>
        <span className="entry-header-note">STUDENT + CLUB DEMO</span>
      </header>
      <main className="entry-main">
        <motion.div
          className="entry-heading"
          initial={reducedMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.35 }}
        >
          <p className="entry-eyebrow">{eyebrow}</p>
          <h1>{title}</h1>
          <p>{description}</p>
        </motion.div>
        {children}
      </main>
      <footer className="entry-footer">
        <span>Frontend-only prototype · no real authentication</span>
        <a href="/" onClick={(event) => { event.preventDefault(); navigate("/") }}>Return to UniFlow <ArrowUpRight size={15} /></a>
      </footer>
    </div>
  )
}

function RoleCard({
  role,
  title,
  description,
  action,
  onClick,
  preview,
}: {
  role: DemoRole
  title: string
  description: string
  action: string
  onClick: () => void
  preview: React.ReactNode
}) {
  return (
    <motion.button
      type="button"
      className={`entry-role-card entry-role-${role}`}
      onClick={onClick}
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.985 }}
    >
      <span className="entry-role-number">{role === "student" ? "01" : "02"}</span>
      <span className="entry-role-icon">{role === "student" ? <Sparkles size={28} /> : <Users size={28} />}</span>
      <span className="entry-role-title">{title}</span>
      <span className="entry-role-description">{description}</span>
      <span className="entry-role-preview">{preview}</span>
      <span className="entry-role-action">{action} <ArrowUpRight size={18} /></span>
    </motion.button>
  )
}

function StudentPreview() {
  return (
    <span className="entry-student-preview">
      <span className="entry-preview-topline"><b>Today & Soon</b><small>For Alex · 4 items</small></span>
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
  )
}

function PublisherPreview({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`entry-publisher-preview ${compact ? "is-compact" : ""}`}>
      <span className="entry-preview-topline"><b>Source → structured draft</b><small>Illustrative only</small></span>
      <span className="entry-publisher-columns">
        <span className="entry-mini-document"><small>WORKSHOP BRIEF</small><b>Build Your<br />First Web App</b><span>18 OCT · 4 PM</span></span>
        <span className="entry-mini-fields"><span><small>TITLE</small><b>Build Your First Web App</b></span><span><small>VENUE</small><b>Innovation Lab</b></span><span><small>STATUS</small><b>Needs human review</b></span></span>
      </span>
    </span>
  )
}

function RoleSelection() {
  return (
    <EntryShell
      eyebrow="WELCOME TO UNIFLOW"
      title={<>Choose your way<br />into campus life.</>}
      description="A calmer place for the notices, opportunities, and updates that shape your week."
    >
      <div className="entry-role-grid">
        <RoleCard
          role="student"
          title="I’m a student"
          description="Discover campus notices, deadlines, scholarships, events, and opportunities."
          action="Continue as Student"
          onClick={() => navigate("/login/student")}
          preview={<StudentPreview />}
        />
        <RoleCard
          role="club"
          title="I’m a club organizer"
          description="Transform campus notices and posters into structured, reviewed campus updates."
          action="Continue as Club"
          onClick={() => navigate("/login/club")}
          preview={<PublisherPreview />}
        />
      </div>
      <p className="entry-disclaimer"><Check size={15} /> Both paths are local demos. Nothing here verifies identity or publisher permissions.</p>
    </EntryShell>
  )
}

function DemoLogin({ role }: { role: DemoRole }) {
  const isStudent = role === "student"
  return (
    <EntryShell
      eyebrow={isStudent ? "STUDENT ENTRY" : "CLUB ORGANIZER ENTRY"}
      title={isStudent ? "Your campus starts here." : "Bring your campus updates to life."}
      description={isStudent ? "Discover what matters, all in one place." : "Prepare, review, and publish information for your campus community."}
    >
      <div className={`entry-login-layout entry-login-${role}`}>
        <div className="entry-login-preview">
          {isStudent ? <StudentPreview /> : <PublisherPreview />}
        </div>
        <div className="entry-login-panel">
          <div className="entry-role-pill">{isStudent ? <Sparkles size={15} /> : <Users size={15} />} {isStudent ? "Student demo" : "Club demo"}</div>
          <h2>{isStudent ? "Welcome to your campus." : "From poster to campus update."}</h2>
          <p>This is a frontend-only demo. No passwords, email addresses, or real permissions are collected.</p>
          <button type="button" className="entry-primary-action" onClick={() => { enterDemo(role); navigate(isStudent ? "/app/today" : "/club/overview") }}>
            Continue as Demo {isStudent ? "Student" : "Club"} <ArrowUpRight size={17} />
          </button>
          <div className="entry-login-links">
            <button type="button" onClick={() => navigate(isStudent ? "/login/club" : "/login/student")}>Switch to {isStudent ? "club" : "student"} entry</button>
            <button type="button" onClick={() => navigate("/get-started")}><ArrowLeft size={15} /> Back to role selection</button>
          </div>
        </div>
      </div>
    </EntryShell>
  )
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
  useEffect(() => {
    const sync = () => {
      const path = window.location.pathname
      setCurrentRoute(path === "/login/student" ? "student" : path === "/login/club" ? "club" : path === "/club/overview" ? "club-overview" : "roles")
    }
    window.addEventListener("popstate", sync)
    return () => window.removeEventListener("popstate", sync)
  }, [])

  return (
    <AnimatePresence mode="wait">
      <motion.div key={currentRoute} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
        {currentRoute === "roles" && <RoleSelection />}
        {currentRoute === "student" && <DemoLogin role="student" />}
        {currentRoute === "club" && <DemoLogin role="club" />}
        {currentRoute === "club-overview" && <ClubOverview />}
      </motion.div>
    </AnimatePresence>
  )
}
