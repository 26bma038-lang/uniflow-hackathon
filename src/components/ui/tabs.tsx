import * as TabsPrimitive from "@radix-ui/react-tabs"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { LayoutGroup, motion, useReducedMotion } from "motion/react"
import {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react"
import type { ComponentPropsWithoutRef } from "react"
import { motionTokens } from "./tabs-utils/motion-tokens"
import styles from "./tabs-utils/tabs.module.css"

type RootProps = ComponentPropsWithoutRef<typeof TabsPrimitive.Root>

const TabsContext = createContext({
  active: "",
  layoutId: "tabs",
})

export function Tabs({
  value,
  defaultValue,
  onValueChange,
  className,
  ...props
}: RootProps) {
  const [internal, setInternal] = useState(defaultValue ?? "")
  const active = value ?? internal
  const layoutId = useId()

  const handleChange = (next: string) => {
    if (value === undefined) setInternal(next)
    onValueChange?.(next)
  }

  return (
    <TabsContext.Provider value={{ active, layoutId }}>
      <LayoutGroup id={layoutId}>
        <TabsPrimitive.Root
          {...props}
          className={[styles.root, className].filter(Boolean).join(" ")}
          value={active}
          onValueChange={handleChange}
        />
      </LayoutGroup>
    </TabsContext.Provider>
  )
}

export function TabsList({
  className,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  const { active } = useContext(TabsContext)
  const reduced = useReducedMotion()
  const shell = useRef<HTMLDivElement>(null)
  const viewport = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({
    overflow: false,
    left: false,
    right: false,
  })

  const update = useCallback(() => {
    const frame = shell.current
    const scroll = viewport.current
    if (!frame || !scroll) return
    const max = Math.max(0, scroll.scrollWidth - scroll.clientWidth)
    const next = {
      overflow: scroll.scrollWidth > frame.clientWidth + 1,
      left: scroll.scrollLeft > 1,
      right: scroll.scrollLeft < max - 1,
    }
    setEdges((previous) =>
      previous.overflow === next.overflow &&
      previous.left === next.left &&
      previous.right === next.right
        ? previous
        : next,
    )
  }, [])

  const reveal = useCallback(
    (tab: HTMLElement | null) => {
      const scroll = viewport.current
      if (!scroll || !tab) return
      const frame = scroll.getBoundingClientRect()
      const item = tab.getBoundingClientRect()
      const max = Math.max(0, scroll.scrollWidth - scroll.clientWidth)
      const left = frame.left + (scroll.scrollLeft > 1 ? 34 : 0)
      const right = frame.right - (scroll.scrollLeft < max - 1 ? 34 : 0)
      const delta =
        item.left < left
          ? item.left - left
          : item.right > right
            ? item.right - right
            : 0
      if (delta) {
        scroll.scrollBy({
          left: delta,
          behavior: reduced ? "instant" : "smooth",
        })
      }
    },
    [reduced],
  )

  useLayoutEffect(() => {
    const frame = shell.current
    const scroll = viewport.current
    const content = list.current
    if (!frame || !scroll || !content) return
    const observer = new ResizeObserver(update)
    observer.observe(frame)
    observer.observe(scroll)
    observer.observe(content)
    scroll.addEventListener("scroll", update, { passive: true })
    update()
    return () => {
      observer.disconnect()
      scroll.removeEventListener("scroll", update)
    }
  }, [update])

  useLayoutEffect(() => {
    reveal(
      list.current?.querySelector<HTMLElement>(
        '[role="tab"][data-state="active"]',
      ) ?? null,
    )
  }, [active, reveal])

  const scrollTabs = (direction: number) =>
    viewport.current?.scrollBy({
      left: direction * (viewport.current?.clientWidth ?? 0) * 0.75,
      behavior: reduced ? "instant" : "smooth",
    })

  return (
    <div
      ref={shell}
      className={styles.listShell}
      data-overflow={edges.overflow}
      data-left={edges.left}
      data-right={edges.right}
    >
      {edges.overflow && (
        <button
          type="button"
          className={`${styles.scrollButton} ${styles.scrollLeft}`}
          aria-label="Scroll categories left"
          disabled={!edges.left}
          onClick={() => scrollTabs(-1)}
        >
          <ChevronLeft width={17} height={17} aria-hidden="true" />
        </button>
      )}
      <motion.div
        ref={viewport}
        layoutScroll
        className={styles.viewport}
        onFocusCapture={(event) => {
          if (
            event.target instanceof HTMLElement &&
            event.target.getAttribute("role") === "tab"
          ) {
            reveal(event.target)
          }
        }}
      >
        <TabsPrimitive.List
          {...props}
          ref={list}
          className={[styles.list, className].filter(Boolean).join(" ")}
        />
      </motion.div>
      {edges.overflow && (
        <button
          type="button"
          className={`${styles.scrollButton} ${styles.scrollRight}`}
          aria-label="Scroll categories right"
          disabled={!edges.right}
          onClick={() => scrollTabs(1)}
        >
          <ChevronRight width={17} height={17} aria-hidden="true" />
        </button>
      )}
    </div>
  )
}

export function TabsTrigger({
  className,
  children,
  value,
  ...props
}: ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  const { active } = useContext(TabsContext)
  const reduced = useReducedMotion()

  return (
    <TabsPrimitive.Trigger
      {...props}
      value={value}
      data-value={value}
      className={[styles.trigger, className].filter(Boolean).join(" ")}
    >
      {active === value && (
        <motion.span
          className={styles.selection}
          layoutId="selection"
          layoutDependency={active}
          transition={reduced ? { duration: 0 } : motionTokens.spring.morph}
          aria-hidden="true"
        />
      )}
      <span className={styles.triggerLabel}>{children}</span>
    </TabsPrimitive.Trigger>
  )
}

export default Tabs
