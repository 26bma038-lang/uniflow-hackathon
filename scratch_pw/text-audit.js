// Bounded text audit. Usage from Playwright run_code: pass `phase` via globalThis.__phase ("before" | "after").
async (mcpPage) => {
  const phase = globalThis.__phase || "after"
  const base = "http://localhost:8443"
  const ctx = await mcpPage.context().browser().newContext({ viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const consoleErrors = []
  page.on("pageerror", (e) => consoleErrors.push(new URL(page.url()).pathname + ": " + e.message))
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(new URL(page.url()).pathname + ": " + m.text().slice(0, 200)) })

  // Seed through the real UI: one published event, one record left in review, one student session.
  const fillCreate = async (title, category) => {
    await page.goto(base + "/club/create")
    await page.getByLabel("Title").fill(title)
    await page.getByLabel("Category").fill(category)
    await page.getByLabel("Description").fill("Build and race a line-following robot with the club, then stay for a short demo round.")
    await page.getByLabel("Event date").fill("2026-10-23")
    await page.getByLabel("Start time").fill("17:30")
    await page.getByLabel("Venue").fill("Innovation Lab")
    await page.getByLabel("Audience").fill("All interested students")
    await page.getByLabel("Department").fill("Computer Science")
    await page.getByRole("button", { name: /Continue to review/ }).click()
    await page.waitForURL("**/club/review/**")
  }
  await fillCreate("Robotics Night", "Event")
  await page.getByRole("checkbox", { name: /I compared/ }).check()
  await page.getByRole("button", { name: /Confirm human review/ }).click()
  await page.getByRole("button", { name: /Approve & publish/ }).click()
  await page.waitForURL("**/club/published")
  await fillCreate("Lab access notice for first-year students", "Notice")
  const reviewPath = new URL(page.url()).pathname
  await page.goto(base + "/login/student")
  await page.getByLabel("College email").fill("demo.student@nith.ac.in")
  await page.getByRole("button", { name: /Continue/ }).click()
  await page.getByRole("button", { name: /Open Today/ }).waitFor()
  await page.getByRole("button", { name: "Technology" }).click()
  await page.getByRole("button", { name: /Open Today/ }).click()
  await page.waitForURL("**/app/today")
  await page.goto(base + "/app/item/campus-open-mic")
  await page.getByRole("button", { name: "Join event" }).click()
  await page.getByRole("button", { name: /^Save / }).first().click()

  const pages = [
    ["landing", "/"], ["events", "/events"], ["poster", "/poster-to-event"],
    ["access", "/get-started"], ["login-student", "/login/student"], ["login-interests", "/login/student/interests"], ["login-club", "/login/club"],
    ["explore", "/explore"], ["explore-item", "/explore/item/campus-open-mic"],
    ["today", "/app/today"], ["discover", "/app/discover"], ["saved", "/app/saved"], ["joined", "/app/joined"], ["profile", "/app/profile"], ["item", "/app/item/campus-open-mic"],
    ["club-overview", "/club/overview"], ["club-drafts", "/club/drafts"], ["club-create", "/club/create"], ["club-review", reviewPath], ["club-published", "/club/published"], ["club-profile", "/club/profile"],
  ]

  const audit = () => page.evaluate(() => {
    const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 1 && r.height > 1 && s.visibility === "visible" && s.display !== "none" && Number(s.opacity) > 0.05 }
    const hiddenTree = (el) => Boolean(el.closest("[aria-hidden='true'], .sr-only, script, style, [data-react-grab], react-grab")) || !el.closest("#root")
    const label = (el) => (el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).slice(0, 2).join(".") : el.tagName.toLowerCase())
    const own = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").trim()
    const all = [...document.querySelectorAll("#root *")].filter((el) => !hiddenTree(el) && visible(el))

    // 1. Inline siblings whose text touches with no whitespace between them.
    const runTogether = []
    for (const el of all) {
      const kids = [...el.childNodes]
      for (let i = 0; i < kids.length - 1; i++) {
        const a = kids[i], b = kids[i + 1]
        const text = (n) => (n.nodeType === 3 ? n.textContent : n.nodeType === 1 && visible(n) ? n.innerText : "")
        const ta = text(a), tb = text(b)
        if (!ta || !tb || !ta.trim() || !tb.trim()) continue
        if (/\s$/.test(ta) || /^\s/.test(tb)) continue
        if (!/[A-Za-z0-9.!?)]$/.test(ta.trim()) || !/^[A-Za-z0-9(]/.test(tb.trim())) continue
        const rect = (n) => { if (n.nodeType === 1) return n.getBoundingClientRect(); const r = document.createRange(); r.selectNodeContents(n); return r.getBoundingClientRect() }
        const ra = rect(a), rb = rect(b)
        const sameLine = Math.abs(ra.bottom - rb.bottom) < Math.max(ra.height, rb.height) * 0.6
        const gap = rb.left - ra.right
        if (sameLine && gap > -2 && gap < 3) runTogether.push(label(el) + ": \"" + ta.trim().slice(-22) + "|" + tb.trim().slice(0, 22) + "\"")
      }
    }

    // 2. Text clipped by its own box without an ellipsis or line clamp.
    const clipped = []
    for (const el of all) {
      if (!own(el)) continue
      const s = getComputedStyle(el)
      const clampsLines = s.webkitLineClamp && s.webkitLineClamp !== "none"
      if ((s.overflowX === "hidden" || s.overflowX === "clip") && el.scrollWidth > el.clientWidth + 2 && s.textOverflow !== "ellipsis") clipped.push(label(el) + " x: \"" + own(el).slice(0, 30) + "\"")
      if ((s.overflowY === "hidden" || s.overflowY === "clip") && el.scrollHeight > el.clientHeight + 3 && !clampsLines) clipped.push(label(el) + " y: \"" + own(el).slice(0, 30) + "\"")
      if (s.textOverflow === "ellipsis" && el.scrollWidth > el.clientWidth + 2) clipped.push(label(el) + " ellipsis: \"" + own(el).slice(0, 30) + "\"")
    }

    // 3. Text running outside the viewport, and separate text boxes drawn over each other.
    const leaves = all.filter((el) => own(el).length > 1 && getComputedStyle(el).position !== "fixed" && !el.closest(".student-tabbar, .student-sidebar, .club-sidebar"))
    const offscreen = leaves.filter((el) => { const r = el.getBoundingClientRect(); return r.right > innerWidth + 2 && r.left < innerWidth }).map((el) => label(el) + ": \"" + own(el).slice(0, 30) + "\"")
    const overlap = []
    const boxes = leaves.map((el) => ({ el, r: el.getBoundingClientRect() })).filter((b) => b.r.width < innerWidth * 0.98)
    for (let i = 0; i < boxes.length && overlap.length < 8; i++) for (let j = i + 1; j < boxes.length && overlap.length < 8; j++) {
      const a = boxes[i], b = boxes[j]
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue
      const w = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left), h = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top)
      if (w > 6 && h > 6 && w * h > 0.25 * Math.min(a.r.width * a.r.height, b.r.width * b.r.height)) overlap.push(label(a.el) + " \"" + own(a.el).slice(0, 18) + "\" over " + label(b.el) + " \"" + own(b.el).slice(0, 18) + "\"")
    }

    // 4. Headings whose lines collide: line-height tighter than the glyphs on a wrapped heading.
    const tightHeadings = [...document.querySelectorAll("#root h1, #root h2, #root h3")].filter((el) => !hiddenTree(el) && visible(el)).filter((el) => { const s = getComputedStyle(el); const lh = parseFloat(s.lineHeight), fs = parseFloat(s.fontSize); return lh && lh / fs < 0.95 && el.getBoundingClientRect().height > lh * 1.5 }).map((el) => label(el) + " " + el.tagName + " lh/fs " + (parseFloat(getComputedStyle(el).lineHeight) / parseFloat(getComputedStyle(el).fontSize)).toFixed(2) + ": \"" + el.innerText.replace(/\s+/g, " ").slice(0, 28) + "\"")

    const tiny = [...new Set(leaves.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 10.5).map((el) => label(el) + " " + parseFloat(getComputedStyle(el).fontSize).toFixed(1) + "px"))]
    const uniq = (list) => [...new Set(list)].slice(0, 10)
    return { hScroll: document.documentElement.scrollWidth > innerWidth + 1, runTogether: uniq(runTogether), clipped: uniq(clipped), offscreen: uniq(offscreen), overlap: uniq(overlap), tightHeadings: uniq(tightHeadings), tiny: tiny.slice(0, 10) }
  })

  const report = {}
  for (const w of [1440, 390]) {
    await page.setViewportSize({ width: w, height: 900 })
    for (const [name, path] of pages) {
      await page.goto(base + path)
      await page.waitForTimeout(900)
      const result = await audit()
      await page.screenshot({ path: `screenshots/text-${phase}-${name}-${w}.png`, fullPage: true })
      const compact = Object.fromEntries(Object.entries(result).filter(([, v]) => (Array.isArray(v) ? v.length : v)))
      if (Object.keys(compact).length) report[`${name}@${w}`] = compact
    }
  }
  await ctx.close()
  return { phase, report, consoleErrors: [...new Set(consoleErrors)].slice(0, 10) }
}
