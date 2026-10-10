import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { CalendarClock, Check, CircleAlert, ClipboardList, Lock, Pencil, Plus, Trash2, X } from "lucide-react"
import { assignmentService } from "../api"
import { ASSIGNMENT_STATUSES } from "../contracts"
import type { Assignment, AssignmentError, AssignmentErrorCode, AssignmentInput, AssignmentResult, AssignmentService, AssignmentStatus } from "../contracts"
import AssignmentForm, { STATUS_LABELS } from "./AssignmentForm"
import { bucketOf, formatMoment, relativeDue, SOON_DAYS } from "./dates"
import type { Bucket } from "./dates"
import styles from "./AssignmentsPage.module.css"

type AssignmentsPageProps = {
  signedIn: boolean
  email: string | null
  onSignIn: () => void
  service?: AssignmentService
}

type Load = { status: "loading" } | { status: "ready" } | { status: "error"; code: AssignmentErrorCode }
type Filter = "open" | "done" | "all"

const GROUPS: Array<{ bucket: Bucket; title: string; note: string }> = [
  { bucket: "overdue", title: "Overdue", note: "Past the due time and not marked done." },
  { bucket: "soon", title: "Due soon", note: `Due in the next ${SOON_DAYS} days.` },
  { bucket: "later", title: "Later", note: `Due more than ${SOON_DAYS} days from now.` },
  { bucket: "none", title: "No due date", note: "Nothing to count down to." },
  { bucket: "done", title: "Done", note: "Most recently finished first." },
]

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "open", label: "Open" },
  { key: "done", label: "Done" },
  { key: "all", label: "All" },
]

// What went wrong, in terms of what the student was doing. `doing` reads as "couldn't …".
function actionProblem(doing: string, error: AssignmentError) {
  switch (error.code) {
    case "not_signed_in":
      return `Couldn’t ${doing}: your session has ended. Sign in again, then retry.`
    case "network":
      return `Couldn’t ${doing}: the server couldn’t be reached. Check your connection and try again.`
    case "not_found":
      return `Couldn’t ${doing}: this assignment no longer exists. It may have been deleted in another tab.`
    case "invalid":
      return `Couldn’t ${doing}: the server didn’t accept those details.${error.message ? ` ${error.message}` : ""}`
    case "not_set_up":
      return `Couldn’t ${doing}: assignments aren’t set up on the server yet.`
    case "not_configured":
      return `Couldn’t ${doing}: assignments aren’t connected in this build.`
    default:
      return `Couldn’t ${doing}. Something went wrong on the server. Try again.`
  }
}

// A service that throws is treated the same as one that reports a network failure.
async function attempt<T>(call: () => Promise<AssignmentResult<T>>): Promise<AssignmentResult<T>> {
  try {
    return await call()
  } catch {
    return { ok: false, error: { code: "network", message: "" } }
  }
}

function byDue(a: Assignment, b: Assignment) {
  return (a.dueAt ?? "").localeCompare(b.dueAt ?? "") || a.createdAt.localeCompare(b.createdAt)
}

function sortBucket(bucket: Bucket, entries: Assignment[]) {
  if (bucket === "done") return [...entries].sort((a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt))
  if (bucket === "none") return [...entries].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  return [...entries].sort((a, b) => new Date(a.dueAt ?? 0).getTime() - new Date(b.dueAt ?? 0).getTime() || byDue(a, b))
}

function AssignmentsPage({ signedIn, email, onSignIn, service = assignmentService }: AssignmentsPageProps) {
  const [items, setItems] = useState<Assignment[]>([])
  const [load, setLoad] = useState<Load>({ status: "loading" })
  const [reloadToken, setReloadToken] = useState(0)
  const [filter, setFilter] = useState<Filter>("open")
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [deleteProblem, setDeleteProblem] = useState("")
  // Rows with a status change on its way to the server.
  const [saving, setSaving] = useState<string[]>([])
  const [problem, setProblem] = useState("")
  const [confirmation, setConfirmation] = useState("")
  const [now, setNow] = useState(() => Date.now())

  const rootRef = useRef<HTMLElement>(null)
  const listHeadingRef = useRef<HTMLHeadingElement>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)
  // After a change re-renders the list, where the keyboard focus should land.
  const focusNext = useRef<{ row?: string; control?: string; fallback?: "list" | "add" } | null>(null)

  // Everything here belongs to one account. A reply that arrives after the account changed,
  // or after the page was left, is for a list that is no longer on screen.
  const session = useRef(0)
  useEffect(() => {
    const mine = ++session.current
    setItems([])
    setAdding(false)
    setEditingId(null)
    setConfirmingId(null)
    setSaving([])
    setProblem("")
    setConfirmation("")
    if (!signedIn) return
    setLoad({ status: "loading" })
    attempt(() => service.list()).then((result) => {
      if (mine !== session.current) return
      if (result.ok) {
        setItems(result.value)
        setLoad({ status: "ready" })
      } else {
        setLoad({ status: "error", code: result.error.code })
      }
    })
    return () => { session.current += 1 }
  }, [signedIn, email, service, reloadToken])

  // Keeps "overdue" and "in 3 hours" true while the page stays open.
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    if (!confirmation) return
    const timer = window.setTimeout(() => setConfirmation(""), 5000)
    return () => window.clearTimeout(timer)
  }, [confirmation])

  useLayoutEffect(() => {
    const target = focusNext.current
    if (!target) return
    focusNext.current = null
    const root = rootRef.current
    const control = target.row && target.control ? root?.querySelector<HTMLElement>(`[data-row="${CSS.escape(target.row)}"] [data-control="${target.control}"]`) : null
    if (control) control.focus()
    else if (target.fallback === "add" && addButtonRef.current) addButtonRef.current.focus()
    else listHeadingRef.current?.focus()
  })

  const reload = () => setReloadToken((value) => value + 1)
  const say = (text: string) => { setProblem(""); setConfirmation(text) }
  const name = (item: Assignment) => `“${item.title}”`

  const create = async (input: AssignmentInput) => {
    const mine = session.current
    const result = await attempt(() => service.create(input))
    if (mine !== session.current) return null
    if (!result.ok) return actionProblem("add this assignment", result.error)
    setItems((current) => [result.value, ...current.filter((entry) => entry.id !== result.value.id)])
    // Make sure the new row is in view of the current filter.
    if (filter === "done" && result.value.status !== "done") setFilter("open")
    say(`Added ${name(result.value)}.`)
    return null
  }

  const saveEdit = async (item: Assignment, input: AssignmentInput) => {
    const mine = session.current
    const result = await attempt(() => service.update(item.id, input))
    if (mine !== session.current) return null
    if (!result.ok) {
      if (result.error.code === "not_found") reload()
      return actionProblem("save these changes", result.error)
    }
    setItems((current) => current.map((entry) => (entry.id === item.id ? result.value : entry)))
    setEditingId(null)
    focusNext.current = { row: item.id, control: "edit", fallback: "list" }
    say(`Saved changes to ${name(result.value)}.`)
    return null
  }

  // Shown at once, then confirmed or undone by the server's answer.
  const changeStatus = async (item: Assignment, status: AssignmentStatus, control: "tick" | "status") => {
    if (item.status === status || saving.includes(item.id)) return
    const mine = session.current
    const before = item
    setSaving((current) => [...current, item.id])
    setProblem("")
    setItems((current) => current.map((entry) => (entry.id === item.id ? { ...entry, status, completedAt: status === "done" ? entry.completedAt ?? new Date().toISOString() : null } : entry)))
    focusNext.current = { row: item.id, control, fallback: "list" }
    const result = await attempt(() => service.update(item.id, { status }))
    if (mine !== session.current) return
    setSaving((current) => current.filter((entry) => entry !== item.id))
    if (result.ok) {
      setItems((current) => current.map((entry) => (entry.id === item.id ? result.value : entry)))
      say(`${name(result.value)} marked ${STATUS_LABELS[result.value.status].toLowerCase()}.`)
      return
    }
    setItems((current) => current.map((entry) => (entry.id === item.id ? before : entry)))
    setConfirmation("")
    setProblem(`${actionProblem(`mark ${name(item)} ${STATUS_LABELS[status].toLowerCase()}`, result.error)} It’s back to ${STATUS_LABELS[before.status].toLowerCase()}.`)
    if (result.error.code === "not_found") reload()
  }

  const remove = async (item: Assignment) => {
    if (deleting) return
    const mine = session.current
    setDeleting(item.id)
    setDeleteProblem("")
    const result = await attempt(() => service.remove(item.id))
    if (mine !== session.current) return
    setDeleting(null)
    if (!result.ok && result.error.code !== "not_found") {
      setDeleteProblem(actionProblem(`delete ${name(item)}`, result.error))
      return
    }
    // Already gone on the server counts as deleted.
    setItems((current) => current.filter((entry) => entry.id !== item.id))
    setConfirmingId(null)
    focusNext.current = { fallback: "list" }
    say(`Deleted ${name(item)}.`)
  }

  const counts = useMemo(() => {
    const done = items.filter((entry) => entry.status === "done").length
    return { open: items.length - done, done, all: items.length }
  }, [items])

  const groups = useMemo(() => {
    return GROUPS.map((group) => ({ ...group, entries: sortBucket(group.bucket, items.filter((entry) => bucketOf(entry, now) === group.bucket)) })).filter(
      (group) => group.entries.length > 0 && (filter === "all" || (filter === "done" ? group.bucket === "done" : group.bucket !== "done")),
    )
  }, [items, now, filter])

  const openAdd = () => {
    setAdding(true)
  }
  const closeAdd = () => {
    setAdding(false)
    focusNext.current = { fallback: "add" }
  }

  const heading = (
    <div className="student-page-heading">
      <div>
        <p className="student-eyebrow">YOUR COURSEWORK{load.status === "ready" && signedIn ? ` · ${counts.open} OPEN` : ""}</p>
        <h1>Keep coursework on track.</h1>
        <p>
          {signedIn
            ? "A private list of the assignments you’re working on, with their due dates. You add them yourself; nothing here comes from a course system."
            : "Track your own assignments and due dates in a list only you can see."}
        </p>
      </div>
    </div>
  )

  const privacy = (
    <p className={styles.privacy}>
      <Lock size={15} aria-hidden="true" />
      <span>
        <strong>Private to your account.</strong> {email ? <>Only <span className={styles.email}>{email}</span> can see or change this list.</> : "Only you can see or change this list."} Clubs, other students, and the campus feed never see it.
      </span>
    </p>
  )

  if (!signedIn) {
    return (
      <section className="student-page">
        {heading}
        <div className="student-empty-state">
          <ClipboardList size={25} aria-hidden="true" />
          <h2>You’re not signed in.</h2>
          <p>Assignments are kept privately under your own account, so you need to sign in first.</p>
          <button type="button" onClick={onSignIn}>Sign in</button>
        </div>
      </section>
    )
  }

  if (load.status === "loading") {
    return (
      <section className="student-page" aria-busy="true">
        {heading}
        {privacy}
        <p className={styles.loadingText} role="status" aria-live="polite">Loading your assignments…</p>
        <div className={styles.skeleton} aria-hidden="true"><span /><span /><span /></div>
      </section>
    )
  }

  if (load.status === "error") {
    const setUp = load.code === "not_set_up"
    const notConnected = load.code === "not_configured"
    const expired = load.code === "not_signed_in"
    return (
      <section className="student-page">
        {heading}
        <div className="student-empty-state" role={setUp || notConnected ? "status" : "alert"}>
          {setUp || notConnected ? <ClipboardList size={25} aria-hidden="true" /> : <CircleAlert size={25} aria-hidden="true" />}
          <h2>
            {setUp ? "Assignments aren’t set up yet." : notConnected ? "Assignments aren’t connected." : expired ? "Your session has ended." : "Your assignments couldn’t be loaded."}
          </h2>
          <p>
            {setUp
              ? "The assignments table hasn’t been created on this UniFlow server yet, which is normal on a first run. There is no list to show, and nothing of yours has been lost. Whoever runs this UniFlow needs to finish the setup."
              : notConnected
                ? "This build of UniFlow isn’t connected to a server, so assignments can’t be saved or shown here."
                : expired
                  ? "Sign in again to see your assignments. They’re still saved under your account."
                  : load.code === "network"
                    ? "The server couldn’t be reached. Check your connection and try again. Your assignments are still saved."
                    : "Something went wrong while reading your list. Try again in a moment."}
          </p>
          {expired ? <button type="button" onClick={onSignIn}>Sign in again</button> : <button type="button" onClick={reload}>{setUp || notConnected ? "Check again" : "Try again"}</button>}
        </div>
      </section>
    )
  }

  const nothingYet = items.length === 0

  return (
    <section ref={rootRef} className="student-page">
      {heading}
      {privacy}

      <div className={styles.layout}>
        {!nothingYet && (
          <div className={styles.toolbar}>
            <div className={styles.filters} role="group" aria-label="Show assignments">
              {FILTERS.map((entry) => (
                <button key={entry.key} type="button" aria-pressed={filter === entry.key} onClick={() => setFilter(entry.key)}>
                  {entry.label} <span>{counts[entry.key]}</span>
                </button>
              ))}
            </div>
            {!adding && (
              <button ref={addButtonRef} type="button" className={styles.primary} onClick={openAdd}>
                <Plus size={16} aria-hidden="true" /> Add assignment
              </button>
            )}
          </div>
        )}

        {adding && (
          <div className={styles.panel}>
            <AssignmentForm heading="Add an assignment" submitLabel="Add assignment" busyLabel="Adding…" cancelLabel="Close" onSubmit={create} onCancel={closeAdd} />
          </div>
        )}

        {problem && (
          <div className={styles.problem} role="alert">
            <CircleAlert size={17} aria-hidden="true" />
            <p>{problem}</p>
            <button type="button" aria-label="Dismiss this message" onClick={() => setProblem("")}><X size={16} aria-hidden="true" /></button>
          </div>
        )}

        {nothingYet && !adding && (
          <div className="student-empty-state">
            <ClipboardList size={25} aria-hidden="true" />
            <h2>Nothing tracked yet.</h2>
            <p>Add the assignments you’re working on and their due dates. They’ll be sorted into overdue, due soon, and later.</p>
            <button ref={addButtonRef} type="button" onClick={openAdd}>Add your first assignment</button>
          </div>
        )}

        {!nothingYet && (
          <div className={styles.list}>
            <h2 ref={listHeadingRef} tabIndex={-1} className={styles.listHeading}>
              {filter === "open" ? "Open assignments" : filter === "done" ? "Finished assignments" : "All assignments"}
            </h2>
            {groups.length === 0 && (
              <p className={styles.none}>
                {filter === "done" ? "Nothing marked done yet. Finished assignments are kept here." : `Nothing open. ${counts.done === 1 ? "1 assignment is" : `${counts.done} assignments are`} marked done.`}
              </p>
            )}
            {groups.map((group) => (
              <section key={group.bucket} className={styles.group} data-bucket={group.bucket} aria-label={`${group.title}, ${group.entries.length}`}>
                <div className={styles.groupHead}>
                  <h3>{group.title}</h3>
                  <span className={styles.groupCount}>{group.entries.length}</span>
                  <span className={styles.groupRule} aria-hidden="true" />
                  <span className={styles.groupNote}>{group.note}</span>
                </div>
                <ul className={styles.rows}>
                  {group.entries.map((item) => {
                    const done = item.status === "done"
                    const busy = saving.includes(item.id)
                    if (editingId === item.id) {
                      return (
                        <li key={item.id} className={`${styles.row} ${styles.editing}`} data-row={item.id}>
                          <AssignmentForm
                            heading={`Edit ${name(item)}`}
                            initial={item}
                            submitLabel="Save changes"
                            busyLabel="Saving…"
                            cancelLabel="Cancel"
                            onSubmit={(input) => saveEdit(item, input)}
                            onCancel={() => { setEditingId(null); focusNext.current = { row: item.id, control: "edit", fallback: "list" } }}
                          />
                        </li>
                      )
                    }
                    const overdue = group.bucket === "overdue"
                    const relative = item.dueAt && !done ? relativeDue(item.dueAt, now) : ""
                    return (
                      <li key={item.id} className={styles.row} data-row={item.id} data-done={done || undefined}>
                        <button
                          type="button"
                          className={styles.tick}
                          data-control="tick"
                          aria-pressed={done}
                          aria-label={`Mark ${name(item)} as done`}
                          aria-disabled={busy || undefined}
                          onClick={() => void changeStatus(item, done ? "todo" : "done", "tick")}
                        >
                          {done && <Check size={16} aria-hidden="true" />}
                        </button>
                        <div className={styles.body}>
                          {item.course && <p className={styles.course}>{item.course}</p>}
                          <h4 className={styles.rowTitle}>{item.title}</h4>
                          <p className={styles.due} data-overdue={overdue || undefined}>
                            <CalendarClock size={14} aria-hidden="true" />
                            {item.dueAt ? (
                              <>
                                <span>{done ? "Was due" : "Due"} {formatMoment(item.dueAt, now)}</span>
                                {relative && <span className={styles.relative}>{relative}</span>}
                              </>
                            ) : (
                              <span>No due date</span>
                            )}
                            {done && item.completedAt && <span className={styles.completed}>Done {formatMoment(item.completedAt, now)}</span>}
                          </p>
                          {item.notes && (
                            <details className={styles.notes}>
                              <summary>Notes</summary>
                              <p>{item.notes}</p>
                            </details>
                          )}
                        </div>
                        <div className={styles.controls}>
                          <label className={styles.status}>
                            <span className={styles.srOnly}>Status of {name(item)}</span>
                            <select data-control="status" value={item.status} aria-disabled={busy || undefined} onChange={(event) => void changeStatus(item, event.target.value as AssignmentStatus, "status")}>
                              {ASSIGNMENT_STATUSES.map((entry) => <option key={entry} value={entry}>{STATUS_LABELS[entry]}</option>)}
                            </select>
                          </label>
                          <button type="button" className={styles.icon} data-control="edit" aria-label={`Edit ${name(item)}`} onClick={() => { setEditingId(item.id); setConfirmingId(null) }}>
                            <Pencil size={15} aria-hidden="true" /> <span>Edit</span>
                          </button>
                          <button
                            type="button"
                            className={`${styles.icon} ${styles.danger}`}
                            data-control="delete"
                            aria-label={`Delete ${name(item)}`}
                            aria-expanded={confirmingId === item.id}
                            onClick={() => { setDeleteProblem(""); setConfirmingId(confirmingId === item.id ? null : item.id); focusNext.current = { row: item.id, control: confirmingId === item.id ? "delete" : "keep", fallback: "list" } }}
                          >
                            <Trash2 size={15} aria-hidden="true" /> <span>Delete</span>
                          </button>
                        </div>
                        {confirmingId === item.id && (
                          <div className={styles.confirm} role="group" aria-label={`Confirm deleting ${name(item)}`}>
                            <p>
                              <strong>Delete {name(item)}?</strong> It’s removed from your account for good.
                            </p>
                            <div className={styles.confirmActions}>
                              <button type="button" className={styles.secondary} data-control="keep" disabled={deleting === item.id} onClick={() => { setConfirmingId(null); focusNext.current = { row: item.id, control: "delete", fallback: "list" } }}>
                                Keep it
                              </button>
                              <button type="button" className={styles.destructive} aria-disabled={deleting === item.id || undefined} onClick={() => void remove(item)}>
                                <Trash2 size={15} aria-hidden="true" /> {deleting === item.id ? "Deleting…" : "Delete"}
                              </button>
                            </div>
                            {deleteProblem && <p className={styles.confirmProblem} role="alert"><CircleAlert size={15} aria-hidden="true" /><span>{deleteProblem}</span></p>}
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      <div className={styles.toast} role="status" aria-live="polite" data-visible={confirmation ? true : undefined}>
        {confirmation && <><Check size={15} aria-hidden="true" /><span>{confirmation}</span></>}
      </div>
    </section>
  )
}

export default AssignmentsPage
