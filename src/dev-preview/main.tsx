import React, { useMemo, useState } from "react"
import ReactDOM from "react-dom/client"
import "../index.css"
import AskCampus from "../ai/components/AskCampus"
import PosterExtraction, { ExtractionFlags } from "../ai/components/PosterExtraction"
import type { ExtractPosterResponse } from "../ai/contracts"
import AssignmentsPage from "../assignments/components/AssignmentsPage"
import type { AssignmentErrorCode } from "../assignments/contracts"
import { AI_ERROR_CODES, fakeAssignmentService, fakeDiscoverService, fakeExtractService } from "./fakes"
import type { AssignmentFakeOptions } from "./fakes"

// Development-only harness: /dev-preview.html?c=<component>&s=<scenario>. It renders the AI
// and assignments components against fake services, inside the same wrappers the real
// screens use, so every state can be looked at without touching the app's routes.

const params = new URLSearchParams(window.location.search)
const component = params.get("c") ?? ""
const scenario = params.get("s") ?? ""

// ------------------------------------------------------------------ poster extraction

// A 1x1 PNG, so FileReader has real bytes to read.
const PNG_BYTES = Uint8Array.from(atob("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=="), (char) => char.charCodeAt(0))

const files: Record<string, () => File> = {
  a: () => new File([PNG_BYTES], "freshers-workshop-poster.png", { type: "image/png" }),
  b: () => new File([PNG_BYTES], "robotics-club-open-day-final-v3.jpg", { type: "image/jpeg" }),
  big: () => new File([new Uint8Array(5 * 1024 * 1024 + 300 * 1024)], "poster-print-resolution.png", { type: "image/png" }),
  pdf: () => new File([PNG_BYTES], "notice.pdf", { type: "application/pdf" }),
}

type PosterScenario = { plan: string[]; file: string | null; disabled?: boolean }

const posterScenarios: Record<string, PosterScenario> = {
  "no-file": { plan: ["success"], file: null },
  ready: { plan: ["success"], file: "a" },
  disabled: { plan: ["success"], file: "a", disabled: true },
  loading: { plan: ["hang"], file: "a" },
  success: { plan: ["success"], file: "a" },
  flags: { plan: ["flags"], file: "a" },
  sparse: { plan: ["sparse"], file: "a" },
  nothing: { plan: ["nothing"], file: "a" },
  long: { plan: ["long"], file: "b" },
  "local-too-large": { plan: ["success"], file: "big" },
  "local-wrong-type": { plan: ["success"], file: "pdf" },
  retry: { plan: ["network", "success"], file: "a" },
  swap: { plan: ["slow:success", "flags"], file: "a" },
  ...Object.fromEntries(AI_ERROR_CODES.map((code) => [`error-${code}`, { plan: [code], file: "a" }])),
}

function PosterPreview({ config }: { config: PosterScenario }) {
  const [file, setFile] = useState<File | null>(() => (config.file ? files[config.file]() : null))
  const [received, setReceived] = useState<ExtractPosterResponse[]>([])
  const [calls, setCalls] = useState(0)
  const service = useMemo(() => fakeExtractService(config.plan, 700, () => setCalls((count) => count + 1)), [config])
  return (
    <div className="club-app">
      <section className="club-page club-create-page">
        <div className="club-page-heading compact"><div><p className="club-eyebrow">CREATE CAMPUS UPDATE · PREVIEW HARNESS</p><h1>Start with the source.</h1></div></div>
        <div className="club-create-layout" style={{ marginTop: "2rem" }}>
          <div className="club-create-source">
            <div className="club-section-title"><span>01</span><h2>Source document</h2></div>
            <div className="club-document-preview"><div className="club-document-toolbar"><span>SOURCE DOCUMENT</span><span>Preview only</span></div><div style={{ height: "9rem", display: "grid", placeItems: "center", color: "#806f81", fontSize: ".75rem" }}>{file ? file.name : "No image chosen"}</div></div>
            <div className="club-source-actions">
              <label className="club-upload-button">Choose image<input data-testid="file-input" type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
              <button type="button" onClick={() => setFile(files.a())}>Poster A</button>
              <button type="button" onClick={() => setFile(files.b())}>Poster B</button>
              <button type="button" onClick={() => setFile(null)}>Remove</button>
            </div>
            <PosterExtraction clubId="preview-club" file={file} disabled={config.disabled} service={service} onExtracted={(result) => setReceived((current) => [...current, result])} />
          </div>
          <form className="club-update-form club-create-form" onSubmit={(event) => event.preventDefault()}>
            <div className="club-section-title"><span>02</span><h2>Structured update</h2></div>
            <div className="club-form-grid">
              <label>Title<input readOnly value={received[received.length - 1]?.values.title ?? ""} /></label>
              <label>Venue<input readOnly value={received[received.length - 1]?.values.venue ?? ""} /></label>
            </div>
            <p className="club-source-note" data-testid="harness-log">onExtracted calls: <b data-testid="extracted-count">{received.length}</b> · service calls: <b data-testid="service-calls">{calls}</b></p>
          </form>
        </div>
      </section>
    </div>
  )
}

function FlagsPreview() {
  return (
    <div className="club-app">
      <section className="club-page club-review-page">
        <div className="club-review-layout">
          <div />
          <div className="club-review-fields">
            <div className="club-review-field-head"><div><span>EXTRACTED INFORMATION</span><h2>Structured campus update</h2></div></div>
            <ExtractionFlags
              flags={[
                { field: "startDate", reason: "The poster says 05/06/2026, which could be 5 June or 6 May. 5 June was used; change it if that is wrong." },
                { field: "registrationUrl", reason: "The link printed on the poster was not a valid web address, so it was removed." },
              ]}
              fieldLabels={{ startDate: "Event date (custom label)" }}
            />
            <label>Title<input readOnly value="Build Your First Web App" /></label>
            <div style={{ marginTop: "1.5rem" }}><ExtractionFlags flags={[{ field: "venue", reason: "Two rooms are named on the poster." }]} /></div>
            <p className="club-source-note">Below: no flags renders nothing.</p>
            <ExtractionFlags flags={[]} />
          </div>
        </div>
      </section>
    </div>
  )
}

// ------------------------------------------------------------------ ask

type AskScenario = { plan: string[]; signedIn?: boolean; suggestions?: string[] | null }

const askScenarios: Record<string, AskScenario> = {
  "signed-out": { plan: ["success"], signedIn: false },
  idle: { plan: ["success"] },
  "no-suggestions": { plan: ["success"], suggestions: [] },
  loading: { plan: ["hang"] },
  success: { plan: ["success"] },
  empty: { plan: ["empty"] },
  long: { plan: ["long"] },
  retry: { plan: ["network", "success"] },
  "then-loading": { plan: ["success", "hang"] },
  "then-error": { plan: ["success", "rate_limited"] },
  race: { plan: ["slow:success", "second"] },
  ...Object.fromEntries(AI_ERROR_CODES.map((code) => [`error-${code}`, { plan: [code] }])),
}

function StudentFrame({ children }: { children: React.ReactNode }) {
  return <div className="student-app"><main className="student-main" style={{ marginLeft: 0 }}>{children}</main></div>
}

function AskPreview({ config }: { config: AskScenario }) {
  const [signedIn, setSignedIn] = useState(config.signedIn ?? true)
  const [log, setLog] = useState<string[]>([])
  const service = useMemo(() => fakeDiscoverService(config.plan, 700, (query) => setLog((current) => [...current, `discover: ${query}`])), [config])
  return (
    <StudentFrame>
      <section className="student-page">
        <AskCampus
          signedIn={signedIn}
          onSignIn={() => { setLog((current) => [...current, "onSignIn"]); setSignedIn(true) }}
          onOpenItem={(id, path) => setLog((current) => [...current, `open: ${id} ${path}`])}
          service={service}
          suggestions={config.suggestions === null ? undefined : config.suggestions}
        />
        <pre data-testid="harness-log" style={{ marginTop: "3rem", color: "#806f81", fontSize: ".7rem", whiteSpace: "pre-wrap" }}>{log.join("\n")}</pre>
      </section>
    </StudentFrame>
  )
}

// ------------------------------------------------------------------ assignments

type AssignmentsScenario = AssignmentFakeOptions & { signedIn?: boolean }

const assignmentErrors: AssignmentErrorCode[] = ["not_configured", "not_signed_in", "not_set_up", "network", "unknown"]

const assignmentsScenarios: Record<string, AssignmentsScenario> = {
  "signed-out": { signedIn: false },
  loading: { list: ["hang"] },
  empty: { list: ["empty"] },
  list: {},
  // StrictMode mounts twice in development, so the first two list calls belong to the first load.
  "retry-load": { list: ["network", "network", "ok"] },
  "fail-status": { update: ["network", "ok"] },
  "fail-edit": { update: ["invalid"] },
  "fail-create": { failCreate: "network" },
  "fail-delete": { failRemove: "network" },
  slow: { delay: 2500 },
  ...Object.fromEntries(assignmentErrors.map((code) => [`load-${code}`, { list: [code] }])),
}

function AssignmentsPreview({ config }: { config: AssignmentsScenario }) {
  const [signedIn, setSignedIn] = useState(config.signedIn ?? true)
  const service = useMemo(() => fakeAssignmentService(config), [config])
  return (
    <StudentFrame>
      <AssignmentsPage signedIn={signedIn} email={signedIn ? "preview.student@example.edu" : null} onSignIn={() => setSignedIn(true)} service={service} />
    </StudentFrame>
  )
}

// ------------------------------------------------------------------ index

const sections: Array<[string, string, string[]]> = [
  ["poster", "PosterExtraction", Object.keys(posterScenarios)],
  ["flags", "ExtractionFlags", ["standalone"]],
  ["ask", "AskCampus", Object.keys(askScenarios)],
  ["assignments", "AssignmentsPage", Object.keys(assignmentsScenarios)],
]

function Index() {
  return (
    <main style={{ maxWidth: "60rem", margin: "0 auto", padding: "2rem 1.25rem", fontSize: ".9rem", lineHeight: 1.6 }}>
      <h1 style={{ fontSize: "1.4rem", fontWeight: 800 }}>UniFlow component preview</h1>
      <p style={{ color: "#57505e" }}>Development only. Every service here is a fake; nothing reaches Supabase or an AI model.</p>
      {sections.map(([key, title, names]) => (
        <section key={key} style={{ marginTop: "1.5rem" }}>
          <h2 style={{ fontWeight: 800 }}>{title}</h2>
          <ul style={{ display: "flex", flexWrap: "wrap", gap: ".4rem 1rem", padding: 0, listStyle: "none" }}>
            {names.map((name) => <li key={name}><a style={{ color: "#7c429c", textDecoration: "underline" }} href={`?c=${key}&s=${name}`}>{name}</a></li>)}
          </ul>
        </section>
      ))}
    </main>
  )
}

function Preview() {
  if (component === "poster" && posterScenarios[scenario]) return <PosterPreview config={posterScenarios[scenario]} />
  if (component === "flags") return <FlagsPreview />
  if (component === "ask" && askScenarios[scenario]) return <AskPreview config={askScenarios[scenario]} />
  if (component === "assignments" && assignmentsScenarios[scenario]) return <AssignmentsPreview config={assignmentsScenarios[scenario]} />
  return <Index />
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Preview />
  </React.StrictMode>,
)
