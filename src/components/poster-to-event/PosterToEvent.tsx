import {
  AlertCircle,
  Check,
  Eye,
  FileImage,
  RefreshCw,
  Save,
  Upload,
  X,
} from "lucide-react"
import { useEffect, useId, useMemo, useRef, useState } from "react"
import type { EventDraft, EventDraftField, PosterToEventProps } from "./types"

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"]

const emptyDraft: EventDraft = {
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

const fieldLabels: Record<EventDraftField, string> = {
  title: "Event title",
  description: "Description",
  category: "Category",
  startDate: "Start date",
  startTime: "Start time",
  endDate: "End date",
  endTime: "End time",
  timezone: "Timezone",
  venue: "Venue",
  eligibility: "Eligibility",
  registrationDeadline: "Registration deadline",
  registrationUrl: "Registration URL",
}

const reviewFields = Object.keys(fieldLabels) as EventDraftField[]

type WorkflowStatus = "empty" | "selected" | "extracting" | "failure" | "draft" | "saving" | "saved"

type ValidationErrors = Partial<Record<EventDraftField, string>>

function parseLocalDateTime(date: string, time: string) {
  if (!date || !time) return null
  const value = new Date(`${date}T${time}`)
  return Number.isNaN(value.getTime()) ? null : value
}

function validateDraft(draft: EventDraft): ValidationErrors {
  const errors: ValidationErrors = {}
  if (!draft.title.trim()) errors.title = "Event title is required."
  if (!draft.startDate) errors.startDate = "Start date is required."
  if (!draft.startTime) errors.startTime = "Start time is required."
  if (!draft.venue.trim()) errors.venue = "Venue is required."

  const start = parseLocalDateTime(draft.startDate, draft.startTime)
  const end = parseLocalDateTime(draft.endDate, draft.endTime)
  if (end && start && end <= start) {
    errors.endTime = "End time must be after the event start."
  }
  if ((draft.endDate && !draft.endTime) || (!draft.endDate && draft.endTime)) {
    errors.endTime = "Provide both an end date and end time."
  }

  if (draft.registrationDeadline && start) {
    const deadline = new Date(draft.registrationDeadline)
    if (!Number.isNaN(deadline.getTime()) && deadline > start) {
      errors.registrationDeadline =
        "Registration deadline cannot be after the event starts."
    }
  }

  if (draft.registrationUrl.trim()) {
    try {
      const url = new URL(draft.registrationUrl)
      if (!["http:", "https:"].includes(url.protocol)) throw new Error()
    } catch {
      errors.registrationUrl = "Enter a valid HTTP or HTTPS URL."
    }
  }

  return errors
}

function FieldStatus({
  field,
  extractedFields,
  missingFields,
}: {
  field: EventDraftField
  extractedFields: Set<EventDraftField>
  missingFields: Set<EventDraftField>
}) {
  if (extractedFields.has(field)) {
    return (
      <span className="rounded-full bg-[#F0E3FB] px-2 py-0.5 text-[0.65rem] font-bold text-[#4E3262]">
        From poster
      </span>
    )
  }
  if (missingFields.has(field)) {
    return (
      <span className="text-[0.7rem] font-bold text-amber-700">
        Not found in poster
      </span>
    )
  }
  return null
}

export function PosterToEvent({
  extractPoster,
  saveDraft,
  initialDraft,
  savedMessage = "Draft saved",
  className = "",
}: PosterToEventProps) {
  const [status, setStatus] = useState<WorkflowStatus>("empty")
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState("")
  const [fileError, setFileError] = useState("")
  const [extractionError, setExtractionError] = useState("")
  const [draft, setDraft] = useState<EventDraft>({
    ...emptyDraft,
    ...initialDraft,
  })
  const [errors, setErrors] = useState<ValidationErrors>({})
  const [extractedFields, setExtractedFields] = useState<Set<EventDraftField>>(
    new Set(),
  )
  const [missingFields, setMissingFields] = useState<Set<EventDraftField>>(
    new Set(),
  )
  const [dirtyFields, setDirtyFields] = useState<Set<EventDraftField>>(
    new Set(),
  )
  const [dragActive, setDragActive] = useState(false)
  const [statusMessage, setStatusMessage] = useState("")
  const fileInput = useRef<HTMLInputElement>(null)
  const previewDialog = useRef<HTMLDialogElement>(null)
  const requestId = useRef(0)
  const formId = useId()

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  const progressStep =
    status === "empty" || status === "selected"
      ? 0
      : status === "extracting" || status === "failure"
        ? 1
        : 2

  const needsAttention = useMemo(
    () =>
      reviewFields.filter(
        (field) =>
          (missingFields.has(field) && !draft[field].trim()) ||
          Boolean(errors[field]),
      ),
    [draft, errors, missingFields],
  )

  const selectFile = (selected: File | undefined) => {
    setFileError("")
    if (!selected) return
    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setFileError("Choose a JPEG, PNG, or WebP image.")
      return
    }
    if (selected.size > MAX_FILE_SIZE) {
      setFileError("Poster must be 10 MB or smaller.")
      return
    }

    requestId.current += 1
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setFile(selected)
    setPreviewUrl(URL.createObjectURL(selected))
    setStatus("selected")
    setExtractionError("")
    setStatusMessage("Poster selected and ready for extraction.")
  }

  const enterManually = () => {
    requestId.current += 1
    setStatus("draft")
    setExtractionError("")
    setExtractedFields(new Set())
    setMissingFields(new Set())
    setStatusMessage("Manual entry mode. Add the event details you know.")
  }

  const runExtraction = async (retry = false) => {
    if (!file) {
      setFileError("Select a poster before extracting event details.")
      return
    }

    let overwriteEdited = false
    if (retry && dirtyFields.size > 0) {
      overwriteEdited = window.confirm(
        "Re-extraction can overwrite organizer edits. Select OK to overwrite edited fields, or Cancel to keep your edits while refreshing untouched fields.",
      )
    }

    const currentRequest = ++requestId.current
    setStatus("extracting")
    setExtractionError("")
    setStatusMessage("Extracting event details from the poster.")

    try {
      const result = await extractPoster(file)
      if (currentRequest !== requestId.current) return
      const returnedFields = new Set(result.extractedFields)
      const missing = new Set(
        reviewFields.filter(
          (field) => field !== "timezone" && !returnedFields.has(field),
        ),
      )

      setDraft((current) => {
        const next = { ...current }
        result.extractedFields.forEach((field) => {
          if (!dirtyFields.has(field) || overwriteEdited) {
            const value = result.values[field]
            if (typeof value === "string") next[field] = value
          }
        })
        return next
      })
      setExtractedFields(returnedFields)
      setMissingFields(missing)
      if (overwriteEdited) setDirtyFields(new Set())
      setStatus("draft")
      setStatusMessage(
        "AI-generated draft ready. Review all details before saving.",
      )
    } catch (error) {
      if (currentRequest !== requestId.current) return
      setStatus("failure")
      setExtractionError(
        error instanceof Error
          ? error.message
          : "Extraction failed. Try again or enter details manually.",
      )
      setStatusMessage("Poster extraction failed.")
    }
  }

  const updateField = (field: EventDraftField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }))
    setDirtyFields((current) => new Set(current).add(field))
    setErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
    if (status === "saved") setStatus("draft")
  }

  const save = async () => {
    const validation = validateDraft(draft)
    setErrors(validation)
    if (Object.keys(validation).length > 0) {
      setStatusMessage(
        `Review ${Object.keys(validation).length} validation ${
          Object.keys(validation).length === 1 ? "issue" : "issues"
        } before saving.`,
      )
      const firstField = Object.keys(validation)[0]
      document.getElementById(`${formId}-${firstField}`)?.focus()
      return
    }

    setStatus("saving")
    setStatusMessage("Saving draft.")
    try {
      await saveDraft(draft)
      setStatus("saved")
      setStatusMessage(savedMessage)
    } catch (error) {
      setStatus("draft")
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Draft could not be saved. Try again.",
      )
    }
  }

  const openPreview = () => {
    previewDialog.current?.showModal()
  }

  const inputClass = (field: EventDraftField) =>
    `mt-2 min-h-11 w-full rounded-lg border bg-white px-3 text-sm text-[#111111] outline-none focus:ring-2 focus:ring-[#EBD9FA] ${
      errors[field]
        ? "border-red-500 focus:border-red-500"
        : "border-neutral-300 focus:border-[#111111]"
    }`

  const FieldLabel = ({
    field,
    children,
  }: {
    field: EventDraftField
    children: React.ReactNode
  }) => (
    <label
      htmlFor={`${formId}-${field}`}
      className="block text-sm font-bold text-[#111111]"
    >
      <span className="flex min-h-5 flex-wrap items-center justify-between gap-2">
        <span>{children}</span>
        <FieldStatus
          field={field}
          extractedFields={extractedFields}
          missingFields={missingFields}
        />
      </span>
    </label>
  )

  const ErrorText = ({ field }: { field: EventDraftField }) =>
    errors[field] ? (
      <p id={`${formId}-${field}-error`} className="mt-1 text-xs text-red-700">
        {errors[field]}
      </p>
    ) : null

  return (
    <section
      className={`min-h-screen bg-white px-5 py-10 text-[#111111] sm:px-6 sm:py-14 lg:px-8 ${className}`}
    >
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-8 border-b border-neutral-200 pb-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-[#6A477E]">
              Poster to Event
            </p>
            <h1 className="mt-3 text-3xl font-black tracking-tight sm:text-5xl">
              Create an event from your poster
            </h1>
            <p className="mt-4 max-w-2xl text-base leading-7 text-neutral-600">
              Upload a poster, review the AI-assisted draft, and save it when
              the details are ready.
            </p>
          </div>

          <ol
            aria-label="Event creation progress"
            className="flex w-full max-w-md items-center"
          >
            {["Upload", "Extract", "Review"].map((step, index) => (
              <li
                key={step}
                className="flex flex-1 items-center text-xs font-bold"
                aria-current={progressStep === index ? "step" : undefined}
              >
                <span
                  className={`grid size-7 shrink-0 place-items-center rounded-full border ${
                    progressStep >= index
                      ? "border-[#111111] bg-[#111111] text-white"
                      : "border-neutral-300 bg-white text-neutral-400"
                  }`}
                >
                  {progressStep > index ? (
                    <Check className="size-3.5" aria-hidden="true" />
                  ) : (
                    index + 1
                  )}
                </span>
                <span
                  className={`ml-2 ${
                    progressStep >= index
                      ? "text-[#111111]"
                      : "text-neutral-400"
                  }`}
                >
                  {step}
                </span>
                {index < 2 && (
                  <span
                    aria-hidden="true"
                    className={`mx-3 h-px flex-1 ${
                      progressStep > index ? "bg-[#111111]" : "bg-neutral-300"
                    }`}
                  />
                )}
              </li>
            ))}
          </ol>
        </div>

        <div
          aria-live="polite"
          className={`mt-6 min-h-11 rounded-lg px-4 py-3 text-sm ${
            status === "saved"
              ? "bg-emerald-50 text-emerald-800"
              : "bg-[#F5EDFB] text-[#4E3262]"
          }`}
        >
          {statusMessage ||
            "Select a poster to begin, or create the event manually."}
        </div>

        <div className="mt-8 grid gap-10 lg:grid-cols-[0.78fr_1.22fr] lg:items-start">
          <aside className="lg:sticky lg:top-6">
            <h2 className="text-lg font-black">Event poster</h2>
            <p className="mt-1 text-sm text-neutral-500">
              JPEG, PNG, or WebP · Maximum 10 MB
            </p>

            <input
              ref={fileInput}
              type="file"
              accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => selectFile(event.target.files?.[0])}
            />

            {previewUrl ? (
              <div className="mt-5 overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-50">
                <img
                  src={previewUrl}
                  alt="Selected event poster preview"
                  className="max-h-[34rem] w-full object-contain"
                />
                <div className="flex flex-col gap-3 border-t border-neutral-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{file?.name}</p>
                    <p className="mt-1 text-xs text-neutral-500">
                      {file ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : ""}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => fileInput.current?.click()}
                    className="min-h-11 shrink-0 rounded-full border border-neutral-300 px-4 text-sm font-bold hover:border-[#111111] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
                  >
                    Replace poster
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInput.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault()
                  setDragActive(true)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  setDragActive(true)
                }}
                onDragLeave={(event) => {
                  event.preventDefault()
                  setDragActive(false)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  setDragActive(false)
                  selectFile(event.dataTransfer.files?.[0])
                }}
                className={`mt-5 flex min-h-80 w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111] ${
                  dragActive
                    ? "border-[#6A477E] bg-[#F5EDFB]"
                    : "border-neutral-300 bg-neutral-50 hover:border-neutral-500"
                }`}
              >
                <span className="grid size-12 place-items-center rounded-full bg-[#F0E3FB] text-[#4E3262]">
                  <Upload className="size-5" aria-hidden="true" />
                </span>
                <span className="mt-4 text-base font-black">
                  Drop your event poster here
                </span>
                <span className="mt-2 text-sm text-neutral-500">
                  or click to choose a file
                </span>
              </button>
            )}

            {fileError && (
              <p
                role="alert"
                className="mt-3 flex items-start gap-2 text-sm text-red-700"
              >
                <AlertCircle
                  className="mt-0.5 size-4 shrink-0"
                  aria-hidden="true"
                />
                {fileError}
              </p>
            )}

            <div className="mt-5 space-y-3">
              <button
                type="button"
                disabled={!file || status === "extracting"}
                onClick={() =>
                  runExtraction(status === "failure" || status === "draft")
                }
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-[#111111] px-5 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:text-neutral-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
              >
                {status === "extracting" ? (
                  <>
                    <RefreshCw
                      className="size-4 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    Extracting details…
                  </>
                ) : (
                  <>
                    <FileImage className="size-4" aria-hidden="true" />
                    {status === "failure"
                      ? "Retry extraction"
                      : "Extract event details"}
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={enterManually}
                className="min-h-11 w-full text-sm font-bold underline decoration-neutral-300 underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#111111]"
              >
                Enter event details manually
              </button>
            </div>

            {status === "failure" && (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4"
              >
                <p className="flex items-center gap-2 text-sm font-black text-red-800">
                  <AlertCircle className="size-4" aria-hidden="true" />
                  Extraction failed
                </p>
                <p className="mt-2 text-sm leading-6 text-red-700">
                  {extractionError}
                </p>
                <div className="mt-3 flex flex-wrap gap-4">
                  <button
                    type="button"
                    onClick={() => runExtraction(true)}
                    className="min-h-11 text-sm font-bold text-red-900 underline underline-offset-4"
                  >
                    Retry
                  </button>
                  <button
                    type="button"
                    onClick={enterManually}
                    className="min-h-11 text-sm font-bold text-red-900 underline underline-offset-4"
                  >
                    Continue manually
                  </button>
                </div>
              </div>
            )}
          </aside>

          <div>
            <div className="flex flex-col gap-4 border-b border-neutral-200 pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 className="text-lg font-black">Event details</h2>
                <p className="mt-1 text-sm text-neutral-500">
                  Everything stays editable. Confirm each detail before saving.
                </p>
              </div>
              {extractedFields.size > 0 && (
                <span className="w-fit rounded-full bg-[#F0E3FB] px-3 py-1.5 text-xs font-bold text-[#4E3262]">
                  AI-generated draft
                </span>
              )}
            </div>

            {needsAttention.length > 0 && (
              <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-sm font-black text-amber-900">
                  {needsAttention.length}{" "}
                  {needsAttention.length === 1 ? "field needs" : "fields need"}{" "}
                  attention
                </p>
                <p className="mt-1 text-xs leading-5 text-amber-800">
                  {needsAttention.map((field) => fieldLabels[field]).join(", ")}
                </p>
              </div>
            )}

            <form
              className="mt-6 grid gap-5 sm:grid-cols-2"
              onSubmit={(event) => {
                event.preventDefault()
                save()
              }}
              noValidate
            >
              <div className="sm:col-span-2">
                <FieldLabel field="title">Event title</FieldLabel>
                <input
                  id={`${formId}-title`}
                  value={draft.title}
                  onChange={(event) => updateField("title", event.target.value)}
                  aria-invalid={Boolean(errors.title)}
                  aria-describedby={
                    errors.title ? `${formId}-title-error` : undefined
                  }
                  className={inputClass("title")}
                />
                <ErrorText field="title" />
              </div>

              <div className="sm:col-span-2">
                <FieldLabel field="description">Description</FieldLabel>
                <textarea
                  id={`${formId}-description`}
                  value={draft.description}
                  onChange={(event) =>
                    updateField("description", event.target.value)
                  }
                  rows={5}
                  className={`${inputClass("description")} resize-y py-3`}
                />
              </div>

              <div>
                <FieldLabel field="category">Category</FieldLabel>
                <select
                  id={`${formId}-category`}
                  value={draft.category}
                  onChange={(event) =>
                    updateField("category", event.target.value)
                  }
                  className={inputClass("category")}
                >
                  <option value="">Select a category</option>
                  <option value="Technical">Technical</option>
                  <option value="Cultural">Cultural</option>
                  <option value="Sports">Sports</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div>
                <FieldLabel field="timezone">Timezone</FieldLabel>
                <select
                  id={`${formId}-timezone`}
                  value={draft.timezone}
                  onChange={(event) =>
                    updateField("timezone", event.target.value)
                  }
                  className={inputClass("timezone")}
                >
                  <option value="Asia/Kolkata">Asia/Kolkata</option>
                  <option value="Asia/Dubai">Asia/Dubai</option>
                  <option value="Europe/London">Europe/London</option>
                  <option value="America/New_York">America/New_York</option>
                </select>
              </div>

              <div>
                <FieldLabel field="startDate">Start date</FieldLabel>
                <input
                  id={`${formId}-startDate`}
                  type="date"
                  value={draft.startDate}
                  onChange={(event) =>
                    updateField("startDate", event.target.value)
                  }
                  aria-invalid={Boolean(errors.startDate)}
                  className={inputClass("startDate")}
                />
                <ErrorText field="startDate" />
              </div>

              <div>
                <FieldLabel field="startTime">Start time</FieldLabel>
                <input
                  id={`${formId}-startTime`}
                  type="time"
                  value={draft.startTime}
                  onChange={(event) =>
                    updateField("startTime", event.target.value)
                  }
                  aria-invalid={Boolean(errors.startTime)}
                  className={inputClass("startTime")}
                />
                <ErrorText field="startTime" />
              </div>

              <div>
                <FieldLabel field="endDate">End date</FieldLabel>
                <input
                  id={`${formId}-endDate`}
                  type="date"
                  value={draft.endDate}
                  onChange={(event) =>
                    updateField("endDate", event.target.value)
                  }
                  className={inputClass("endDate")}
                />
              </div>

              <div>
                <FieldLabel field="endTime">End time</FieldLabel>
                <input
                  id={`${formId}-endTime`}
                  type="time"
                  value={draft.endTime}
                  onChange={(event) =>
                    updateField("endTime", event.target.value)
                  }
                  aria-invalid={Boolean(errors.endTime)}
                  className={inputClass("endTime")}
                />
                <ErrorText field="endTime" />
              </div>

              <div className="sm:col-span-2">
                <FieldLabel field="venue">Venue</FieldLabel>
                <input
                  id={`${formId}-venue`}
                  value={draft.venue}
                  onChange={(event) => updateField("venue", event.target.value)}
                  aria-invalid={Boolean(errors.venue)}
                  className={inputClass("venue")}
                />
                <ErrorText field="venue" />
              </div>

              <div>
                <FieldLabel field="eligibility">Eligibility</FieldLabel>
                <input
                  id={`${formId}-eligibility`}
                  value={draft.eligibility}
                  onChange={(event) =>
                    updateField("eligibility", event.target.value)
                  }
                  className={inputClass("eligibility")}
                />
              </div>

              <div>
                <FieldLabel field="registrationDeadline">
                  Registration deadline
                </FieldLabel>
                <input
                  id={`${formId}-registrationDeadline`}
                  type="datetime-local"
                  value={draft.registrationDeadline}
                  onChange={(event) =>
                    updateField("registrationDeadline", event.target.value)
                  }
                  aria-invalid={Boolean(errors.registrationDeadline)}
                  className={inputClass("registrationDeadline")}
                />
                <ErrorText field="registrationDeadline" />
              </div>

              <div className="sm:col-span-2">
                <FieldLabel field="registrationUrl">
                  Registration URL
                </FieldLabel>
                <input
                  id={`${formId}-registrationUrl`}
                  type="url"
                  inputMode="url"
                  placeholder="https://"
                  value={draft.registrationUrl}
                  onChange={(event) =>
                    updateField("registrationUrl", event.target.value)
                  }
                  aria-invalid={Boolean(errors.registrationUrl)}
                  className={inputClass("registrationUrl")}
                />
                <ErrorText field="registrationUrl" />
              </div>

              <div className="flex flex-col gap-3 border-t border-neutral-200 pt-6 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={openPreview}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-neutral-300 px-5 text-sm font-bold hover:border-[#111111] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
                >
                  <Eye className="size-4" aria-hidden="true" />
                  Preview event
                </button>
                <button
                  type="submit"
                  disabled={status === "saving"}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#111111] px-6 text-sm font-bold text-white hover:bg-neutral-800 disabled:cursor-wait disabled:bg-neutral-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
                >
                  <Save className="size-4" aria-hidden="true" />
                  {status === "saving" ? "Saving draft…" : "Save draft"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>

      <dialog
        ref={previewDialog}
        aria-labelledby={`${formId}-preview-title`}
        className="m-auto w-[calc(100%-2rem)] max-w-2xl rounded-2xl border border-neutral-200 bg-white p-0 text-[#111111] shadow-2xl backdrop:bg-black/55"
      >
        <div className="relative p-6 sm:p-8">
          <button
            type="button"
            aria-label="Close event preview"
            onClick={() => previewDialog.current?.close()}
            className="absolute right-4 top-4 grid size-11 place-items-center rounded-full border border-neutral-200 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-[#111111]"
          >
            <X className="size-5" aria-hidden="true" />
          </button>
          <p className="pr-14 text-xs font-bold uppercase tracking-[0.14em] text-[#6A477E]">
            Draft preview
          </p>
          <h2
            id={`${formId}-preview-title`}
            className="mt-3 pr-14 text-3xl font-black tracking-tight"
          >
            {draft.title || "Untitled event"}
          </h2>
          <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-neutral-600">
            {draft.description || "No description added."}
          </p>
          <dl className="mt-6 grid gap-5 border-y border-neutral-200 py-6 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold text-neutral-400">Starts</dt>
              <dd className="mt-1 text-sm font-semibold">
                {[draft.startDate, draft.startTime]
                  .filter(Boolean)
                  .join(" · ") || "Not specified"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-neutral-400">Ends</dt>
              <dd className="mt-1 text-sm font-semibold">
                {[draft.endDate, draft.endTime].filter(Boolean).join(" · ") ||
                  "Not specified"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-neutral-400">Venue</dt>
              <dd className="mt-1 text-sm font-semibold">
                {draft.venue || "Not specified"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-neutral-400">
                Eligibility
              </dt>
              <dd className="mt-1 text-sm font-semibold">
                {draft.eligibility || "Not specified"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-neutral-400">Category</dt>
              <dd className="mt-1 text-sm font-semibold">
                {draft.category || "Not specified"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-neutral-400">Timezone</dt>
              <dd className="mt-1 text-sm font-semibold">{draft.timezone}</dd>
            </div>
          </dl>
          <p className="mt-5 text-xs leading-5 text-neutral-500">
            Preview only. Saving creates a draft; it does not publish the event.
          </p>
        </div>
      </dialog>
    </section>
  )
}

export default PosterToEvent
