import { useEffect, useId, useRef, useState } from "react"
import { CircleAlert } from "lucide-react"
import { ASSIGNMENT_COURSE_MAX, ASSIGNMENT_NOTES_MAX, ASSIGNMENT_STATUSES, ASSIGNMENT_TITLE_MAX } from "../contracts"
import type { Assignment, AssignmentInput, AssignmentStatus } from "../contracts"
import { END_OF_DAY, fromLocalInputs, toLocalInputs } from "./dates"
import styles from "./AssignmentsPage.module.css"

export const STATUS_LABELS: Record<AssignmentStatus, string> = { todo: "To do", in_progress: "In progress", done: "Done" }

type AssignmentFormProps = {
  heading: string
  // Present when editing; absent when adding.
  initial?: Assignment
  submitLabel: string
  busyLabel: string
  // Resolves to null when saved, or to a message to show in the form when it was not.
  onSubmit: (input: AssignmentInput) => Promise<string | null>
  onCancel: () => void
  cancelLabel: string
}

type FieldName = "title" | "course" | "date" | "time" | "notes"

function Remaining({ id, used, max }: { id: string; used: number; max: number }) {
  const left = max - used
  // Shown once four fifths of the allowance is used.
  const show = left <= Math.ceil(max / 5)
  return (
    <span id={id} className={styles.remaining} data-limit={left <= 0 || undefined} aria-live={show ? "polite" : "off"}>
      {show ? (left <= 0 ? `Limit of ${max} characters reached` : `${left} ${left === 1 ? "character" : "characters"} left`) : ""}
    </span>
  )
}

// One form for both adding and editing, so the two can never disagree about the rules.
function AssignmentForm({ heading, initial, submitLabel, busyLabel, onSubmit, onCancel, cancelLabel }: AssignmentFormProps) {
  const id = useId()
  const startDue = toLocalInputs(initial?.dueAt ?? null)
  const [title, setTitle] = useState(initial?.title ?? "")
  const [course, setCourse] = useState(initial?.course ?? "")
  const [notes, setNotes] = useState(initial?.notes ?? "")
  const [date, setDate] = useState(startDue.date)
  const [time, setTime] = useState(startDue.time)
  const [status, setStatus] = useState<AssignmentStatus>(initial?.status ?? "todo")
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({})
  const [failure, setFailure] = useState("")
  const [busy, setBusy] = useState(false)
  const refs = {
    title: useRef<HTMLInputElement>(null),
    course: useRef<HTMLInputElement>(null),
    date: useRef<HTMLInputElement>(null),
    time: useRef<HTMLInputElement>(null),
    notes: useRef<HTMLTextAreaElement>(null),
  }
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    refs.title.current?.focus()
    return () => { mounted.current = false }
    // Focus the title once, when the form opens.
  }, [])

  const clear = (field: FieldName) => setErrors((current) => (current[field] ? { ...current, [field]: undefined } : current))

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (busy) return
    const next: Partial<Record<FieldName, string>> = {}
    const cleanTitle = title.trim()
    const cleanCourse = course.trim()
    const cleanNotes = notes.trim()
    if (!cleanTitle) next.title = "Give the assignment a title."
    else if (cleanTitle.length > ASSIGNMENT_TITLE_MAX) next.title = `Keep the title to ${ASSIGNMENT_TITLE_MAX} characters or fewer.`
    if (cleanCourse.length > ASSIGNMENT_COURSE_MAX) next.course = `Keep the course to ${ASSIGNMENT_COURSE_MAX} characters or fewer.`
    if (cleanNotes.length > ASSIGNMENT_NOTES_MAX) next.notes = `Keep notes to ${ASSIGNMENT_NOTES_MAX} characters or fewer.`
    // A date the browser can't parse reads as empty while the field shows it as invalid.
    const badDate = refs.date.current?.validity.badInput
    const badTime = refs.time.current?.validity.badInput
    if (badDate) next.date = "That date isn’t complete. Fill in the day, month, and year, or clear it."
    if (badTime) next.time = "That time isn’t complete. Fill in hours and minutes, or clear it."
    const due = fromLocalInputs(date, time)
    if (!due.ok && !next[due.field]) next[due.field] = due.message
    setErrors(next)
    const firstBad = (["title", "course", "date", "time", "notes"] as FieldName[]).find((field) => next[field])
    if (firstBad || !due.ok) {
      setFailure("")
      if (firstBad) refs[firstBad].current?.focus()
      return
    }
    setBusy(true)
    setFailure("")
    const problem = await onSubmit({ title: cleanTitle, course: cleanCourse, notes: cleanNotes, dueAt: due.dueAt, status })
    if (!mounted.current) return
    setBusy(false)
    if (problem) {
      setFailure(problem)
      return
    }
    if (!initial) {
      // Ready for the next one.
      setTitle("")
      setCourse("")
      setNotes("")
      setDate("")
      setTime("")
      setStatus("todo")
      refs.title.current?.focus()
    }
  }

  const describedBy = (field: FieldName, extra?: string) => [errors[field] ? `${id}-${field}-error` : "", extra ?? ""].filter(Boolean).join(" ") || undefined

  return (
    <form className={styles.form} onSubmit={submit} noValidate aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className={styles.formHeading}>{heading}</h2>
      <div className={styles.fields}>
        <div className={`${styles.fieldGroup} ${styles.wide}`} data-invalid={errors.title ? true : undefined}>
          <label htmlFor={`${id}-title`}>Title <span className={styles.required}>required</span></label>
          <input
            ref={refs.title}
            id={`${id}-title`}
            type="text"
            value={title}
            maxLength={ASSIGNMENT_TITLE_MAX}
            required
            aria-required="true"
            aria-invalid={errors.title ? true : undefined}
            aria-describedby={describedBy("title", `${id}-title-left`)}
            placeholder="e.g. Lab report 3"
            autoComplete="off"
            onChange={(event) => { setTitle(event.target.value); clear("title") }}
          />
          <Remaining id={`${id}-title-left`} used={title.length} max={ASSIGNMENT_TITLE_MAX} />
          {errors.title && <p id={`${id}-title-error`} className={styles.fieldError}><CircleAlert size={14} aria-hidden="true" /> {errors.title}</p>}
        </div>

        <div className={`${styles.fieldGroup} ${styles.wide}`} data-invalid={errors.course ? true : undefined}>
          <label htmlFor={`${id}-course`}>Course <span className={styles.optional}>optional</span></label>
          <input
            ref={refs.course}
            id={`${id}-course`}
            type="text"
            value={course}
            maxLength={ASSIGNMENT_COURSE_MAX}
            aria-invalid={errors.course ? true : undefined}
            aria-describedby={describedBy("course", `${id}-course-left`)}
            placeholder="e.g. CS-201 Data Structures"
            autoComplete="off"
            onChange={(event) => { setCourse(event.target.value); clear("course") }}
          />
          <Remaining id={`${id}-course-left`} used={course.length} max={ASSIGNMENT_COURSE_MAX} />
          {errors.course && <p id={`${id}-course-error`} className={styles.fieldError}><CircleAlert size={14} aria-hidden="true" /> {errors.course}</p>}
        </div>

        <div className={styles.fieldGroup} data-invalid={errors.date ? true : undefined}>
          <label htmlFor={`${id}-date`}>Due date <span className={styles.optional}>optional</span></label>
          <input
            ref={refs.date}
            id={`${id}-date`}
            type="date"
            value={date}
            min="2000-01-01"
            max="2100-12-31"
            aria-invalid={errors.date ? true : undefined}
            aria-describedby={describedBy("date")}
            onChange={(event) => { setDate(event.target.value); clear("date"); clear("time") }}
          />
          {errors.date && <p id={`${id}-date-error`} className={styles.fieldError}><CircleAlert size={14} aria-hidden="true" /> {errors.date}</p>}
        </div>

        <div className={styles.fieldGroup} data-invalid={errors.time ? true : undefined}>
          <label htmlFor={`${id}-time`}>Due time <span className={styles.optional}>optional</span></label>
          <input
            ref={refs.time}
            id={`${id}-time`}
            type="time"
            value={time}
            aria-invalid={errors.time ? true : undefined}
            aria-describedby={describedBy("time", `${id}-time-help`)}
            onChange={(event) => { setTime(event.target.value); clear("time"); clear("date") }}
          />
          <span id={`${id}-time-help`} className={styles.fieldHelp}>Your local time. Left empty, a date means end of day ({END_OF_DAY}).</span>
          {errors.time && <p id={`${id}-time-error`} className={styles.fieldError}><CircleAlert size={14} aria-hidden="true" /> {errors.time}</p>}
        </div>

        {initial && (
          <div className={styles.fieldGroup}>
            <label htmlFor={`${id}-status`}>Status</label>
            <select id={`${id}-status`} value={status} onChange={(event) => setStatus(event.target.value as AssignmentStatus)}>
              {ASSIGNMENT_STATUSES.map((entry) => <option key={entry} value={entry}>{STATUS_LABELS[entry]}</option>)}
            </select>
          </div>
        )}

        <div className={`${styles.fieldGroup} ${styles.wide}`} data-invalid={errors.notes ? true : undefined}>
          <label htmlFor={`${id}-notes`}>Notes <span className={styles.optional}>optional</span></label>
          <textarea
            ref={refs.notes}
            id={`${id}-notes`}
            value={notes}
            rows={3}
            maxLength={ASSIGNMENT_NOTES_MAX}
            aria-invalid={errors.notes ? true : undefined}
            aria-describedby={describedBy("notes", `${id}-notes-left`)}
            placeholder="Anything you need to remember: where to submit, what’s left to do."
            onChange={(event) => { setNotes(event.target.value); clear("notes") }}
          />
          <Remaining id={`${id}-notes-left`} used={notes.length} max={ASSIGNMENT_NOTES_MAX} />
          {errors.notes && <p id={`${id}-notes-error`} className={styles.fieldError}><CircleAlert size={14} aria-hidden="true" /> {errors.notes}</p>}
        </div>
      </div>

      {failure && <p className={styles.formFailure} role="alert"><CircleAlert size={16} aria-hidden="true" /><span>{failure}</span></p>}

      <div className={styles.formActions}>
        <button type="submit" className={styles.primary} aria-disabled={busy || undefined}>{busy ? busyLabel : submitLabel}</button>
        <button type="button" className={styles.secondary} onClick={onCancel} disabled={busy}>{cancelLabel}</button>
      </div>
    </form>
  )
}

export default AssignmentForm
