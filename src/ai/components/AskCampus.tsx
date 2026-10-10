import { useEffect, useId, useRef, useState } from "react"
import { ArrowUpRight, CircleAlert, ExternalLink, LoaderCircle, RefreshCw, Search, Sparkles } from "lucide-react"
import { aiService } from "../api"
import { DISCOVER_MAX_QUERY_LENGTH } from "../contracts"
import type { AiErrorCode, AiService, DiscoverResponse, DiscoverSource } from "../contracts"
import { discoverErrorCopy } from "./errorCopy"
import styles from "./AskCampus.module.css"

type AskCampusProps = {
  signedIn: boolean
  onSignIn: () => void
  onOpenItem: (id: string, path: string) => void
  service?: Pick<AiService, "discover">
  suggestions?: string[]
}

const DEFAULT_SUGGESTIONS = ["What’s happening this week?", "Which deadlines are closing soon?", "Are any workshops open to first years?"]

// The counter appears once this few characters are left.
const COUNTER_FROM = 60

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/

// Record dates arrive as ISO date-times. A bare date is read as that calendar day rather
// than as midnight UTC, which would show the previous day in some time zones. Anything
// unreadable is shown as it came, never replaced with a guess.
function formatWhen(value: string) {
  const dateOnly = DATE_ONLY.exec(value)
  if (dateOnly) {
    const date = new Date(Number(dateOnly[1]), Number(dateOnly[2]) - 1, Number(dateOnly[3]))
    return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" }).format(date)
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(date)
}

function isWebUrl(value: string | null): value is string {
  if (!value) return false
  try {
    const url = new URL(value)
    return url.protocol === "https:" || url.protocol === "http:"
  } catch {
    return false
  }
}

function SourceRow({ source, onOpen }: { source: DiscoverSource; onOpen: () => void }) {
  return (
    <li className={styles.source}>
      <p className={styles.sourceKicker}>
        <span className={styles.category}>{source.category || "Uncategorised"}</span>
        <span>{source.publisher || "Publisher not recorded"}</span>
      </p>
      <h4 className={styles.sourceTitle}>{source.title || "Untitled record"}</h4>
      <dl className={styles.facts}>
        {source.startDate && <div><dt>When</dt><dd>{formatWhen(source.startDate)}</dd></div>}
        {source.deadline && <div className={styles.deadline}><dt>{source.startDate ? "Register by" : "Deadline"}</dt><dd>{formatWhen(source.deadline)}</dd></div>}
        {!source.startDate && !source.deadline && <div><dt>When</dt><dd>No date on this record</dd></div>}
        <div><dt>Where</dt><dd>{source.venue || "No venue on this record"}</dd></div>
      </dl>
      <div className={styles.sourceActions}>
        <button type="button" className={styles.open} onClick={onOpen}>
          Open record <span className={styles.srOnly}>: {source.title}</span><ArrowUpRight size={15} aria-hidden="true" />
        </button>
        {isWebUrl(source.sourceUrl) && (
          <a className={styles.external} href={source.sourceUrl} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={14} aria-hidden="true" /> Original source
            <span className={styles.srOnly}> for {source.title} (opens in a new tab)</span>
          </a>
        )}
      </div>
    </li>
  )
}

function AskCampus({ signedIn, onSignIn, onOpenItem, service = aiService, suggestions = DEFAULT_SUGGESTIONS }: AskCampusProps) {
  const id = useId()
  const [query, setQuery] = useState("")
  const [formError, setFormError] = useState("")
  // What is being asked right now, if anything.
  const [pending, setPending] = useState<string | null>(null)
  // The last answer that came back. It stays on screen while the next question loads.
  const [answer, setAnswer] = useState<{ question: string; response: DiscoverResponse } | null>(null)
  const [failure, setFailure] = useState<{ question: string; code: AiErrorCode } | null>(null)
  const [announcement, setAnnouncement] = useState("")
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Only the newest question may write to the screen. Older answers that arrive late, or
  // after sign-out or unmount, are dropped.
  const run = useRef(0)
  useEffect(() => () => { run.current += 1 }, [])
  useEffect(() => {
    if (signedIn) return
    run.current += 1
    setPending(null)
    setAnswer(null)
    setFailure(null)
    setAnnouncement("")
  }, [signedIn])

  const ask = async (raw: string) => {
    const question = raw.trim().slice(0, DISCOVER_MAX_QUERY_LENGTH)
    if (!question) {
      setFormError("Type a question first.")
      inputRef.current?.focus()
      return
    }
    // The same question is already on its way.
    if (pending === question) return
    setFormError("")
    setFailure(null)
    setPending(question)
    setAnnouncement("Searching published records.")
    const mine = ++run.current
    let outcome: Awaited<ReturnType<AiService["discover"]>>
    try {
      outcome = await service.discover({ query: question })
    } catch {
      outcome = { ok: false, error: { code: "network", message: "" } }
    }
    if (mine !== run.current) return
    setPending(null)
    if (outcome.ok) {
      const count = outcome.value.sources.length
      setAnswer({ question, response: outcome.value })
      setAnnouncement(count ? `Answer ready, with ${count} published ${count === 1 ? "record" : "records"} to check.` : "Answer ready. No published record matched.")
    } else {
      setFailure({ question, code: outcome.error.code })
      setAnnouncement("")
    }
  }

  const remaining = DISCOVER_MAX_QUERY_LENGTH - query.length
  const failureCopy = failure ? discoverErrorCopy(failure.code) : null

  return (
    <section className={styles.root} aria-labelledby={`${id}-title`}>
      <header className={styles.head}>
        <p className={styles.kicker}><Sparkles size={13} aria-hidden="true" /> Ask UniFlow · AI</p>
        <h2 id={`${id}-title`} className={styles.title}>Ask about what’s published.</h2>
        <p className={styles.lede}>Ask in your own words. The answer is built only from records clubs and publishers have put on UniFlow, and it links to each one it used.</p>
      </header>

      {!signedIn ? (
        <div className={styles.gate}>
          <h3 className={styles.gateTitle}>Sign in to ask a question.</h3>
          <p>Asking uses an AI model, so it’s limited to signed-in students. Browsing, search, and filters stay open to everyone.</p>
          <button type="button" className={styles.primary} onClick={onSignIn}>Sign in</button>
        </div>
      ) : (
          <form
            className={styles.form}
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              void ask(query)
            }}
          >
            <label className={styles.label} htmlFor={`${id}-question`}>Your question</label>
            <div className={styles.field} data-invalid={formError ? true : undefined}>
              <textarea
                ref={inputRef}
                id={`${id}-question`}
                className={styles.input}
                rows={2}
                value={query}
                maxLength={DISCOVER_MAX_QUERY_LENGTH}
                placeholder="e.g. Are there any coding events before Friday?"
                aria-describedby={`${id}-help ${id}-count${formError ? ` ${id}-error` : ""}`}
                aria-invalid={formError ? true : undefined}
                enterKeyHint="search"
                onChange={(event) => {
                  setQuery(event.target.value)
                  if (formError) setFormError("")
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault()
                    void ask(query)
                  }
                }}
              />
              <button type="submit" className={styles.submit}>
                <Search size={16} aria-hidden="true" /> Ask
              </button>
            </div>
            <div className={styles.under}>
              <p id={`${id}-help`} className={styles.help}>Press Enter to ask, Shift + Enter for a new line.</p>
              <p id={`${id}-count`} className={styles.count} data-limit={remaining === 0 || undefined} aria-live={remaining <= 20 ? "polite" : "off"}>
                {remaining <= COUNTER_FROM ? (remaining === 0 ? `Limit of ${DISCOVER_MAX_QUERY_LENGTH} characters reached` : `${remaining} ${remaining === 1 ? "character" : "characters"} left`) : ""}
              </p>
            </div>
            {formError && <p id={`${id}-error`} className={styles.formError} role="alert"><CircleAlert size={15} aria-hidden="true" /> {formError}</p>}
            {suggestions.length > 0 && (
              <div className={styles.suggestions}>
                <span id={`${id}-try`}>Try</span>
                <ul aria-labelledby={`${id}-try`}>
                  {suggestions.map((suggestion) => (
                    <li key={suggestion}>
                      <button
                        type="button"
                        onClick={() => {
                          const text = suggestion.slice(0, DISCOVER_MAX_QUERY_LENGTH)
                          setQuery(text)
                          void ask(text)
                        }}
                      >
                        {suggestion}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </form>
      )}

      <p className={styles.disclaimer}>
        <CircleAlert size={15} aria-hidden="true" />
        <span>
          Answers are AI-generated from published UniFlow records and can be wrong or incomplete. Rely on the linked records and their original sources, not on the summary.
          {answer && signedIn ? <> Generated by <span className={styles.model}>{answer.response.model || "an unreported model"}</span>.</> : null}
        </span>
      </p>

      {signedIn && (
        <>
          <p className={styles.srOnly} role="status" aria-live="polite">{announcement}</p>

          {pending && (
            <p className={styles.loading}>
              <LoaderCircle size={16} className={styles.spinner} aria-hidden="true" />
              <span>Searching published records for <q>{pending}</q></span>
            </p>
          )}

          {failure && failureCopy && (
            <div className={styles.error} role="alert">
              <p className={styles.errorTitle}><CircleAlert size={17} aria-hidden="true" /><span>{failureCopy.title}</span></p>
              <p className={styles.errorBody}>{failureCopy.body}</p>
              {(failureCopy.retry || failureCopy.signIn) && (
                <div className={styles.errorActions}>
                  {failureCopy.retry && (
                    <button type="button" className={styles.secondary} onClick={() => void ask(failure.question)}>
                      <RefreshCw size={14} aria-hidden="true" /> Try again
                    </button>
                  )}
                  {failureCopy.signIn && <button type="button" className={styles.secondary} onClick={onSignIn}>Sign in again</button>}
                </div>
              )}
              {answer && <p className={styles.errorNote}>The earlier answer below is for a different question.</p>}
            </div>
          )}

          {answer && (
            <article className={styles.answer} aria-labelledby={`${id}-answer`} aria-busy={pending ? true : undefined} data-stale={pending || failure ? true : undefined}>
              <p className={styles.asked}>
                <span>{pending || failure ? "Earlier answer · you asked" : "You asked"}</span>
                <q>{answer.question}</q>
              </p>
              <h3 id={`${id}-answer`} className={styles.answerLabel}>Answer</h3>
              <p className={styles.answerText}>{answer.response.answer.trim() || "The model returned no text for this question."}</p>

              <div className={styles.sources}>
                <h3 className={styles.sourcesTitle}>
                  Published records behind this answer <span>{answer.response.sources.length}</span>
                </h3>
                {answer.response.sources.length ? (
                  <ul className={styles.sourceList}>
                    {answer.response.sources.map((source, index) => (
                      <SourceRow key={`${source.id}-${index}`} source={source} onOpen={() => onOpenItem(source.id, source.path)} />
                    ))}
                  </ul>
                ) : (
                  <p className={styles.none}>
                    <strong>Nothing published on UniFlow matched this question.</strong> There is no record to open, so treat the text above as “not found”, not as information. Try different words, or browse the campus index.
                  </p>
                )}
              </div>
            </article>
          )}
        </>
      )}

    </section>
  )
}

export default AskCampus
