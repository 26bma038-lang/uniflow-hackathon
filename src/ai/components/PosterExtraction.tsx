import { useEffect, useId, useRef, useState } from "react"
import { CircleAlert,LoaderCircle, ListChecks, RefreshCw, Sparkles } from "lucide-react"
import type { EventDraftField } from "../../components/poster-to-event/types"
import { aiService } from "../api"
import { POSTER_MAX_BYTES, POSTER_MIME_TYPES } from "../contracts"
import type { AiErrorCode, AiService, ExtractPosterResponse, PosterMimeType } from "../contracts"
import { extractionErrorCopy } from "./errorCopy"
import ExtractionFlags from "./ExtractionFlags"
import { EVENT_FIELD_ORDER, fieldLabel, formatFieldValue } from "./fields"
import styles from "./PosterExtraction.module.css"

export { default as ExtractionFlags } from "./ExtractionFlags"

type PosterExtractionProps = {
  clubId: string
  file: File | null
  // Called once for each extraction that succeeds, with exactly what the service returned.
  onExtracted: (result: ExtractPosterResponse) => void
  service?: Pick<AiService, "extractPoster">
  disabled?: boolean
  // Optional: the fields the surrounding form actually has, in its order, and its own names
  // for them. Fields outside this list are not reported as "left empty".
  fields?: EventDraftField[]
  fieldLabels?: Partial<Record<EventDraftField, string>>
}

type Phase =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success"; result: ExtractPosterResponse }
  | { kind: "error"; code: AiErrorCode }

const IDLE: Phase = { kind: "idle" }

function isPosterMimeType(type: string): type is PosterMimeType {
  return (POSTER_MIME_TYPES as string[]).includes(type)
}

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function readAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const text = typeof reader.result === "string" ? reader.result : ""
      const comma = text.indexOf(",")
      if (comma < 0) reject(new Error("The file could not be read."))
      else resolve(text.slice(comma + 1))
    }
    reader.onerror = () => reject(reader.error ?? new Error("The file could not be read."))
    reader.readAsDataURL(file)
  })
}

function PosterExtraction({ clubId, file, onExtracted, service = aiService, disabled = false, fields = EVENT_FIELD_ORDER, fieldLabels }: PosterExtractionProps) {
  const titleId = useId()
  // The phase belongs to one file and one club. When either changes, whatever was showing
  // for the old one is no longer true and the panel reads as idle again.
  const [state, setState] = useState<{ file: File | null; clubId: string; phase: Phase }>({ file, clubId, phase: IDLE })
  const phase = state.file === file && state.clubId === clubId ? state.phase : IDLE

  // Each run takes a number. A result is used only if its number is still the latest, so a
  // slow answer for a replaced file, or one that lands after unmount, is dropped.
  const run = useRef(0)
  const onExtractedRef = useRef(onExtracted)
  onExtractedRef.current = onExtracted
  useEffect(() => { run.current += 1 }, [file, clubId])
  useEffect(() => () => { run.current += 1 }, [])

  const rootRef = useRef<HTMLElement>(null)
  const errorTitleRef = useRef<HTMLParagraphElement>(null)

  // Checked here first so an image the service would refuse is never read or sent.
  const localProblem: AiErrorCode | null = !file ? null : !isPosterMimeType(file.type) ? "invalid_image" : file.size > POSTER_MAX_BYTES ? "too_large" : null

  const extract = async () => {
    if (!file || disabled || phase.kind === "loading" || localProblem || !isPosterMimeType(file.type)) return
    const mine = ++run.current
    const subject = { file, clubId }
    const finish = (next: Phase) => {
      if (mine !== run.current) return false
      setState({ ...subject, phase: next })
      return true
    }
    setState({ ...subject, phase: { kind: "loading" } })
    let dataBase64: string
    try {
      dataBase64 = await readAsBase64(file)
    } catch {
      finish({ kind: "error", code: "invalid_image" })
      return
    }
    if (mine !== run.current) return
    let outcome: Awaited<ReturnType<AiService["extractPoster"]>>
    try {
      outcome = await service.extractPoster({ clubId, image: { mimeType: file.type, dataBase64 } })
    } catch {
      outcome = { ok: false, error: { code: "network", message: "" } }
    }
    if (outcome.ok) {
      if (finish({ kind: "success", result: outcome.value })) onExtractedRef.current(outcome.value)
    } else {
      finish({ kind: "error", code: outcome.error.code })
    }
  }

  const errorCode = localProblem ?? (phase.kind === "error" ? phase.code : null)
  const errorCopy = errorCode ? extractionErrorCopy(errorCode) : null
  const canRun = Boolean(file) && !localProblem && (phase.kind !== "error" || Boolean(errorCopy?.retry))

  // The button normally stays put and keeps focus. When a failure removes it, focus would
  // fall to the page, so it moves to the message instead.
  useEffect(() => {
    if (phase.kind !== "error" || canRun) return
    const active = document.activeElement
    if (!active || active === document.body || rootRef.current?.contains(active)) errorTitleRef.current?.focus()
  }, [phase.kind, canRun])

  const result = phase.kind === "success" ? phase.result : null
  const found = result
    ? EVENT_FIELD_ORDER.filter((field) => result.extractedFields.includes(field) && (result.values[field] ?? "").trim() !== "")
    : []
  const empty = result ? fields.filter((field) => !found.includes(field)) : []
  const flagged = new Set(result?.flags.map((flag) => flag.field))

  const buttonLabel = phase.kind === "loading" ? "Reading the image…" : phase.kind === "success" ? "Extract again" : phase.kind === "error" ? "Try again" : "Extract details from this image"
  const announcement =
    phase.kind === "loading"
      ? "Reading the image. This can take a little while."
      : result
        ? `Extraction finished. ${found.length} ${found.length === 1 ? "field" : "fields"} suggested, ${empty.length} left empty${result.flags.length ? `, ${result.flags.length} to check against the source` : ""}. Check every suggestion against the source.`
        : ""

  return (
    <section ref={rootRef} className={styles.root} aria-labelledby={titleId}>
      <p className={styles.kicker}><Sparkles size={13} aria-hidden="true" /> AI assist · optional</p>
      <h3 id={titleId} className={styles.title}>Suggest details from the image</h3>

      {!file && (
        <p className={styles.lede}>
          Choose a source image first. UniFlow can then read it and suggest a title, dates, venue, and other details for you to check. You can also skip this and fill in the form yourself.
        </p>
      )}

      {file && (
        <>
          <p className={styles.lede}>
            An AI model reads the image and suggests values for the form. They are suggestions only: a person has to check each one before anything is published.
          </p>
          <p className={styles.file}>
            <span className={styles.fileName}>{file.name || "Selected image"}</span>
            <span>{formatBytes(file.size)}</span>
          </p>
        </>
      )}

      {canRun && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.button}
            onClick={() => void extract()}
            aria-disabled={disabled || phase.kind === "loading"}
            data-busy={phase.kind === "loading" || undefined}
          >
            {phase.kind === "loading" ? <LoaderCircle size={16} className={styles.spinner} aria-hidden="true" /> : phase.kind === "idle" ? <Sparkles size={16} aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}
            {buttonLabel}
          </button>
          {phase.kind === "idle" && (
            <p className={styles.hint}>
              {disabled ? "Extraction is unavailable right now." : "Pressing this sends the image to UniFlow’s extraction service and an AI model. Nothing is sent before that."}
            </p>
          )}
          {phase.kind === "loading" && <p className={styles.hint}>This can take a little while. You can keep typing in the form.</p>}
        </div>
      )}

      <p className={styles.srOnly} role="status" aria-live="polite">{announcement}</p>

      {errorCopy && (
        <div className={styles.error} role="alert">
          <p ref={errorTitleRef} tabIndex={-1} className={styles.errorTitle}>
            <CircleAlert size={17} aria-hidden="true" />
            <span>{errorCopy.title}</span>
          </p>
          <p className={styles.errorBody}>
            {localProblem === "too_large" && file ? `This file is ${formatBytes(file.size)}. ` : ""}
            {errorCopy.body}
          </p>
          <p className={styles.manual}>
            <strong>You can continue manually.</strong> Type the details into the form yourself. This attempt changed nothing in your draft.
          </p>
        </div>
      )}

      {result && (
        <div className={styles.result}>
          <div className={styles.resultHead}>
            <h4 className={styles.resultTitle}>
              {found.length ? "Check these suggestions against the source" : "Nothing could be read from this image"}
            </h4>
            <p className={styles.resultLede}>
              {found.length
                ? "The model can misread or miss things. Nothing here is verified, and nothing is published from this screen."
                : "No field was stated clearly enough to suggest. Fill in the form yourself, or try a clearer image."}
            </p>
          </div>

          <ExtractionFlags flags={result.flags} fieldLabels={fieldLabels} headingLevel={4} />

          {found.length > 0 && (
            <div className={styles.group}>
              <h4 className={styles.groupTitle}>Suggested from the image <span>{found.length}</span></h4>
              <dl className={styles.values}>
                {found.map((field) => (
                  <div key={field} className={styles.value} data-flagged={flagged.has(field) || undefined}>
                    <dt>
                      {fieldLabel(field, fieldLabels)}
                      {flagged.has(field) && <span className={styles.check}><ListChecks size={12} aria-hidden="true" /> Check</span>}
                    </dt>
                    <dd>{formatFieldValue(field, result.values[field] ?? "")}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {empty.length > 0 && (
            <div className={styles.group}>
              <h4 className={styles.groupTitle}>Left empty <span>{empty.length}</span></h4>
              <p className={styles.groupNote}>The image didn’t state these, so they were not guessed. Add them yourself if you know them.</p>
              <ul className={styles.empty}>
                {empty.map((field) => (
                  <li key={field}>
                    {fieldLabel(field, fieldLabels)}
                    {flagged.has(field) && <span className={styles.check}><ListChecks size={12} aria-hidden="true" /> Check</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <p className={styles.model}>
            Read by AI model <span>{result.model || "not reported"}</span> · not yet reviewed by a person
          </p>
        </div>
      )}
    </section>
  )
}

export default PosterExtraction
