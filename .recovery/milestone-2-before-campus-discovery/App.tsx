import { useEffect, useRef, useState } from "react"
import { AnimatePresence, motion, useReducedMotion } from "motion/react"
import { Tabs, TabsList, TabsTrigger } from "./components/ui/tabs"
import PosterToEventDemo from "./components/poster-to-event/PosterToEventDemo"
import CampusHero from "./components/CampusHero"
import logo from "./imports/WhatsApp_Image_2026-10-08_at_12.19.51_AM.jpeg"

type IconName = "arrow" | "calendar" | "check" | "close" | "file" | "home" | "menu" | "pin" | "search" | "ticket" | "upload" | "users"

const iconPaths: Record<IconName, React.ReactNode> = {
  arrow: <path d="M5 12h14m-5-5 5 5-5 5" />,
  calendar: (
    <>
      <rect x="4" y="5" width="16" height="16" rx="2" />
      <path d="M8 3v4m8-4v4M4 10h16" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  file: (
    <>
      <path d="M6 3h8l4 4v14H6z" />
      <path d="M14 3v5h5M9 13h6M9 17h4" />
    </>
  ),
  home: (
    <>
      <path d="m3 11 9-8 9 8" />
      <path d="M5 10v10h14V10M9 20v-6h6v6" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  pin: (
    <>
      <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" />
      <circle cx="12" cy="10" r="2" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  ticket: (
    <>
      <path d="M4 7h16v3a2 2 0 0 0 0 4v3H4v-3a2 2 0 0 0 0-4V7Z" />
      <path d="M13 9v6" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4m-4 4 4-4 4 4" />
      <path d="M5 14v6h14v-6" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-4 2-7 6-7s6 3 6 7M16 5a3 3 0 0 1 0 6m1 3c3 .5 4 3 4 6" />
    </>
  ),
}

const eventPhotos = [
  {
    src: "https://images.unsplash.com/photo-1713816821486-bdab847cad72?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=700",
    alt: "Guitarist performing live on stage",
    label: "Live events",
    labelClass: "label-green",
  },
  {
    src: "https://images.unsplash.com/photo-1502904550040-7534597429ae?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=700",
    alt: "Athletes competing on a running track",
    label: "Sports",
    labelClass: "label-blue",
  },
  {
    src: "https://images.unsplash.com/photo-1627556704221-6d6456d42b37?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=700",
    alt: "Student taking part in a cultural celebration",
  },
  {
    src: "https://images.unsplash.com/photo-1542751371-adc38448a05e?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=700",
    alt: "Gaming activity with illuminated computers",
  },
  {
    src: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=700",
    alt: "Audience watching a concert under stage lights",
  },
  {
    src: "https://images.unsplash.com/photo-1531545514256-b1400bc00f31?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=700",
    alt: "Students collaborating around a laptop at a hackathon",
    label: "Hackathons",
    labelClass: "label-pink",
  },
]

const artworkImages = [
  {
    src: "https://images.unsplash.com/photo-1562448079-b5631888445f?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=700",
    alt: "A colorful collection of expressive wall art",
  },
  {
    src: "https://images.unsplash.com/photo-1713897446508-e3eb8401e8fa?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=700",
    alt: "A layered newspaper and medal collage",
  },
  {
    src: "https://images.unsplash.com/photo-1698067931089-01a78baaf31f?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=700",
    alt: "An expressive portrait collage surrounded by words and images",
  },
  {
    src: "https://images.unsplash.com/photo-1555964681-9e0c30ba9b05?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=700",
    alt: "A dense arrangement of colorful graphic posters",
  },
  {
    src: "https://images.unsplash.com/photo-1655834648155-f7a98ff3c49d?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=82&w=700",
    alt: "A vivid hand-drawn portrait artwork",
  },
]

type EventItem = {
  id: string
  title: string
  category: string
  filterCategory: "Technical" | "Cultural" | "Sports"
  dateGroup: "today" | "week" | "upcoming"
  club: string
  date: string
  time: string
  venue: string
  description: string
  eligibility?: string
  registrationDetails?: string
}

const upcomingEvents: EventItem[] = [
  {
    id: "build-night",
    title: "Build Night",
    category: "Technical workshop",
    filterCategory: "Technical",
    dateGroup: "today",
    club: "Campus Code Collective",
    date: "18 Oct",
    time: "4:00 PM",
    venue: "Innovation Lab",
    description:
      "An example hands-on workshop for students to explore ideas, collaborate, and build a small web project.",
  },
  {
    id: "open-mic",
    title: "Campus Open Mic",
    category: "Music & performance",
    filterCategory: "Cultural",
    dateGroup: "week",
    club: "Student Arts Circle",
    date: "22 Oct",
    time: "6:30 PM",
    venue: "Main Auditorium",
    description:
      "An example evening of student music, spoken word, and short performances in an open stage format.",
  },
  {
    id: "futsal-cup",
    title: "Inter-Hostel Futsal Cup",
    category: "Sports",
    filterCategory: "Sports",
    dateGroup: "week",
    club: "Campus Sports Council",
    date: "26 Oct",
    time: "8:00 AM",
    venue: "Indoor Sports Hall",
    description:
      "An example campus futsal competition bringing hostel teams together for a morning of friendly matches.",
  },
]

const exploreEvents: EventItem[] = [
  ...upcomingEvents,
  {
    id: "design-sprint",
    title: "Design Sprint Studio",
    category: "Technical workshop",
    filterCategory: "Technical",
    dateGroup: "week",
    club: "Product Design Society",
    date: "20 Oct",
    time: "2:00 PM",
    venue: "Design Studio",
    description:
      "An example collaborative design session where students work through a focused campus challenge from idea to prototype.",
  },
  {
    id: "culture-night",
    title: "Culture Night",
    category: "Cultural showcase",
    filterCategory: "Cultural",
    dateGroup: "upcoming",
    club: "International Students Collective",
    date: "24 Oct",
    time: "5:30 PM",
    venue: "Central Courtyard",
    description:
      "An example evening featuring student-led performances, creative displays, and cultural activities from across campus.",
  },
  {
    id: "basketball-3v3",
    title: "Campus Basketball 3v3",
    category: "Sports",
    filterCategory: "Sports",
    dateGroup: "upcoming",
    club: "Athletics Association",
    date: "27 Oct",
    time: "9:00 AM",
    venue: "East Court",
    description:
      "An example three-on-three campus tournament with short matches and teams competing through a simple knockout bracket.",
  },
]

const eventCovers: Record<string, { src: string; alt: string }> = {
  "build-night": { src: eventPhotos[5].src, alt: eventPhotos[5].alt },
  "open-mic": { src: eventPhotos[0].src, alt: eventPhotos[0].alt },
  "culture-night": { src: eventPhotos[2].src, alt: eventPhotos[2].alt },
}

function EventCoverImage({
  event,
  className = "",
}: {
  event: EventItem
  className?: string
}) {
  const cover = eventCovers[event.id]
  if (cover) {
    return <img src={cover.src} alt={cover.alt} className={className} />
  }
  return (
    <div
      className={`flex flex-col items-center justify-center bg-[#111111] p-6 text-center ${className}`}
    >
      <span className="text-[0.65rem] font-bold uppercase tracking-widest text-[#A288A6]">
        {event.category}
      </span>
      <h3 className="mt-2 text-lg font-black leading-tight text-[#F0E3FB]">
        {event.title}
      </h3>
    </div>
  )
}

const panelIllustrations = {
  students:
    "https://images.unsplash.com/photo-1729962098706-95e2cb345d93?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1000",
  clubs:
    "https://images.unsplash.com/photo-1729364303908-962b8193be33?crop=entropy&cs=tinysrgb&fit=crop&fm=jpg&q=85&w=1000",
}

function Icon({
  name,
  className = "size-5",
}: {
  name: IconName
  className?: string
}) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {iconPaths[name]}
    </svg>
  )
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`logo-full ${compact ? "logo-full-compact" : ""}`}>
      <img src={logo} alt="UniFlow" />
    </span>
  )
}

function HeaderLogo() {
  return (
    <span className="header-logo-lockup">
      <span className="header-logo-symbol" aria-hidden="true">
        <img src={logo} alt="" />
      </span>
      <span className="header-logo-wordmark">UniFlow</span>
    </span>
  )
}

function EventModal({
  event,
  onClose,
}: {
  event: EventItem | null
  onClose: () => void
}) {
  const [registrationPreview, setRegistrationPreview] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!event) return

    returnFocusRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    window.requestAnimationFrame(() => {
      modalRef.current
        ?.querySelector<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        )
        ?.focus()
    })

    const handleKeys = (keyboardEvent: KeyboardEvent) => {
      if (keyboardEvent.key === "Escape") {
        keyboardEvent.preventDefault()
        onClose()
        return
      }
      if (keyboardEvent.key !== "Tab" || !modalRef.current) return
      const focusable = Array.from(
        modalRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      )
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (keyboardEvent.shiftKey && document.activeElement === first) {
        keyboardEvent.preventDefault()
        last.focus()
      } else if (!keyboardEvent.shiftKey && document.activeElement === last) {
        keyboardEvent.preventDefault()
        first.focus()
      }
    }

    window.addEventListener("keydown", handleKeys)
    return () => {
      window.removeEventListener("keydown", handleKeys)
      document.body.style.overflow = previousOverflow
      window.requestAnimationFrame(() => returnFocusRef.current?.focus())
    }
  }, [event])

  useEffect(() => {
    setRegistrationPreview(false)
  }, [event])

  if (!event) return null

  return (
    <div
      className="fixed inset-0 z-[100] grid place-items-center overflow-y-auto bg-black/55 p-4"
      onMouseDown={(mouseEvent) => {
        if (mouseEvent.currentTarget === mouseEvent.target) onClose()
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="event-preview-title"
        className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
      >
        <button
          type="button"
          autoFocus
          aria-label="Close event preview"
          onClick={onClose}
          className="absolute right-4 top-4 grid size-11 place-items-center rounded-full border border-neutral-200 text-[#111111] hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-[#111111]"
        >
          <Icon name="close" className="size-5" />
        </button>

        <p className="pr-14 text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">
          Example event preview
        </p>
        <h2
          id="event-preview-title"
          className="mt-3 pr-14 text-3xl font-black tracking-tight text-[#111111]"
        >
          {event.title}
        </h2>
        <p className="mt-2 text-sm text-neutral-500">
          Organized by {event.club}
        </p>

        <div className="mt-6 grid gap-4 border-y border-neutral-200 py-5 sm:grid-cols-2">
          <div>
            <p className="text-xs font-bold text-neutral-400">Date & time</p>
            <p className="mt-1 text-sm font-semibold text-[#111111]">
              {event.date} · {event.time}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold text-neutral-400">Venue</p>
            <p className="mt-1 text-sm font-semibold text-[#111111]">
              {event.venue}
            </p>
          </div>
        </div>

        <p className="mt-5 text-sm leading-6 text-neutral-600">
          {event.description}
        </p>
        <div className="mt-5 space-y-2 text-sm text-neutral-600">
          <p>
            <strong className="text-[#111111]">Eligibility:</strong>{" "}
            {event.eligibility ?? "Not specified."}
          </p>
          <p>
            <strong className="text-[#111111]">Source action:</strong>{" "}
            {event.registrationDetails ?? "Not specified."}
          </p>
        </div>

        {registrationPreview && (
          <p
            role="status"
            className="mt-5 rounded-lg bg-[#F0E3FB] px-4 py-3 text-sm text-[#3D2750]"
          >
            Preview only. The original source action is not connected in this
            prototype.
          </p>
        )}

        <button
          type="button"
          onClick={() => setRegistrationPreview(true)}
          className="mt-6 min-h-12 rounded-full bg-[#111111] px-6 text-sm font-bold text-white hover:bg-neutral-800 hover:text-white focus-visible:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
        >
          Source action preview
        </button>
      </div>
    </div>
  )
}

function UpcomingEventsSection({
  onExplore,
}: {
  onExplore: (event: React.MouseEvent<HTMLAnchorElement>) => void
}) {
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const [activeCategory, setActiveCategory] = useState<
    "All" | "Events" | "Opportunities" | "Notices"
  >("All")
  const reducedMotion = useReducedMotion() ?? false
  const discoveryItems = [
    { type: "event" as const, title: "Campus Open Mic", meta: "22 Oct · 6:30 PM", category: "Events", event: upcomingEvents[1] },
    { type: "opportunity" as const, title: "Student support scholarship", meta: "Deadline · 19 Oct", category: "Opportunities", event: null },
    { type: "notice" as const, title: "Design thinking assignment", meta: "Submission · 20 Oct", category: "Notices", event: null },
    { type: "opportunity" as const, title: "Creative Circle recruitment", meta: "Interest · 21 Oct", category: "Opportunities", event: null },
  ]
  const filteredItems = discoveryItems.filter(
    (item) => activeCategory === "All" || item.category === activeCategory,
  )

  return (
    <section id="events" className="editorial-discovery scroll-mt-20">
      <div className="mx-auto max-w-[1240px] px-6 py-16 sm:py-24 lg:px-8">
        <motion.div
          className="editorial-discovery-heading"
          initial={reducedMotion ? false : { opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.35 }}
          transition={{ duration: reducedMotion ? 0 : 0.55 }}
        >
          <div>
            <p className="editorial-kicker">The week ahead</p>
            <h2>Find your next reason to show up.</h2>
          </div>
          <div>
            <p>Events are only one part of a broader campus rhythm: opportunities, notices, and deadlines all belong in the same clear view.</p>
            <a href="/events" onClick={onExplore}>View the full events feed <span aria-hidden="true">↗</span></a>
          </div>
        </motion.div>

        <div className="editorial-discovery-toolbar" role="group" aria-label="Filter campus discovery">
          {(["All", "Events", "Opportunities", "Notices"] as const).map((category) => (
            <button
              key={category}
              type="button"
              aria-pressed={activeCategory === category}
              onClick={() => setActiveCategory(category)}
            >
              {category}
            </button>
          ))}
          <span>{filteredItems.length} signals · illustrative prototype</span>
        </div>

        <div className="editorial-discovery-grid">
          <motion.article
            className="editorial-feature-opportunity"
            initial={reducedMotion ? false : { opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: reducedMotion ? 0 : 0.65 }}
          >
            <div className="editorial-feature-art">
              <EventCoverImage event={upcomingEvents[1]} className="size-full object-cover" />
              <div className="editorial-feature-art-caption">
                <span>22 OCT</span>
                <span>Student arts circle · example</span>
              </div>
            </div>
            <div className="editorial-feature-copy">
              <p className="editorial-discovery-label">Featured campus event</p>
              <h3>Campus Open Mic</h3>
              <p>An example evening of music, spoken word, and short performances — a warm place to find the people making campus feel like theirs.</p>
              <dl>
                <div><dt>When</dt><dd>22 October · 6:30 PM</dd></div>
                <div><dt>Where</dt><dd>Main Auditorium</dd></div>
              </dl>
              <button type="button" onClick={() => setSelectedEvent(upcomingEvents[1])}>Read the event note <span aria-hidden="true">↗</span></button>
            </div>
          </motion.article>

          <div className="editorial-signal-stack" aria-live="polite">
            {filteredItems.map((item, index) => (
              <motion.button
                key={item.title}
                type="button"
                className={`editorial-signal-item editorial-signal-${item.type}`}
                initial={reducedMotion ? false : { opacity: 0, x: 18 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: reducedMotion ? 0 : 0.42, delay: reducedMotion ? 0 : index * 0.08 }}
                onClick={() => item.event && setSelectedEvent(item.event)}
              >
                <span className="editorial-signal-date">{String(index + 1).padStart(2, "0")}</span>
                <span className="editorial-signal-copy">
                  <small>{item.category}</small>
                  <strong>{item.title}</strong>
                  <span>{item.meta}</span>
                </span>
                <span className="editorial-signal-arrow" aria-hidden="true">↗</span>
              </motion.button>
            ))}
            {filteredItems.length === 0 && <p className="editorial-signal-empty">Nothing in this view yet. Try another category.</p>}
            <div className="editorial-discovery-note">
              <span className="editorial-note-mark">✦</span>
              <p><strong>Source-aware by design.</strong><br />Every item keeps its publisher, timing, and original context close by.</p>
            </div>
          </div>
        </div>
      </div>

      <EventModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </section>
  )
}

type FragmentSource = "WhatsApp" | "Noticeboard" | "Instagram" | "Email"

function FragmentedInformationSection() {
  const [merged, setMerged] = useState(false)
  const reducedMotion = useReducedMotion() ?? false
  const fragments: {
    source: FragmentSource
    title: string
    meta: string
    accent: string
  }[] = [
    {
      source: "WhatsApp",
      title: "Scholarship notice",
      meta: "Forwarded · no context",
      accent: "#d6b3e5",
    },
    {
      source: "Noticeboard",
      title: "Design assignment",
      meta: "Printed · easy to miss",
      accent: "#f1c0d0",
    },
    {
      source: "Instagram",
      title: "Open-air evening",
      meta: "Posted · details scattered",
      accent: "#c4d5e8",
    },
    {
      source: "Email",
      title: "Club recruitment",
      meta: "Buried · action unclear",
      accent: "#e5d4a7",
    },
  ]

  return (
    <section
      className="editorial-problem-section px-6 py-16 sm:py-24 lg:px-8"
      aria-labelledby="problem-title"
    >
      <div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[0.78fr_1.22fr] lg:items-center lg:gap-20">
        <div className="max-w-xl">
          <p className="editorial-kicker">The old campus rhythm</p>
          <h2
            id="problem-title"
            className="mt-4 text-4xl font-black leading-[0.98] tracking-[-0.06em] text-[#17131D] sm:text-6xl"
          >
            Important things are everywhere.
            <br />
            <span className="text-[#7C429C]">Clarity should be too.</span>
          </h2>
          <p className="mt-6 max-w-lg text-base leading-7 text-[#57505E] sm:text-lg">
            Students piece together campus life from forwarded messages, printed
            notices, social posts, and inboxes. UniFlow gives every item a
            place, a source, and a next step.
          </p>
          <button
            type="button"
            onClick={() => setMerged((value) => !value)}
            className="editorial-merge-button mt-8"
          >
            <span>
              {merged ? "Scatter the examples" : "Bring the examples together"}
            </span>
            <span aria-hidden="true">{merged ? "↙" : "↗"}</span>
          </button>
          <p className="mt-4 text-xs text-[#74677D]">
            Illustrative examples only · no live campus channels are connected.
          </p>
        </div>
        <div
          className={`editorial-fragment-board ${merged ? "is-merged" : ""}`}
          aria-live="polite"
        >
          <div className="editorial-board-header">
            <span>Four places students look</span>
            <span>
              {merged ? "One source-aware view" : "Illustrative campus signals"}
            </span>
          </div>
          <div className="editorial-fragment-layout">
            <div className="editorial-fragment-stack">
              {fragments.map((fragment, index) => (
                <motion.button
                  type="button"
                  key={fragment.source}
                  className="editorial-fragment-card"
                  style={
                    {
                      "--fragment-accent": fragment.accent,
                      "--fragment-index": index,
                    } as React.CSSProperties
                  }
                  layout={merged}
                  transition={{
                    duration: reducedMotion ? 0 : 0.5,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                >
                  <span className="editorial-fragment-source">
                    {fragment.source}
                  </span>
                  <strong>{fragment.title}</strong>
                  <small>{fragment.meta}</small>
                </motion.button>
              ))}
            </div>
            <motion.div
              className="editorial-consolidated-card"
              layout={merged}
              animate={{ opacity: merged ? 1 : 0.55, scale: merged ? 1 : 0.96 }}
              transition={{ duration: reducedMotion ? 0 : 0.45 }}
            >
              <div className="editorial-consolidated-top">
                <span>UNIFLOW</span>
                <span className="editorial-live-dot">● PREVIEW</span>
              </div>
              <p className="editorial-consolidated-kicker">TODAY &amp; SOON</p>
              <h3>Everything that matters next.</h3>
              <div className="editorial-mini-row">
                <b>19</b>
                <span>
                  <strong>Student support scholarship</strong>
                  <small>Deadline · source visible</small>
                </span>
              </div>
              <div className="editorial-mini-row">
                <b>22</b>
                <span>
                  <strong>Campus open-air evening</strong>
                  <small>Event · publisher visible</small>
                </span>
              </div>
              <div className="editorial-consolidated-footer">
                Discover → verify → act
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  )
}

function EditorialWalkthrough() {
  const [activeStep, setActiveStep] = useState<"discover" | "verify" | "act">(
    "discover",
  )
  const reducedMotion = useReducedMotion() ?? false
  const steps = [
    {
      id: "discover" as const,
      number: "01",
      label: "Discover",
      copy: "A focused feed brings the next useful thing to the surface.",
    },
    {
      id: "verify" as const,
      number: "02",
      label: "Verify",
      copy: "Publisher, document date, and review state stay close to the claim.",
    },
    {
      id: "act" as const,
      number: "03",
      label: "Act",
      copy: "The relevant next step is clear without hiding the original source.",
    },
  ]
  const previews = {
    discover: (
      <div className="walkthrough-interface">
        <div className="walkthrough-interface-head">
          <span>Today &amp; Soon</span>
          <b>For you</b>
        </div>
        <h3>Your week, at a glance.</h3>
        <div className="walkthrough-interface-list">
          <div>
            <b>19</b>
            <span>
              <small>SCHOLARSHIP</small>
              <strong>Student support scholarship</strong>
              <em>Deadline · 5:00 PM IST</em>
            </span>
          </div>
          <div>
            <b>22</b>
            <span>
              <small>EVENT</small>
              <strong>Campus open-air evening</strong>
              <em>Central courtyard · 6:30 PM</em>
            </span>
          </div>
        </div>
        <div className="walkthrough-interface-footer">
          4 items worth your attention
        </div>
      </div>
    ),
    verify: (
      <div className="walkthrough-interface">
        <div className="walkthrough-interface-head">
          <span>Source trail</span>
          <b>Item detail</b>
        </div>
        <div className="walkthrough-source-label">
          SCHOLARSHIP · ILLUSTRATIVE
        </div>
        <h3>Student support scholarship</h3>
        <div className="walkthrough-source-grid">
          <span>
            Publisher<strong>Student support office</strong>
          </span>
          <span>
            Document date<strong>12 Oct 2026</strong>
          </span>
          <span>
            Review status<strong>Preview state</strong>
          </span>
          <span>
            Original source<strong>Student support notice</strong>
          </span>
        </div>
        <div className="walkthrough-verified">
          ● Source context stays visible
        </div>
      </div>
    ),
    act: (
      <div className="walkthrough-interface">
        <div className="walkthrough-interface-head">
          <span>Next step</span>
          <b>Ready to act</b>
        </div>
        <div className="walkthrough-action-date">
          19 OCT <strong>5:00 PM IST</strong>
        </div>
        <h3>Prepare your application.</h3>
        <p>
          Review the example eligibility criteria and gather the documents
          requested by the publisher.
        </p>
        <button type="button">Review source action ↗</button>
        <div className="walkthrough-action-note">
          Prototype action only · no submission is connected.
        </div>
      </div>
    ),
  }

  return (
    <section
      id="how-it-works"
      className="editorial-walkthrough-section scroll-mt-20 px-6 py-16 sm:py-24 lg:px-8"
      aria-labelledby="walkthrough-title"
    >
      <div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:items-center lg:gap-20">
        <div>
          <p className="editorial-kicker">A calmer decision loop</p>
          <h2
            id="walkthrough-title"
            className="mt-4 text-5xl font-black leading-[0.92] tracking-[-0.07em] text-[#17131D] sm:text-7xl"
          >
            Discover.
            <br />
            <span>Verify.</span>
            <br />
            Act.
          </h2>
          <p className="mt-6 max-w-md text-base leading-7 text-[#57505E]">
            The interface changes with the question a student is asking—not just
            the page they are on.
          </p>
          <div
            className="mt-10 grid gap-2"
            role="tablist"
            aria-label="How UniFlow works"
          >
            {steps.map((step) => (
              <button
                key={step.id}
                id={`editorial-step-${step.id}`}
                type="button"
                role="tab"
                aria-selected={activeStep === step.id}
                tabIndex={activeStep === step.id ? 0 : -1}
                onClick={() => setActiveStep(step.id)}
                className={`editorial-step ${
                  activeStep === step.id ? "is-active" : ""
                }`}
              >
                <span>{step.number}</span>
                <span>
                  <strong>{step.label}</strong>
                  <small>{step.copy}</small>
                </span>
                <i aria-hidden="true">↗</i>
              </button>
            ))}
          </div>
        </div>
        <div className="editorial-walkthrough-stage">
          <div className="editorial-stage-topline">
            <span>UniFlow / student view</span>
            <span>Illustrative interface</span>
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={activeStep}
              initial={reducedMotion ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reducedMotion ? undefined : { opacity: 0, y: -14 }}
              transition={{
                duration: reducedMotion ? 0 : 0.35,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              {previews[activeStep]}
            </motion.div>
          </AnimatePresence>
          <div className="editorial-stage-bottomline">
            <span>01 / 03</span>
            <span>Source-aware campus information</span>
          </div>
        </div>
      </div>
    </section>
  )
}

type WalkthroughStep = "discover" | "verify" | "act"

function CampusWalkthrough() {
  const [activeStep, setActiveStep] = useState<WalkthroughStep>("discover")
  const reducedMotion = useReducedMotion() ?? false
  const steps: {
    id: WalkthroughStep
    number: string
    label: string
    copy: string
  }[] = [
    {
      id: "discover",
      number: "01",
      label: "Discover",
      copy: "Find events that match your interests.",
    },
    {
      id: "verify",
      number: "02",
      label: "Verify",
      copy: "See who published it, where it came from, and when it was reviewed.",
    },
    {
      id: "act",
      number: "03",
      label: "Act",
      copy: "Follow the relevant next step with the source in view.",
    },
  ]

  const handleStepKeys = (
    keyboardEvent: React.KeyboardEvent<HTMLDivElement>,
  ) => {
    if (
      ![
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
        "ArrowUp",
        "ArrowDown",
      ].includes(keyboardEvent.key)
    )
      return
    keyboardEvent.preventDefault()
    const current = steps.findIndex((step) => step.id === activeStep)
    const next =
      keyboardEvent.key === "Home"
        ? 0
        : keyboardEvent.key === "End"
          ? steps.length - 1
          : keyboardEvent.key === "ArrowRight" ||
              keyboardEvent.key === "ArrowDown"
            ? (current + 1) % steps.length
            : (current - 1 + steps.length) % steps.length
    setActiveStep(steps[next].id)
    window.requestAnimationFrame(() =>
      document.getElementById(`walkthrough-tab-${steps[next].id}`)?.focus(),
    )
  }

  const preview = {
    discover: (
      <div className="flex h-full flex-col bg-[#FAFAF8] px-5 py-8">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#74677D]">
            Today & Soon
          </p>
          <h3 className="text-2xl font-black text-[#111111]">
            A feed for campus life
          </h3>
        </div>
        <div className="mb-6 flex gap-2 overflow-x-hidden">
          <span className="rounded-full bg-[#111111] px-4 py-1.5 text-xs font-bold text-white">
            All
          </span>
          <span className="rounded-full bg-[#F0E3FB] px-4 py-1.5 text-xs font-bold text-[#4E3262]">
            Deadlines
          </span>
          <span className="rounded-full bg-neutral-100 px-4 py-1.5 text-xs font-bold text-neutral-600">
            Events
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-4">
          {[
            ["19", "Scholarship", "Student support scholarship"],
            ["22", "Event", "Campus open-air evening"],
          ].map(([date, category, title]) => (
            <div
              key={title}
              className="flex gap-3 rounded-2xl border border-neutral-100 bg-white p-3 shadow-sm"
            >
              <div className="grid h-14 w-12 shrink-0 place-items-center rounded-lg bg-[#F0E3FB] text-center">
                <span className="text-lg font-black text-[#30213D]">
                  {date}
                </span>
                <span className="text-[0.55rem] font-bold uppercase tracking-wider text-[#74677D]">
                  Oct
                </span>
              </div>
              <div className="flex flex-1 flex-col justify-center">
                <p className="text-xs font-bold uppercase tracking-wider text-[#6A477E]">
                  {category}
                </p>
                <h4 className="mt-1 line-clamp-2 text-sm font-black leading-snug text-[#111111]">
                  {title}
                </h4>
                <p className="mt-auto pt-1 text-xs text-neutral-500">
                  Example item · for you
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
    verify: (
      <div className="flex h-full flex-col bg-white px-5 py-8">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#74677D]">
            Check the context
          </p>
          <h3 className="text-2xl font-black text-[#111111]">Before you act</h3>
        </div>
        <div className="rounded-2xl border border-[#D7C4E6] bg-[#FAF7FC] p-4">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-bold uppercase tracking-wider text-[#7C429C]">
              Scholarship
            </span>
            <span className="rounded-full bg-[#F0E3FB] px-2.5 py-1 text-[0.65rem] font-bold text-[#4E3262]">
              Illustrative
            </span>
          </div>
          <h4 className="mt-3 text-base font-black text-[#111111]">
            Student support scholarship
          </h4>
          <dl className="mt-4 space-y-3 border-t border-[#E9DFEF] pt-4 text-xs">
            <div className="flex justify-between gap-3">
              <dt className="text-[#74677D]">Publisher</dt>
              <dd className="text-right font-semibold text-[#30213D]">
                Student support office
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#74677D]">Document date</dt>
              <dd className="font-semibold text-[#30213D]">12 Oct 2026</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-[#74677D]">Review status</dt>
              <dd className="font-semibold text-[#30213D]">Preview state</dd>
            </div>
          </dl>
        </div>
        <p className="mt-auto text-xs leading-5 text-[#74677D]">
          Source details stay visible so students can judge what is current and
          trustworthy.
        </p>
      </div>
    ),
    act: (
      <div className="flex h-full flex-col bg-[#FAFAF8] px-5 py-8">
        <div className="mb-5">
          <p className="text-xs font-bold uppercase tracking-widest text-[#74677D]">
            Take the next step
          </p>
          <h3 className="text-2xl font-black text-[#111111]">
            Act with context
          </h3>
        </div>
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-bold uppercase tracking-wider text-[#7C429C]">
            Application deadline
          </p>
          <h4 className="mt-2 text-base font-black text-[#111111]">
            19 October · 5:00 PM IST
          </h4>
          <p className="mt-2 text-xs leading-5 text-neutral-500">
            Review the original notice and prepare the documents requested by
            the publisher.
          </p>
          <button
            type="button"
            className="mt-4 min-h-10 w-full rounded-full bg-[#111111] px-4 text-xs font-bold text-white"
          >
            Open source action
          </button>
        </div>
        <p className="mt-auto text-xs leading-5 text-[#74677D]">
          Prototype action only — no external source or submission is connected.
        </p>
      </div>
    ),
  }

  return (
    <motion.section
      id="how-it-works"
      className="scroll-mt-20 relative overflow-hidden border-y border-neutral-200 bg-white px-6 py-16 sm:py-24 lg:px-8"
      initial={reducedMotion ? false : { opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{
        duration: reducedMotion ? 0 : 0.6,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="mx-auto grid max-w-[1100px] gap-12 lg:grid-cols-[1fr_340px] lg:items-center lg:gap-24">
        <div className="max-w-xl">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-neutral-400">
            Interactive product preview
          </p>
          <h2 className="whitespace-pre-line text-4xl font-black leading-[1.1] tracking-tight text-[#111111] sm:text-6xl">
            {"Discover.\nVerify.\nAct."}
          </h2>
          <p className="mt-6 text-lg leading-7 text-[#57535C]">
            A personalized campus feed, source-aware context, and a clear next
            step.
          </p>

          <div
            role="tablist"
            aria-label="How UniFlow works"
            onKeyDown={handleStepKeys}
            className="mt-12 grid gap-2"
          >
            {steps.map((step) => {
              const selected = activeStep === step.id
              return (
                <button
                  key={step.id}
                  id={`walkthrough-tab-${step.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="campus-walkthrough-preview"
                  tabIndex={selected ? 0 : -1}
                  onClick={() => setActiveStep(step.id)}
                  className={`flex w-full items-start gap-5 rounded-2xl border-2 p-5 text-left transition-all duration-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111] ${
                    selected
                      ? "border-[#111111] bg-white shadow-sm"
                      : "border-transparent opacity-60 hover:bg-neutral-50 hover:opacity-100"
                  }`}
                >
                  <span
                    className={`mt-0.5 text-sm font-black transition-colors duration-300 ${
                      selected ? "text-[#111111]" : "text-neutral-400"
                    }`}
                  >
                    {step.number}
                  </span>
                  <div>
                    <span
                      className={`block text-xl font-black transition-colors duration-300 ${
                        selected ? "text-[#111111]" : "text-neutral-600"
                      }`}
                    >
                      {step.label}
                    </span>
                    <span className="mt-1 block text-sm leading-6 text-neutral-500">
                      {step.copy}
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[320px] sm:max-w-[360px] lg:mx-0 lg:max-w-[340px]">
          <div className="pointer-events-none absolute left-1/2 top-1/2 w-full max-w-[140%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#EBD9FA] opacity-70 blur-[80px] aspect-square" />

          <motion.div
            className="relative z-10 mx-auto aspect-[9/19] w-full overflow-hidden rounded-[2.5rem] border-[8px] border-[#111111] bg-white shadow-2xl"
            initial={reducedMotion ? false : { rotate: 4, y: 30 }}
            whileInView={{ rotate: 0, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{
              duration: reducedMotion ? 0 : 0.7,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <div className="absolute left-1/2 top-0 z-20 h-5 w-24 -translate-x-1/2 rounded-b-xl bg-[#111111]" />

            <div
              id="campus-walkthrough-preview"
              className="relative h-full w-full overflow-hidden bg-[#FAFAF8]"
            >
              <AnimatePresence mode="popLayout" initial={false}>
                <motion.div
                  key={activeStep}
                  className="absolute inset-0"
                  initial={reducedMotion ? false : { opacity: 0, scale: 0.96 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.96 }}
                  transition={{ duration: 0.3, ease: "easeOut" }}
                >
                  {preview[activeStep]}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.section>
  )
}

function PeopleIllustration({ dark = false }: { dark?: boolean }) {
  return (
    <img
      src={dark ? panelIllustrations.clubs : panelIllustrations.students}
      alt={
        dark
          ? "Detailed archival illustration of a group organizing together"
          : "Detailed archival illustration of a group celebrating together"
      }
      className={`panel-illustration h-64 w-full object-cover object-top ${
        dark ? "panel-illustration-dark" : ""
      }`}
    />
  )
}

function DualPanelSection({
  onExplore,
  onCreate,
}: {
  onExplore: (event: React.MouseEvent<HTMLAnchorElement>) => void
  onCreate: (event: React.MouseEvent<HTMLAnchorElement>) => void
}) {
  const reducedMotion = useReducedMotion() ?? false
  const studentFeatures = [
    "Discover notices, deadlines, and events.",
    "Find opportunities that match your interests.",
    "Verify the publisher and original source.",
    "Act on the next step with context.",
  ]
  const clubFeatures = [
    "Turn notices and posters into structured drafts.",
    "Review extracted fields before publication.",
    "Keep publisher and source details visible.",
    "Publish clearer updates for students.",
  ]

  return (
    <section id="clubs" className="scroll-mt-24 px-6 py-14 sm:py-20 lg:px-8">
      <div className="mx-auto max-w-[1100px]">
        <motion.h2
          className="text-center text-[2rem] font-black leading-tight tracking-tight text-[#111111] sm:text-5xl"
          initial={reducedMotion ? false : { opacity: 0.6, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{
            duration: reducedMotion ? 0 : 0.5,
            ease: [0.22, 1, 0.36, 1],
          }}
        >
          One campus,
          <br />
          <span className="title-underline">
            two ways in.
            <motion.span
              aria-hidden="true"
              className="title-underline-line"
              initial={reducedMotion ? false : { scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true, amount: 0.8 }}
              transition={{
                duration: reducedMotion ? 0 : 0.45,
                delay: reducedMotion ? 0 : 0.32,
                ease: [0.22, 1, 0.36, 1],
              }}
            />
          </span>
        </motion.h2>
        <div className="mt-12 grid items-stretch gap-6 md:grid-cols-2 lg:gap-8">
          <motion.article
            className="student-panel student-panel-entry relative flex flex-col overflow-hidden rounded-3xl p-8 md:min-h-[36rem]"
            initial={
              reducedMotion
                ? false
                : {
                    opacity: 0.6,
                    x: "var(--panel-enter-x)",
                    y: "var(--panel-enter-y)",
                  }
            }
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{
              duration: reducedMotion ? 0 : 0.6,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <span className="w-fit rounded-full bg-[#111111] px-5 py-2 text-sm font-bold text-white">
              Students
            </span>
            <ul className="mt-7 space-y-4">
              {studentFeatures.map((feature, index) => (
                <li
                  key={feature}
                  className="flex items-start gap-3 text-sm font-semibold leading-6 text-[#292929]"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/70">
                    <Icon
                      name={
                        (["search", "users", "ticket", "file"] as IconName[])[
                          index
                        ]
                      }
                      className="size-3.5"
                    />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <a
              href="/events"
              onClick={onExplore}
              className="relative z-10 mt-7 inline-flex min-h-11 w-fit items-center gap-2 text-sm font-black text-[#111111] underline decoration-black/30 underline-offset-4 transition-colors hover:text-black/65 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#111111]"
            >
              Explore the campus feed
              <Icon name="arrow" className="size-4" />
            </a>
            <div className="mt-auto -mb-8 -ml-8 -mr-8 pt-6">
              <PeopleIllustration />
            </div>
          </motion.article>

          <motion.article
            className="club-panel-entry relative flex flex-col overflow-hidden rounded-3xl bg-[#111111] p-8 text-white md:min-h-[36rem]"
            initial={
              reducedMotion
                ? false
                : {
                    opacity: 0.6,
                    x: "var(--panel-enter-x)",
                    y: "var(--panel-enter-y)",
                  }
            }
            whileInView={{ opacity: 1, x: 0, y: 0 }}
            viewport={{ once: true, amount: 0.15 }}
            transition={{
              duration: reducedMotion ? 0 : 0.6,
              delay: reducedMotion ? 0 : 0.12,
              ease: [0.22, 1, 0.36, 1],
            }}
          >
            <span className="w-fit rounded-full border border-white/15 bg-[#2B2B2B] px-5 py-2 text-sm font-bold text-white">
              Club organizers
            </span>
            <ul className="mt-7 space-y-4">
              {clubFeatures.map((feature, index) => (
                <li
                  key={feature}
                  className="flex items-start gap-3 text-sm font-semibold leading-6 text-[#D1D1D1]"
                >
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-white/10 text-white">
                    <Icon
                      name={
                        ([
                          "upload",
                          "users",
                          "ticket",
                          "calendar",
                        ] as IconName[])[index]
                      }
                      className="size-3.5"
                    />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>
            <a
              href="/poster-to-event"
              onClick={onCreate}
              className="relative z-10 mt-7 inline-flex min-h-11 w-fit items-center gap-2 text-sm font-black text-white underline decoration-white/30 underline-offset-4 transition-colors hover:text-white/70 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white"
            >
              Prepare a campus update
              <Icon name="arrow" className="size-4" />
            </a>
            <div className="mt-auto -mb-8 -ml-8 -mr-8 pt-6">
              <PeopleIllustration dark />
            </div>
          </motion.article>
        </div>
      </div>
    </section>
  )
}

type OrganizerToolTab = "upload" | "extract" | "review" | "publish"
type PublishingField = "title" | "category" | "date" | "audience" | "venue" | "source"

const initialPublishingFields: Record<PublishingField, string> = {
  title: "Build Your First Web App",
  category: "Technical workshop",
  date: "18 October 2026 · 4:00 PM",
  audience: "All interested students",
  venue: "Innovation Lab",
  source: "Campus Code Collective · workshop.jpg",
}

function OrganizerToolsShowcase() {
  const [activeTab, setActiveTab] = useState<OrganizerToolTab>("upload")
  const [selectedFile, setSelectedFile] = useState("")
  const [fileError, setFileError] = useState("")
  const [fields, setFields] = useState(initialPublishingFields)
  const [reviewed, setReviewed] = useState(false)
  const [published, setPublished] = useState(false)
  const reducedMotion = useReducedMotion() ?? false
  const tabs: { id: OrganizerToolTab; label: string; note: string }[] = [
    { id: "upload", label: "Upload", note: "Add a source document" },
    { id: "extract", label: "AI Extraction", note: "Structure the notice" },
    { id: "review", label: "Human Review", note: "Edit before approval" },
    {
      id: "publish",
      label: "Approve & Publish",
      note: "Confirm the final draft",
    },
  ]

  const requiredFields = [
    "title",
    "category",
    "date",
    "audience",
    "source",
  ] as const
  const missingFields = requiredFields.filter((field) => !fields[field].trim())
  const canPublish =
    Boolean(selectedFile) && reviewed && missingFields.length === 0

  const selectSample = () => {
    setSelectedFile("workshop.jpg")
    setFileError("")
    setPublished(false)
  }

  const handleFile = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith("image/")) {
      setFileError("Choose an image file such as JPG, PNG, or WEBP.")
      setSelectedFile("")
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setFileError("Keep source files under 5 MB for this prototype.")
      setSelectedFile("")
      return
    }
    setSelectedFile(file.name)
    setFileError("")
    setPublished(false)
  }

  const updateField = (field: PublishingField, value: string) => {
    setFields((current) => ({ ...current, [field]: value }))
    setPublished(false)
  }

  const handleTabKeys = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return
    event.preventDefault()
    const current = tabs.findIndex((tab) => tab.id === activeTab)
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : event.key === "ArrowRight"
            ? (current + 1) % tabs.length
            : (current - 1 + tabs.length) % tabs.length
    setActiveTab(tabs[next].id)
    window.requestAnimationFrame(() =>
      document.getElementById(`organizer-tab-${tabs[next].id}`)?.focus(),
    )
  }

  const goTo = (tab: OrganizerToolTab) => {
    setActiveTab(tab)
    if (tab === "review") setReviewed(false)
  }

  const sourcePreview = (
    <div className="relative overflow-hidden rounded-xl border border-white/10 bg-[#242126]">
      <img
        src={eventPhotos[5].src}
        alt="Illustrative campus workshop poster preview"
        className="aspect-[4/3] w-full object-cover opacity-75"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-[#17131d] via-transparent to-transparent" />
      <div className="absolute inset-x-4 bottom-4">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.16em] text-[#F4A9CA]">
          Source document
        </p>
        <p className="mt-1 text-sm font-black text-white">
          {selectedFile || "No document selected"}
        </p>
      </div>
    </div>
  )

  const fieldLabels: Record<PublishingField, string> = {
    title: "Title",
    category: "Category",
    date: "Date and time",
    audience: "Audience",
    venue: "Venue",
    source: "Source information",
  }

  const editFields = (
    <div className="grid gap-4 sm:grid-cols-2">
      {(Object.keys(fields) as PublishingField[]).map((field) => (
        <label
          key={field}
          className={
            field === "title" || field === "source" ? "sm:col-span-2" : ""
          }
        >
          <span className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-[#9B91A2]">
            {fieldLabels[field]}
          </span>
          <input
            id={`publishing-${field}`}
            name={`publishing-${field}`}
            value={fields[field]}
            onChange={(event) => updateField(field, event.target.value)}
            className="mt-2 min-h-11 w-full rounded-lg border border-white/10 bg-[#242126] px-3 text-sm text-white outline-none transition-colors placeholder:text-[#716978] focus:border-[#CFA8E4] focus:ring-2 focus:ring-[#7C429C]/40"
          />
          {field === "date" && (
            <span className="mt-1 block text-[0.68rem] text-amber-200/80">
              Confirm the time against the original document.
            </span>
          )}
        </label>
      ))}
    </div>
  )

  const uploadPreview = (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr] lg:items-center">
      {sourcePreview}
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#F4A9CA]">
          Step 01 · Upload
        </p>
        <h3 className="mt-2 text-2xl font-black text-white sm:text-3xl">
          Start with the notice, not a blank form.
        </h3>
        <p className="mt-3 max-w-xl text-sm leading-6 text-[#B8AFBE]">
          Add a campus poster or notice. This local prototype validates the
          file, then uses clearly labeled sample extraction data.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-white px-4 text-sm font-black text-[#17131D] transition-transform hover:-translate-y-0.5">
            <Icon name="upload" className="size-4" />
            Choose image
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={handleFile}
              className="sr-only"
            />
          </label>
          <button
            type="button"
            onClick={selectSample}
            className="min-h-11 rounded-full border border-white/20 px-4 text-sm font-bold text-white hover:border-white/50"
          >
            Use sample poster
          </button>
        </div>
        <p className="mt-4 text-xs text-[#8F8698]">
          JPG, PNG, or WEBP · 5 MB maximum · illustrative prototype
        </p>
        {fileError && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-xs font-semibold text-rose-100"
          >
            {fileError}
          </p>
        )}
        {selectedFile && (
          <p
            role="status"
            className="mt-4 rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-3 py-2 text-xs font-semibold text-emerald-100"
          >
            Ready: {selectedFile}
          </p>
        )}
        <button
          type="button"
          disabled={!selectedFile}
          onClick={() => goTo("extract")}
          className="mt-6 min-h-11 rounded-full bg-[#F4A9CA] px-5 text-sm font-black text-[#17131D] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue to extraction{" "}
          <Icon name="arrow" className="ml-2 inline size-4" />
        </button>
      </div>
    </div>
  )

  const extractionPreview = (
    <div className="grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
      {sourcePreview}
      <div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#F4A9CA]">
              Step 02 · AI Extraction
            </p>
            <h3 className="mt-2 text-2xl font-black text-white">
              A structured draft, ready for a human.
            </h3>
          </div>
          <span className="rounded-full border border-[#CFA8E4]/30 bg-[#7C429C]/20 px-3 py-1.5 text-[0.68rem] font-bold text-[#E6D5F0]">
            Simulated extraction
          </span>
        </div>
        <p className="mt-3 text-sm leading-6 text-[#B8AFBE]">
          Sample values are shown to demonstrate the workflow. No live AI API is
          connected.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {([
            "title",
            "category",
            "date",
            "audience",
            "venue",
            "source",
          ] as PublishingField[]).map((field) => (
            <div
              key={field}
              className="rounded-lg border border-white/10 bg-[#242126] p-3"
            >
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[#8F8698]">
                {fieldLabels[field]}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {fields[field] || "Missing field"}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <span className="inline-flex items-center gap-2 rounded-full border border-amber-200/20 bg-amber-200/10 px-3 py-1.5 text-xs font-bold text-amber-100">
            <span className="size-1.5 rounded-full bg-amber-300" /> Date needs
            confirmation
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-emerald-200/10 px-3 py-1.5 text-xs font-bold text-emerald-100">
            <span className="size-1.5 rounded-full bg-emerald-300" /> Source
            detected
          </span>
        </div>
        <button
          type="button"
          onClick={() => goTo("review")}
          className="mt-6 min-h-11 rounded-full bg-white px-5 text-sm font-black text-[#17131D]"
        >
          Open human review <Icon name="arrow" className="ml-2 inline size-4" />
        </button>
      </div>
    </div>
  )

  const reviewPreview = (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#F4A9CA]">
            Step 03 · Human Review
          </p>
          <h3 className="mt-2 text-2xl font-black text-white">
            You stay accountable for every field.
          </h3>
        </div>
        <span
          className={`rounded-full border px-3 py-1.5 text-[0.68rem] font-bold ${
            reviewed
              ? "border-emerald-200/20 bg-emerald-200/10 text-emerald-100"
              : "border-amber-200/20 bg-amber-200/10 text-amber-100"
          }`}
        >
          {reviewed ? "Review complete" : "Review required"}
        </span>
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[0.72fr_1.28fr]">
        {sourcePreview}
        <div>
          {editFields}
          {missingFields.length > 0 && (
            <p
              role="alert"
              className="mt-4 rounded-lg border border-rose-300/30 bg-rose-300/10 px-3 py-2 text-xs font-semibold text-rose-100"
            >
              Complete required fields before approval:{" "}
              {missingFields.map((field) => fieldLabels[field]).join(", ")}.
            </p>
          )}
          <label className="mt-5 flex items-start gap-3 text-sm text-[#D8D1DD]">
            <input
              type="checkbox"
              checked={reviewed}
              onChange={(event) => setReviewed(event.target.checked)}
              className="mt-1 size-4 accent-[#F4A9CA]"
            />
            <span>
              I reviewed these extracted details against the original document.
            </span>
          </label>
          <button
            type="button"
            onClick={() => goTo("publish")}
            disabled={!reviewed || missingFields.length > 0}
            className="mt-6 min-h-11 rounded-full bg-[#F4A9CA] px-5 text-sm font-black text-[#17131D] disabled:cursor-not-allowed disabled:opacity-40"
          >
            Continue to approval{" "}
            <Icon name="arrow" className="ml-2 inline size-4" />
          </button>
        </div>
      </div>
    </div>
  )

  const publishPreview = (
    <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#F4A9CA]">
          Step 04 · Approve & Publish
        </p>
        <h3 className="mt-2 text-2xl font-black text-white">
          A final calm check before students see it.
        </h3>
        <p className="mt-3 text-sm leading-6 text-[#B8AFBE]">
          Publishing is simulated locally. Nothing is sent to a campus feed or
          backend.
        </p>
        <div className="mt-6 rounded-xl border border-white/10 bg-[#242126] p-5">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
            <div>
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[#8F8698]">
                Ready to publish
              </p>
              <p className="mt-1 text-lg font-black text-white">
                {fields.title || "Untitled notice"}
              </p>
            </div>
            <span className="rounded-full bg-[#7C429C]/25 px-3 py-1.5 text-xs font-bold text-[#E6D5F0]">
              Example draft
            </span>
          </div>
          <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            {([
              "category",
              "date",
              "audience",
              "venue",
              "source",
            ] as PublishingField[]).map((field) => (
              <div key={field}>
                <dt className="text-xs text-[#8F8698]">{fieldLabels[field]}</dt>
                <dd className="mt-1 font-semibold text-[#E9E4EC]">
                  {fields[field] || "Missing"}
                </dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="mt-5 space-y-3">
          {[
            ["Source document attached", Boolean(selectedFile)],
            ["Required fields complete", missingFields.length === 0],
            ["Human review confirmed", reviewed],
          ].map(([label, complete]) => (
            <div
              key={String(label)}
              className="flex items-center gap-3 text-sm font-semibold text-[#D8D1DD]"
            >
              <span
                className={`grid size-5 place-items-center rounded-full ${
                  complete
                    ? "bg-emerald-300 text-[#173326]"
                    : "bg-amber-200/20 text-amber-100"
                }`}
              >
                <Icon name={complete ? "check" : "file"} className="size-3" />
              </span>
              {String(label)}
            </div>
          ))}
        </div>
        <button
          type="button"
          disabled={!canPublish}
          onClick={() => setPublished(true)}
          className="mt-6 min-h-11 rounded-full bg-[#F4A9CA] px-5 text-sm font-black text-[#17131D] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Approve & simulate publish
        </button>
        {published && (
          <p
            role="status"
            className="mt-4 rounded-lg border border-emerald-200/20 bg-emerald-200/10 px-3 py-2 text-xs font-semibold text-emerald-100"
          >
            Published locally for this prototype. A real feed connection is not
            enabled.
          </p>
        )}
      </div>
      <div className="rounded-xl border border-white/10 bg-[#242126] p-5">
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[#8F8698]">
          Student-facing source trail
        </p>
        <div className="mt-5 space-y-4">
          {[
            "Published by Campus Code Collective",
            "Original document: workshop.jpg",
            "Human reviewed before publication",
            "Example item · not an official announcement",
          ].map((item, index) => (
            <div key={item} className="flex gap-3">
              <span className="mt-1 grid size-5 shrink-0 place-items-center rounded-full bg-[#7C429C]/30 text-[0.65rem] font-black text-[#E6D5F0]">
                {index + 1}
              </span>
              <p className="text-sm leading-5 text-[#D8D1DD]">{item}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  const previews = {
    upload: uploadPreview,
    extract: extractionPreview,
    review: reviewPreview,
    publish: publishPreview,
  }

  return (
    <motion.section
      className="organizer-workspace bg-white px-6 py-14 sm:py-20 lg:px-8"
      initial={reducedMotion ? false : { opacity: 0.6, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{
        duration: reducedMotion ? 0 : 0.45,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="mx-auto max-w-[1100px]">
        <div className="max-w-3xl">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#7C429C]">
            AI-assisted publishing workspace
          </p>
          <h2 className="mt-3 text-3xl font-black leading-tight tracking-tight sm:text-5xl">
            From campus notice to trusted draft.
          </h2>
          <p className="mt-4 text-base leading-7 text-[#57535C] sm:text-lg">
            Upload a source, structure the details, review what was extracted,
            and publish only when a human is ready to stand behind it.
          </p>
          <p className="mt-2 text-xs text-neutral-400">
            Local prototype simulation · no live AI, accounts, or publishing
            connection.
          </p>
        </div>
        <div className="mt-10 overflow-hidden rounded-2xl bg-[#17131D] p-4 shadow-[0_18px_46px_rgba(56,32,68,0.18)] sm:p-6 lg:p-8">
          <div
            role="tablist"
            aria-label="AI publishing workflow"
            onKeyDown={handleTabKeys}
            className="grid gap-2 border-b border-white/10 pb-5 sm:grid-cols-4"
          >
            {tabs.map((tab, index) => (
              <button
                key={tab.id}
                id={`organizer-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls="organizer-tools-preview"
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => setActiveTab(tab.id)}
                className={`group min-h-16 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#F4A9CA] ${
                  activeTab === tab.id
                    ? "bg-white text-[#17131D]"
                    : "text-[#A9A0AE] hover:bg-white/5 hover:text-white"
                }`}
              >
                <span className="flex items-center justify-between text-[0.65rem] font-bold uppercase tracking-[0.12em]">
                  <span>0{index + 1}</span>
                  <span
                    className={`size-2 rounded-full ${
                      activeTab === tab.id ? "bg-[#7C429C]" : "bg-white/20"
                    }`}
                  />
                </span>
                <span className="mt-2 block text-sm font-black">
                  {tab.label}
                </span>
                <span
                  className={`mt-1 block text-[0.68rem] ${
                    activeTab === tab.id ? "text-[#6F6674]" : "text-[#837A8A]"
                  }`}
                >
                  {tab.note}
                </span>
              </button>
            ))}
          </div>
          <div
            id="organizer-tools-preview"
            role="tabpanel"
            aria-labelledby={`organizer-tab-${activeTab}`}
            className="pt-6 lg:min-h-[31rem]"
          >
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.div
                key={activeTab}
                initial={reducedMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{
                  opacity: reducedMotion ? 1 : 0,
                  y: reducedMotion ? 0 : -8,
                }}
                transition={{ duration: reducedMotion ? 0 : 0.25 }}
              >
                {previews[activeTab]}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.section>
  )
}

type PosterDemoField = "title" | "date" | "startTime" | "venue" | "eligibility" | "registrationDeadline"

const emptyPosterDemo: Record<PosterDemoField, string> = {
  title: "",
  date: "",
  startTime: "",
  venue: "",
  eligibility: "",
  registrationDeadline: "",
}

function PosterSection({
  onCreate,
}: {
  onCreate: (event: React.MouseEvent<HTMLAnchorElement>) => void
}) {
  const reducedMotion = useReducedMotion() ?? false
  const [demoState, setDemoState] =
    useState<"initial" | "reading" | "complete">("initial")
  const [values, setValues] = useState(emptyPosterDemo)
  const [highlighted, setHighlighted] = useState(false)
  const readTimer = useRef<number | null>(null)
  const highlightTimer = useRef<number | null>(null)
  const previewDialog = useRef<HTMLDialogElement>(null)
  const extractedFields = new Set<PosterDemoField>([
    "title",
    "date",
    "startTime",
  ])
  const labels: Record<PosterDemoField, string> = {
    title: "Event title",
    date: "Date",
    startTime: "Start time",
    venue: "Venue",
    eligibility: "Eligibility",
    registrationDeadline: "Registration deadline",
  }

  useEffect(
    () => () => {
      if (readTimer.current) window.clearTimeout(readTimer.current)
      if (highlightTimer.current) window.clearTimeout(highlightTimer.current)
    },
    [],
  )

  const runDemo = () => {
    setDemoState("reading")
    readTimer.current = window.setTimeout(() => {
      setValues({
        title: "Build Your First Web App",
        date: "18 October",
        startTime: "4:00 PM",
        venue: "",
        eligibility: "",
        registrationDeadline: "",
      })
      setDemoState("complete")
      if (!reducedMotion) {
        setHighlighted(true)
        highlightTimer.current = window.setTimeout(
          () => setHighlighted(false),
          700,
        )
      }
    }, 800)
  }

  const resetDemo = () => {
    if (readTimer.current) window.clearTimeout(readTimer.current)
    if (highlightTimer.current) window.clearTimeout(highlightTimer.current)
    setValues(emptyPosterDemo)
    setDemoState("initial")
    setHighlighted(false)
  }

  return (
    <motion.section
      id="poster-feature"
      className="poster-demo-section scroll-mt-24 border-y border-neutral-200 bg-[#FAFAF8] px-6 py-14 sm:py-20 lg:px-8"
      initial={reducedMotion ? false : { opacity: 0.6, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.12 }}
      transition={{
        duration: reducedMotion ? 0 : 0.45,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="mx-auto max-w-[1100px]">
        <div className="grid items-end gap-5 lg:grid-cols-[1fr_0.8fr]">
          <div>
            <span className="inline-flex rounded-full bg-[#F0E3FB] px-3 py-1.5 text-xs font-black text-[#4E3262]">
              Interactive demo
            </span>
            <h2 className="mt-4 text-3xl font-black leading-[1.05] tracking-tight text-[#111111] sm:text-5xl">
              From poster to
              <br />
              event draft.
            </h2>
          </div>
          <p className="text-base leading-7 text-[#525252] sm:text-lg">
            Upload your poster. Review the details. Your event is ready to
            share.
          </p>
        </div>
        <div className="mt-10 grid overflow-hidden rounded-2xl border border-neutral-200 bg-white lg:grid-cols-[0.75fr_1.25fr]">
          <div className="border-b border-neutral-200 p-5 lg:border-b-0 lg:border-r sm:p-7">
            <div className="flex items-center justify-between">
              <p className="text-sm font-black text-[#111111]">
                Poster preview
              </p>
              <span className="text-xs text-neutral-400">workshop.jpg</span>
            </div>
            <div className="mt-4 overflow-hidden rounded-xl bg-[#111111]">
              <img
                src={eventPhotos[5].src}
                alt="Students collaborating around a laptop"
                className="h-44 w-full object-cover opacity-75"
              />
              <div className="p-6 text-white">
                <p className="text-xs font-bold uppercase tracking-widest text-[#B7CFFF]">
                  Campus Code Collective
                </p>
                <h3 className="mt-3 text-3xl font-black leading-none">
                  Build Your
                  <br />
                  First Web App
                </h3>
                <div className="mt-6 flex gap-7 border-t border-white/20 pt-4 text-xs">
                  <p>
                    <span className="block text-neutral-400">Date</span>
                    <strong className="mt-1 block">18 October</strong>
                  </p>
                  <p>
                    <span className="block text-neutral-400">Time</span>
                    <strong className="mt-1 block">4:00 PM</strong>
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-5 space-y-3">
              <button
                type="button"
                disabled={demoState === "reading"}
                onClick={runDemo}
                className="min-h-12 w-full rounded-full bg-[#111111] px-5 text-sm font-bold text-white hover:bg-neutral-800 hover:text-white disabled:cursor-wait disabled:bg-neutral-400 focus-visible:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
              >
                {demoState === "reading"
                  ? "Reading sample poster…"
                  : "Try with this poster"}
              </button>
              <a
                href="/poster-to-event"
                onClick={onCreate}
                className="inline-flex min-h-11 w-full items-center justify-center text-sm font-bold text-[#111111] underline decoration-neutral-300 underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#111111]"
              >
                Prefer typing? Create your event manually.
              </a>
            </div>
          </div>
          <div className="p-5 sm:p-7">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-100 pb-5">
              <div>
                <h3 className="text-lg font-black text-[#111111]">
                  Event details
                </h3>
                <p className="mt-1 text-xs leading-5 text-neutral-500">
                  Sample demonstration — live AI extraction is not connected.
                </p>
              </div>
              <p
                aria-live="polite"
                className="text-sm font-bold text-[#4E3262]"
              >
                {demoState === "reading" ? "Reading sample poster…" : ""}
              </p>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              {(Object.keys(labels) as PosterDemoField[]).map((field) => {
                const fromPoster =
                  demoState === "complete" && extractedFields.has(field)
                const missing =
                  demoState === "complete" &&
                  !extractedFields.has(field) &&
                  !values[field]
                return (
                  <label
                    key={field}
                    className={`block text-xs font-bold ${
                      missing ? "text-amber-800" : "text-neutral-600"
                    } ${
                      field === "title" || field === "registrationDeadline"
                        ? "sm:col-span-2"
                        : ""
                    }`}
                  >
                    <span className="flex min-h-5 flex-wrap items-center justify-between gap-2">
                      {labels[field]}
                      {fromPoster && (
                        <span className="rounded-full bg-[#F0E3FB] px-2 py-0.5 text-[0.65rem] text-[#4E3262]">
                          From poster
                        </span>
                      )}
                      {missing && (
                        <span className="text-[0.68rem] text-amber-700">
                          Not found in poster
                        </span>
                      )}
                    </span>
                    <input
                      value={values[field]}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          [field]: event.target.value,
                        }))
                      }
                      className={`mt-2 min-h-11 w-full rounded-lg border px-3 text-sm font-normal text-[#111111] outline-none transition-colors duration-300 focus:border-[#111111] focus:ring-2 focus:ring-[#EBD9FA] motion-reduce:transition-none ${
                        missing
                          ? "border-amber-400 bg-amber-50"
                          : highlighted && fromPoster
                            ? "border-[#CDB3DD] bg-[#F5EDFB]"
                            : "border-neutral-200 bg-white"
                      }`}
                    />
                    {field === "date" && fromPoster && (
                      <span className="mt-2 block text-[0.68rem] font-semibold text-amber-700">
                        Year missing — review required
                      </span>
                    )}
                  </label>
                )
              })}
            </div>
            {demoState === "complete" && (
              <div className="mt-6 flex flex-col gap-3 border-t border-neutral-100 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => previewDialog.current?.showModal()}
                  className="min-h-11 rounded-full bg-[#111111] px-5 text-sm font-bold text-white hover:bg-neutral-800 hover:text-white focus-visible:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
                >
                  Preview event
                </button>
                <button
                  type="button"
                  onClick={resetDemo}
                  className="min-h-11 text-sm font-bold text-[#111111] underline decoration-neutral-300 underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#111111]"
                >
                  Reset demo
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      <dialog
        ref={previewDialog}
        aria-labelledby="poster-demo-preview-title"
        className="m-auto w-[calc(100%-2rem)] max-w-xl rounded-2xl border border-neutral-200 bg-white p-0 text-[#111111] shadow-2xl backdrop:bg-black/55"
      >
        <div className="relative p-6 sm:p-8">
          <button
            type="button"
            aria-label="Close event preview"
            onClick={() => previewDialog.current?.close()}
            className="absolute right-4 top-4 grid size-11 place-items-center rounded-full border border-neutral-200 hover:bg-neutral-100 focus-visible:outline-2 focus-visible:outline-[#111111]"
          >
            <Icon name="close" className="size-5" />
          </button>
          <p className="pr-14 text-xs font-bold uppercase tracking-[0.14em] text-[#6A477E]">
            Demo preview
          </p>
          <h3
            id="poster-demo-preview-title"
            className="mt-3 pr-14 text-3xl font-black tracking-tight"
          >
            {values.title || "Not specified"}
          </h3>
          <dl className="mt-6 grid gap-5 border-y border-neutral-200 py-6 sm:grid-cols-2">
            {(Object.keys(labels) as PosterDemoField[])
              .filter((field) => field !== "title")
              .map((field) => (
                <div key={field}>
                  <dt className="text-xs font-bold text-neutral-400">
                    {labels[field]}
                  </dt>
                  <dd className="mt-1 text-sm font-semibold">
                    {values[field] || "Not specified"}
                  </dd>
                </div>
              ))}
          </dl>
          <p className="mt-5 text-xs leading-5 text-neutral-500">
            Preview only. This demonstration does not publish an event.
          </p>
        </div>
      </dialog>
    </motion.section>
  )
}

function CampusPhotoGallery() {
  const reducedMotion = useReducedMotion() ?? false
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const triggers = useRef<Array<HTMLButtonElement | null>>([])
  const lastOpenedIndex = useRef(0)
  const photos = [
    {
      src: eventPhotos[0].src,
      alt: "A student performing live on stage",
      caption: "A student performance bringing the campus audience together.",
    },
    {
      src: eventPhotos[3].src,
      alt: "A technology workshop with illuminated computers",
      caption: "A hands-on technology workshop and creative build session.",
    },
    {
      src: eventPhotos[1].src,
      alt: "Students competing in an athletics event",
      caption: "Students taking part in an energetic campus sports event.",
    },
    {
      src: eventPhotos[2].src,
      alt: "A student participating in a cultural celebration",
      caption:
        "A cultural celebration shaped by student traditions and expression.",
    },
    {
      src: eventPhotos[5].src,
      alt: "Students collaborating around a laptop",
      caption: "Students sharing ideas and collaborating on a campus project.",
    },
    {
      src: eventPhotos[4].src,
      alt: "An audience enjoying a concert under stage lights",
      caption: "An audience enjoying a live event and the moment together.",
    },
  ]

  const openPhoto = (index: number) => {
    lastOpenedIndex.current = index
    setSelectedIndex(index)
    window.requestAnimationFrame(() => dialog.current?.showModal())
  }

  const closeLightbox = () => {
    dialog.current?.close()
  }

  const showAdjacent = (direction: number) => {
    setSelectedIndex((current) => {
      if (current === null) return 0
      return (current + direction + photos.length) % photos.length
    })
  }

  const selectedPhoto =
    selectedIndex === null ? photos[0] : photos[selectedIndex]

  return (
    <motion.section
      className="bg-white px-6 py-14 sm:py-20 lg:px-8"
      initial={reducedMotion ? false : { opacity: 0.6, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{
        duration: reducedMotion ? 0 : 0.45,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="mx-auto max-w-[1100px]">
        <div className="max-w-3xl">
          <h2 className="text-3xl font-black leading-tight tracking-tight text-[#111111] sm:text-5xl">
            Campus life, beyond the classroom.
          </h2>
          <p className="mt-4 text-base leading-7 text-[#57535C] sm:text-lg">
            The people, moments, and experiences that bring campus together.
          </p>
          <p className="mt-2 text-xs text-neutral-400">
            Illustrative photos — campus photos coming soon.
          </p>
        </div>

        <div className="mt-10 grid grid-cols-1 gap-4 min-[430px]:grid-cols-2 md:grid-cols-3">
          {photos.map((photo, index) => (
            <motion.button
              key={photo.src}
              ref={(node) => {
                triggers.current[index] = node
              }}
              type="button"
              aria-label={`Open photo ${index + 1}: ${photo.alt}`}
              onClick={() => openPhoto(index)}
              className="gallery-photo group aspect-[4/3] overflow-hidden rounded-xl bg-neutral-100 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#111111]"
              initial={reducedMotion ? false : { opacity: 0.65, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{
                duration: reducedMotion ? 0 : 0.5,
                delay: reducedMotion ? 0 : index * 0.07,
                ease: [0.22, 1, 0.36, 1],
              }}
            >
              <img
                src={photo.src}
                alt={photo.alt}
                className="gallery-photo-image size-full object-cover"
              />
            </motion.button>
          ))}
        </div>
      </div>

      <dialog
        ref={dialog}
        aria-labelledby="campus-gallery-caption"
        onClose={() => {
          setSelectedIndex(null)
          window.requestAnimationFrame(() =>
            triggers.current[lastOpenedIndex.current]?.focus(),
          )
        }}
        onKeyDown={(event) => {
          if (event.key === "ArrowLeft") {
            event.preventDefault()
            showAdjacent(-1)
          }
          if (event.key === "ArrowRight") {
            event.preventDefault()
            showAdjacent(1)
          }
        }}
        className="m-auto w-[calc(100%-2rem)] max-w-5xl rounded-2xl border border-neutral-200 bg-white p-0 text-[#111111] shadow-2xl backdrop:bg-black/70"
      >
        <div className="relative p-4 sm:p-6">
          <button
            type="button"
            aria-label="Close photo gallery"
            onClick={closeLightbox}
            className="absolute right-6 top-6 z-10 grid size-11 place-items-center rounded-full bg-white text-[#111111] shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
          >
            <Icon name="close" className="size-5" />
          </button>
          <img
            src={selectedPhoto.src}
            alt={selectedPhoto.alt}
            className="max-h-[70vh] w-full rounded-xl bg-neutral-100 object-contain"
          />
          <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <p
              id="campus-gallery-caption"
              className="text-sm leading-6 text-neutral-600"
            >
              {selectedPhoto.caption}
            </p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => showAdjacent(-1)}
                className="min-h-11 rounded-full border border-neutral-300 px-4 text-sm font-bold hover:border-[#111111] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
              >
                Previous
              </button>
              <button
                type="button"
                onClick={() => showAdjacent(1)}
                className="min-h-11 rounded-full bg-[#111111] px-4 text-sm font-bold text-white hover:bg-neutral-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
              >
                Next
              </button>
            </div>
          </div>
        </div>
      </dialog>
    </motion.section>
  )
}

function ClosingInvitation({
  onExplore,
  onCreate,
}: {
  onExplore: (event: React.MouseEvent<HTMLAnchorElement>) => void
  onCreate: (event: React.MouseEvent<HTMLAnchorElement>) => void
}) {
  const reducedMotion = useReducedMotion() ?? false

  return (
    <motion.section
      className="closing-invitation px-6 py-12 text-center sm:py-18 lg:px-8"
      initial={reducedMotion ? false : { opacity: 0.6, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{
        duration: reducedMotion ? 0 : 0.55,
        ease: [0.22, 1, 0.36, 1],
      }}
    >
      <div className="mx-auto max-w-3xl">
        <h2 className="text-3xl font-black leading-tight tracking-tight text-[#111111] sm:text-5xl">
          Your next campus memory
          <br />
          starts here.
        </h2>
        <p className="mt-5 text-base leading-7 text-[#57535C] sm:text-lg">
          Find your next event—or bring your own to life.
        </p>
        <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-6">
          <a
            href="/events"
            onClick={onExplore}
            className="inline-flex min-h-12 items-center justify-center rounded-full bg-[#111111] px-6 text-sm font-bold text-white hover:bg-neutral-800 hover:text-white focus-visible:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
          >
            Explore events
          </a>
          <a
            href="/poster-to-event"
            onClick={onCreate}
            className="inline-flex min-h-11 items-center text-sm font-bold text-[#111111] underline decoration-neutral-300 underline-offset-4 hover:text-neutral-600 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#111111]"
          >
            For club organizers →
          </a>
        </div>
      </div>
    </motion.section>
  )
}

function ExploreEventsPage({ onHome }: { onHome: (section?: string) => void }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [category, setCategory] =
    useState<"All" | "Technical" | "Cultural" | "Sports">("All")
  const [dateFilter, setDateFilter] = useState<"all" | "today" | "week">("all")
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)

  const normalizedSearch = search.trim().toLowerCase()
  const filteredEvents = exploreEvents.filter((event) => {
    const matchesSearch =
      normalizedSearch === "" ||
      [event.title, event.club].some((value) =>
        value.toLowerCase().includes(normalizedSearch),
      )
    const matchesCategory =
      category === "All" || event.filterCategory === category
    const matchesDate =
      dateFilter === "all" ||
      (dateFilter === "today" && event.dateGroup === "today") ||
      (dateFilter === "week" &&
        (event.dateGroup === "today" || event.dateGroup === "week"))

    return matchesSearch && matchesCategory && matchesDate
  })
  const filtersActive =
    normalizedSearch !== "" || category !== "All" || dateFilter !== "all"

  const clearFilters = () => {
    setSearch("")
    setCategory("All")
    setDateFilter("all")
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-white text-[#111111]">
      <header className="bg-white">
        <nav
          aria-label="Main navigation"
          className="mx-auto flex h-[4.5rem] max-w-[92rem] items-center justify-between px-5 lg:px-8"
        >
          <a
            href="/"
            aria-label="UniFlow home"
            onClick={(event) => {
              event.preventDefault()
              onHome()
            }}
            className="focus-visible:outline-2 focus-visible:outline-[#111111]"
          >
            <Logo />
          </a>
          <div className="hidden items-center gap-12 md:flex">
            <a
              href="/"
              onClick={(event) => {
                event.preventDefault()
                onHome()
              }}
              className="flex items-center gap-2 text-sm font-semibold text-neutral-600 hover:text-[#111111] focus-visible:outline-2 focus-visible:outline-[#111111]"
            >
              <Icon name="home" className="size-4" />
              Home
            </a>
            <a
              href="/events"
              aria-current="page"
              className="flex items-center gap-2 text-sm font-bold text-[#111111] focus-visible:outline-2 focus-visible:outline-[#111111]"
            >
              <Icon name="calendar" className="size-4" />
              Events
            </a>
            <a
              href="/#clubs"
              onClick={(event) => {
                event.preventDefault()
                onHome("clubs")
              }}
              className="flex items-center gap-2 text-sm font-semibold text-neutral-600 hover:text-[#111111] focus-visible:outline-2 focus-visible:outline-[#111111]"
            >
              <Icon name="users" className="size-4" />
              Clubs
            </a>
          </div>
          <a
            href="#event-results"
            className="hidden min-h-11 items-center rounded-full bg-[#111111] px-6 text-sm font-bold text-white hover:bg-neutral-800 hover:text-white focus-visible:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111] md:inline-flex"
          >
            Explore events
          </a>
          <button
            type="button"
            aria-expanded={menuOpen}
            aria-controls="explore-mobile-menu"
            aria-label={menuOpen ? "Close navigation" : "Open navigation"}
            onClick={() => setMenuOpen(!menuOpen)}
            className="grid size-11 place-items-center rounded-full border border-black/15 md:hidden"
          >
            <Icon name={menuOpen ? "close" : "menu"} />
          </button>
        </nav>
        {menuOpen && (
          <div
            id="explore-mobile-menu"
            className="mx-5 rounded-2xl border border-black/10 bg-white p-3 shadow-lg md:hidden"
          >
            <a
              href="/"
              onClick={(event) => {
                event.preventDefault()
                setMenuOpen(false)
                onHome()
              }}
              className="flex min-h-12 items-center gap-3 border-b border-neutral-100 px-3 text-sm font-bold"
            >
              <Icon name="home" className="size-4" />
              Home
            </a>
            <a
              href="/events"
              aria-current="page"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-12 items-center gap-3 border-b border-neutral-100 px-3 text-sm font-bold"
            >
              <Icon name="calendar" className="size-4" />
              Events
            </a>
            <a
              href="/#clubs"
              onClick={(event) => {
                event.preventDefault()
                setMenuOpen(false)
                onHome("clubs")
              }}
              className="flex min-h-12 items-center gap-3 px-3 text-sm font-bold"
            >
              <Icon name="users" className="size-4" />
              Clubs
            </a>
          </div>
        )}
      </header>

      <main>
        <section className="bg-[#F3E7FC] px-6 py-16 text-center sm:py-20">
          <div className="mx-auto max-w-3xl">
            <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-6xl">
              Find your next campus event.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-[#525252] sm:text-xl">
              Explore workshops, performances, competitions, and more.
            </p>
          </div>
        </section>

        <section className="border-b border-neutral-200 bg-white px-6 py-8 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="grid gap-6 lg:grid-cols-[1fr_auto_auto] lg:items-end">
              <label className="block text-sm font-bold text-[#111111]">
                Search
                <span className="mt-2 flex min-h-12 items-center gap-3 rounded-xl border border-neutral-300 bg-white px-4 focus-within:border-[#111111] focus-within:ring-2 focus-within:ring-[#EBD9FA]">
                  <Icon
                    name="search"
                    className="size-5 shrink-0 text-neutral-400"
                  />
                  <input
                    type="search"
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search events or clubs"
                    className="w-full bg-transparent text-sm font-normal text-[#111111] outline-none placeholder:text-neutral-400"
                  />
                </span>
              </label>

              <div className="min-w-0">
                <p
                  id="event-category-label"
                  className="text-sm font-bold text-[#111111]"
                >
                  Category
                </p>
                <Tabs
                  value={category}
                  onValueChange={(value) =>
                    setCategory(
                      value as "All" | "Technical" | "Cultural" | "Sports",
                    )
                  }
                  className="mt-2"
                >
                  <TabsList aria-labelledby="event-category-label">
                    {(["All", "Technical", "Cultural", "Sports"] as const).map(
                      (option) => (
                        <TabsTrigger key={option} value={option}>
                          {option}
                        </TabsTrigger>
                      ),
                    )}
                  </TabsList>
                </Tabs>
              </div>

              <label className="block text-sm font-bold text-[#111111]">
                Date
                <select
                  value={dateFilter}
                  onChange={(event) =>
                    setDateFilter(
                      event.target.value as "all" | "today" | "week",
                    )
                  }
                  className="mt-2 min-h-12 w-full rounded-xl border border-neutral-300 bg-white px-4 text-sm font-semibold text-[#111111] outline-none focus:border-[#111111] focus:ring-2 focus:ring-[#EBD9FA] lg:w-40"
                >
                  <option value="all">All upcoming</option>
                  <option value="today">Today</option>
                  <option value="week">This week</option>
                </select>
              </label>
            </div>

            {filtersActive && (
              <button
                type="button"
                onClick={clearFilters}
                className="mt-5 min-h-11 text-sm font-bold text-[#111111] underline decoration-neutral-300 underline-offset-4 focus-visible:outline-2 focus-visible:outline-[#111111]"
              >
                Clear filters
              </button>
            )}
          </div>
        </section>

        <section id="event-results" className="scroll-mt-4 px-6 py-14 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p
                className="text-sm font-bold text-[#111111]"
                aria-live="polite"
              >
                {filteredEvents.length}{" "}
                {filteredEvents.length === 1 ? "event" : "events"} found
              </p>
              <p className="text-xs text-neutral-400">
                Example events — prototype content
              </p>
            </div>

            {filteredEvents.length > 0 ? (
              <div className="mt-8 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {filteredEvents.map((event) => (
                  <article key={event.title} className="flex h-full flex-col">
                    <div className="shrink-0 aspect-[4/3] overflow-hidden rounded-2xl border border-neutral-200 bg-neutral-100">
                      <EventCoverImage
                        event={event}
                        className="size-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>
                    <div className="flex flex-1 flex-col pt-5">
                      <p className="text-xs font-bold uppercase tracking-[0.12em] text-neutral-500">
                        {event.category}
                      </p>
                      <h2 className="mt-2 text-xl font-black tracking-tight text-[#111111]">
                        {event.title}
                      </h2>
                      <p className="mt-1 text-sm text-neutral-500">
                        {event.club}
                      </p>
                      <div className="mt-auto pt-4 space-y-2 text-sm text-neutral-600">
                        <p className="flex items-center gap-2">
                          <Icon
                            name="calendar"
                            className="size-4 shrink-0 text-neutral-400"
                          />
                          {event.date} · {event.time}
                        </p>
                        <p className="flex items-center gap-2">
                          <Icon
                            name="pin"
                            className="size-4 shrink-0 text-neutral-400"
                          />
                          {event.venue}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedEvent(event)}
                        className="mt-5 inline-flex min-h-11 items-center text-sm font-bold text-[#111111] underline decoration-neutral-300 underline-offset-4 hover:text-neutral-600 focus-visible:outline-2 focus-visible:outline-[#111111]"
                      >
                        View details →
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-8 border-t border-neutral-200 py-16 text-center">
                <h2 className="text-2xl font-black text-[#111111]">
                  No events match your search.
                </h2>
                <p className="mt-3 text-base text-neutral-500">
                  Try another keyword or clear your filters.
                </p>
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-6 min-h-12 rounded-full bg-[#111111] px-6 text-sm font-bold text-white hover:bg-neutral-800 hover:text-white focus-visible:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
                >
                  Clear filters
                </button>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-7 px-6 py-9 sm:flex-row sm:items-center sm:justify-between lg:px-8">
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <a
              href="/"
              aria-label="Return to UniFlow home"
              onClick={(event) => {
                event.preventDefault()
                onHome()
              }}
            >
              <Logo compact />
            </a>
            <p className="text-xs text-neutral-500">
              Your campus. More connected.
            </p>
          </div>
          <p className="text-xs text-neutral-400">
            Example events for this visual prototype.
          </p>
        </div>
      </footer>

      <EventModal
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  )
}

export default function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [headerScrolled, setHeaderScrolled] = useState(false)
  const [page, setPage] = useState<"home" | "events" | "poster">(() => {
    if (window.location.pathname.endsWith("/poster-to-event")) return "poster"
    if (window.location.pathname.endsWith("/events")) return "events"
    return "home"
  })
  const nav = [
    ["How it works", "#how-it-works", "home"],
    ["Events", "/events", "calendar"],
    ["Clubs", "#clubs", "users"],
  ] as const

  useEffect(() => {
    const syncPage = () => {
      if (window.location.pathname.endsWith("/poster-to-event")) {
        setPage("poster")
      } else if (window.location.pathname.endsWith("/events")) {
        setPage("events")
      } else {
        setPage("home")
      }
    }
    window.addEventListener("popstate", syncPage)
    return () => window.removeEventListener("popstate", syncPage)
  }, [])

  useEffect(() => {
    const updateHeader = () => setHeaderScrolled(window.scrollY > 12)
    updateHeader()
    window.addEventListener("scroll", updateHeader, { passive: true })
    return () => window.removeEventListener("scroll", updateHeader)
  }, [])

  const openExplore = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    window.history.pushState({}, "", "/events")
    setPage("events")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  const openHome = (section?: string) => {
    window.history.pushState({}, "", section ? `/#${section}` : "/")
    setPage("home")
    window.setTimeout(() => {
      if (section) {
        document.getElementById(section)?.scrollIntoView()
      } else {
        window.scrollTo({ top: 0 })
      }
    }, 0)
  }

  const openPoster = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    window.history.pushState({}, "", "/poster-to-event")
    setPage("poster")
    window.scrollTo({ top: 0, behavior: "smooth" })
  }

  if (page === "events") {
    return <ExploreEventsPage onHome={openHome} />
  }

  if (page === "poster") {
    return <PosterToEventDemo onBack={() => openHome("poster-feature")} />
  }

  return (
    <div
      id="top"
      className="landing-page min-h-screen overflow-x-hidden bg-white text-[#111111]"
    >
      <header
        className={`landing-header sticky top-0 z-50 ${
          headerScrolled ? "landing-header-scrolled" : ""
        }`}
      >
        <nav
          aria-label="Main navigation"
          className="mx-auto grid h-16 max-w-[92rem] grid-cols-[minmax(0,1fr)_auto] items-center gap-2 px-4 md:grid-cols-[1fr_auto_1fr] md:px-8"
        >
          <a
            href="#top"
            aria-label="UniFlow home"
            className="w-fit min-w-0 focus-visible:outline-2 focus-visible:outline-[#111111]"
          >
            <HeaderLogo />
          </a>
          <div className="hidden items-center gap-8 md:flex">
            {nav.map(([label, href, icon]) => (
              <a
                key={label}
                href={href}
                onClick={label === "Events" ? openExplore : undefined}
                className={`flex items-center gap-2 text-[15px] font-medium hover:text-[#17131D] focus-visible:outline-2 focus-visible:outline-[#111111] ${"text-[#6B6770]"}`}
              >
                <Icon name={icon} className="size-[18px]" />
                {label}
              </a>
            ))}
          </div>
          <div className="flex items-center justify-end gap-2">
            <a
              href="#campus-inbox"
              className="inline-flex h-[38px] items-center rounded-full bg-[#111111] px-4 text-[13px] font-bold text-white hover:bg-neutral-800 hover:text-white focus-visible:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111] sm:px-5 sm:text-sm"
            >
              Explore preview
            </a>
            <button
              type="button"
              aria-expanded={menuOpen}
              aria-controls="mobile-menu"
              aria-label={menuOpen ? "Close navigation" : "Open navigation"}
              onClick={() => setMenuOpen(!menuOpen)}
              className="grid size-10 place-items-center rounded-full border border-black/15 text-[#17131D] focus-visible:outline-2 focus-visible:outline-[#111111] md:hidden"
            >
              <Icon name={menuOpen ? "close" : "menu"} className="size-5" />
            </button>
          </div>
        </nav>
        {menuOpen && (
          <div
            id="mobile-menu"
            className="absolute inset-x-4 top-[calc(100%+0.5rem)] rounded-2xl border border-black/10 bg-white p-3 shadow-lg md:hidden"
          >
            {nav.map(([label, href, icon]) => (
              <a
                key={label}
                href={href}
                onClick={(event) => {
                  setMenuOpen(false)
                  if (label === "Events") openExplore(event)
                }}
                className="flex min-h-12 items-center gap-3 border-b border-neutral-100 px-3 text-[15px] font-medium text-[#57535C] last:border-b-0 focus-visible:outline-2 focus-visible:outline-[#111111]"
              >
                <Icon name={icon} className="size-[18px]" />
                {label}
              </a>
            ))}
          </div>
        )}
      </header>

      <div className="lavender-wash">
        <main>
          <CampusHero photos={[eventPhotos[2], eventPhotos[0]]} />
        </main>
      </div>

      <main>
        <UpcomingEventsSection onExplore={openExplore} />
        <FragmentedInformationSection />
        <EditorialWalkthrough />

        <DualPanelSection onExplore={openExplore} onCreate={openPoster} />
        <OrganizerToolsShowcase />
        <PosterSection onCreate={openPoster} />
        <CampusPhotoGallery />
        <ClosingInvitation onExplore={openExplore} onCreate={openPoster} />
      </main>

      <footer className="border-t border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-7 px-6 py-9 sm:flex-row sm:justify-between lg:px-8">
          <div className="flex flex-col items-center gap-1 sm:items-start">
            <a
              href="#top"
              aria-label="Return to UniFlow home"
              className="focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#111111]"
            >
              <HeaderLogo />
            </a>
            <p className="text-xs text-neutral-500">
              Your campus. More connected.
            </p>
          </div>
          <nav
            aria-label="Footer navigation"
            className="flex flex-wrap justify-center gap-x-7 gap-y-3 text-sm font-semibold text-neutral-600"
          >
            <a
              href="#top"
              className="min-h-11 content-center hover:text-[#111111] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#111111]"
            >
              Home
            </a>
            <a
              href="/events"
              onClick={openExplore}
              className="min-h-11 content-center hover:text-[#111111] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#111111]"
            >
              Events
            </a>
            <a
              href="#clubs"
              className="min-h-11 content-center hover:text-[#111111] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#111111]"
            >
              Clubs
            </a>
          </nav>
        </div>
        <p
          id="prototype-note"
          className="scroll-mt-24 border-t border-neutral-100 px-6 py-3 text-center text-[0.7rem] text-neutral-400"
        >
          Prototype preview — accounts, AI extraction, and event publishing are
          not connected.
        </p>
      </footer>
    </div>
  )
}
