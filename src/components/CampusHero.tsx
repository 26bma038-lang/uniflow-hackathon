import { useRef, useState } from "react"

import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
} from "motion/react"

const items = [
  {
    id: "scholarship",
    category: "Scholarship",
    filter: "Deadlines",
    day: "19",
    month: "OCT",
    title: "Student support scholarship",
    audience: "Undergraduate students",
    time: "19 October 2026 · 5:00 PM IST",
    summary:
      "Review the example eligibility criteria and prepare your application documents before the closing date.",
    source: "Student support notice",
    publisher: "Student support office · example",
    documentDate: "12 October 2026",
    reviewedDate: "Preview state · not live",
    reviewStatus: "Illustrative prototype",
    action: "Application deadline",
  },

  {
    id: "assignment",
    category: "Academic notice",
    filter: "Deadlines",
    day: "20",
    month: "OCT",
    title: "Design thinking assignment",
    audience: "First-year students",
    time: "20 October 2026 · 11:59 PM IST",
    summary:
      "Prepare a short presentation on a campus problem and your proposed solution. Check the example course brief for submission instructions.",
    source: "Course assignment brief",
    publisher: "Example course team",
    documentDate: "14 October 2026",
    reviewedDate: "Preview state · not live",
    reviewStatus: "Illustrative prototype",
    action: "Submission deadline",
  },

  {
    id: "club",
    category: "Opportunity",
    filter: "Deadlines",
    day: "21",
    month: "OCT",
    title: "Creative Circle recruitment",
    audience: "All students",
    time: "21 October 2026 · 6:00 PM IST",
    summary:
      "Explore example roles in design, writing, and photography. Read the recruitment brief to understand the interests and work samples requested.",
    source: "Creative Circle recruitment brief",
    publisher: "Creative Circle · example",
    documentDate: "15 October 2026",
    reviewedDate: "Preview state · not live",
    reviewStatus: "Illustrative prototype",
    action: "Interest deadline",
  },

  {
    id: "event",
    category: "Campus event",
    filter: "Events",
    day: "22",
    month: "OCT",
    title: "Campus open-air evening",
    audience: "Campus community",
    time: "22 October 2026 · 6:30–8:30 PM IST",
    summary:
      "An example evening of student music and spoken word in the central courtyard. Check the event programme for the location and schedule before attending.",
    source: "Student arts programme",
    publisher: "Student Arts Circle · example",
    documentDate: "16 October 2026",
    reviewedDate: "Preview state · not live",
    reviewStatus: "Illustrative prototype",
    action: "Event time",
  },
] as const

type Photo = { src: string; alt: string }

export default function CampusHero({ photos }: { photos: Photo[] }) {
  const reducedMotion = useReducedMotion()

  const [filter, setFilter] = useState("All")

  const [selected, setSelected] = useState<typeof items[number] | null>(null)

  const backRef = useRef<HTMLButtonElement>(null)

  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  const transition = (delay: number) => ({
    initial: reducedMotion ? false as const : { opacity: 0.6, y: 18 },

    animate: { opacity: 1, y: 0 },

    transition: {
      duration: reducedMotion ? 0 : 0.6,
      delay: reducedMotion ? 0 : delay,
      ease: [0.22, 1, 0.36, 1] as const,
    },
  })

  const visibleItems = items.filter(
    (item) => filter === "All" || item.filter === filter,
  )

  return (
    <section className="editorial-hero" aria-labelledby="campus-hero-title">
      <div className="editorial-hero-inner">
        <motion.div className="editorial-hero-copy" {...transition(0)}>
          <p className="editorial-kicker">A clearer campus rhythm</p>
          <h1 id="campus-hero-title">
            Your campus,
            <br />
            <em>without</em> the catch-up.
          </h1>
          <p className="editorial-hero-description">
            UniFlow brings notices, deadlines, scholarships, opportunities, and
            events into one source-aware place—so students can move from “what
            did I miss?” to “I know what to do next.”
          </p>
          <div className="editorial-hero-actions">
            <a
              className="editorial-button editorial-button-dark"
              href="/get-started"
              onClick={(event) => {
                event.preventDefault()
                window.history.pushState({}, "", "/get-started")
                window.dispatchEvent(new PopStateEvent("popstate"))
                window.scrollTo({ top: 0 })
              }}
            >
              Get started <span aria-hidden="true">↗</span>
            </a>
            <a
              className="editorial-text-link"
              href="#campus-inbox"
              onClick={() =>
                document
                  .getElementById("campus-inbox")
                  ?.focus({ preventScroll: true })
              }
            >
              Explore the live preview <span aria-hidden="true">↓</span>
            </a>
          </div>
          <div className="editorial-proof-line">
            <span className="editorial-proof-mark">✦</span>
            <span>Independent campus hub prototype</span>
            <span className="editorial-proof-rule" />
            <span>Illustrative content</span>
          </div>
        </motion.div>

        <motion.div className="editorial-hero-preview" {...transition(0.14)}>
          <div className="editorial-preview-note editorial-preview-note-top">
            <span>01</span>
            <span>Noticeboard, re-composed</span>
          </div>
          <div className="editorial-preview-rail" aria-hidden="true">
            <span>UNI</span>
            <span>FLOW</span>
          </div>
          <LayoutGroup>
            <motion.div
              id="campus-inbox"
              className="editorial-inbox"
              tabIndex={-1}
              role="region"
              aria-labelledby="inbox-title"
              layout
            >
              <div className="editorial-inbox-top">
                <div>
                  <p className="editorial-inbox-label">
                    YOUR CAMPUS, AT A GLANCE
                  </p>
                  <h2 id="inbox-title">
                    Today <span>&amp;</span> Soon
                  </h2>
                </div>
                <span className="editorial-inbox-date">
                  19—25
                  <br />
                  OCT 2026
                </span>
              </div>
              <div className="editorial-inbox-toolbar">
                <div
                  className="editorial-filters"
                  role="group"
                  aria-label="Filter campus inbox"
                >
                  {["All", "Deadlines", "Events"].map((label) => (
                    <button
                      key={label}
                      aria-pressed={filter === label}
                      onClick={() => {
                        setFilter(label)
                        setSelected(null)
                      }}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <span className="editorial-inbox-count" aria-live="polite">
                  {visibleItems.length} items
                </span>
              </div>
              <div className="editorial-inbox-content">
                <AnimatePresence mode="wait" initial={false}>
                  {selected ? (
                    <motion.div
                      key="detail"
                      className="editorial-detail"
                      initial={reducedMotion ? false : { opacity: 0, x: 18 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={reducedMotion ? undefined : { opacity: 0, x: -18 }}
                      transition={{ duration: reducedMotion ? 0 : 0.28 }}
                    >
                      <button
                        ref={backRef}
                        className="editorial-back"
                        onClick={() => {
                          const id = selected.id
                          setSelected(null)
                          requestAnimationFrame(() =>
                            itemRefs.current[id]?.focus(),
                          )
                        }}
                      >
                        ← Back to inbox
                      </button>
                      <p className="editorial-detail-category">
                        {selected.category}
                      </p>
                      <h3>{selected.title}</h3>
                      <p className="editorial-detail-summary">
                        {selected.summary}
                      </p>
                      <div className="editorial-status">
                        <span /> {selected.reviewStatus}
                      </div>
                      <dl>
                        <div>
                          <dt>Audience</dt>
                          <dd>{selected.audience}</dd>
                        </div>
                        <div>
                          <dt>{selected.action}</dt>
                          <dd>{selected.time}</dd>
                        </div>
                        <div>
                          <dt>Publisher</dt>
                          <dd>{selected.publisher}</dd>
                        </div>
                        <div>
                          <dt>Original source</dt>
                          <dd>{selected.source}</dd>
                        </div>
                      </dl>
                      <p className="editorial-source-note">
                        Illustrative sample data. No live source link or
                        institutional verification is connected.
                      </p>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="list"
                      className="editorial-list"
                      initial={reducedMotion ? false : { opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={reducedMotion ? undefined : { opacity: 0 }}
                      transition={{ duration: reducedMotion ? 0 : 0.2 }}
                    >
                      {visibleItems.map((item) => (
                        <motion.button
                          layout
                          key={item.id}
                          ref={(element) => {
                            itemRefs.current[item.id] = element
                          }}
                          className="editorial-feed-row"
                          onClick={() => {
                            setSelected(item)
                            requestAnimationFrame(() =>
                              backRef.current?.focus(),
                            )
                          }}
                        >
                          <span className="editorial-date-block">
                            <b>{item.day}</b>
                            <small>{item.month}</small>
                          </span>
                          <span className="editorial-row-copy">
                            <small>{item.category}</small>
                            <strong>{item.title}</strong>
                            <span>{item.audience}</span>
                          </span>
                          <span
                            className="editorial-row-arrow"
                            aria-hidden="true"
                          >
                            ↗
                          </span>
                        </motion.button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="editorial-inbox-footer">
                <span>Source-aware by design</span>
                <span>Example data · prototype</span>
              </div>
            </motion.div>
          </LayoutGroup>
          <p className="editorial-preview-note editorial-preview-note-bottom">
            <span>Find what matters.</span> Check the source. Take action.
          </p>
          {photos[0] && (
            <img
              className="editorial-photo editorial-photo-one"
              src={photos[0].src}
              alt=""
              aria-hidden="true"
            />
          )}
          {photos[1] && (
            <img
              className="editorial-photo editorial-photo-two"
              src={photos[1].src}
              alt=""
              aria-hidden="true"
            />
          )}
        </motion.div>
      </div>
    </section>
  )
}
