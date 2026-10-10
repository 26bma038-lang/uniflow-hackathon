// Measures what is actually on screen in the frames after each navigation click.
async (mcpPage) => {
  const base = "http://localhost:8443"
  const tag = globalThis.__navTag || "after"
  const browser = mcpPage.context().browser()
  const results = {}

  // Per-frame sampler: records, for every animation frame, whether real page content is visible.
  const startSampler = (page) => page.evaluate(() => {
    const frames = []
    const t0 = performance.now()
    const sample = () => {
      const heading = document.querySelector("#root h1")
      let opacity = 1
      let hidden = false
      for (let el = heading; el && el !== document.body; el = el.parentElement) {
        const s = getComputedStyle(el)
        opacity *= Number(s.opacity)
        if (s.visibility === "hidden" || s.display === "none") hidden = true
      }
      const r = heading?.getBoundingClientRect()
      frames.push({
        t: Math.round(performance.now() - t0),
        path: location.pathname,
        h1: heading ? heading.innerText.replace(/\s+/g, " ").slice(0, 26) : null,
        opacity: heading ? Number(opacity.toFixed(2)) : 0,
        shown: Boolean(heading) && !hidden && opacity > 0.5 && r.width > 0 && r.bottom > 0 && r.top < innerHeight,
        textLen: document.querySelector("#root").innerText.length,
      })
      if (performance.now() - t0 < 4000) requestAnimationFrame(sample)
    }
    requestAnimationFrame(sample)
    window.__frames = frames
  })
  const readSampler = async (page, expectPath, expectH1) => {
    await page.waitForTimeout(4200)
    const frames = await page.evaluate(() => window.__frames)
    const blank = frames.filter((f) => !f.shown)
    const firstRight = frames.find((f) => f.shown && f.path.startsWith(expectPath) && (!expectH1 || (f.h1 || "").includes(expectH1)))
    const wrongPage = [...new Set(frames.filter((f) => f.shown && !(f.h1 || "").includes(expectH1 || "") ).map((f) => f.h1))]
    // longest continuous run of frames with no visible heading
    let longest = 0, runStart = null
    for (const f of frames) { if (!f.shown) { if (runStart === null) runStart = f.t; longest = Math.max(longest, f.t - runStart) } else runStart = null }
    return { frames: frames.length, blankFrames: blank.length, longestBlankMs: longest, minOpacity: Math.min(...frames.map((f) => f.opacity)), reachedTargetAtMs: firstRight ? firstRight.t : "NEVER", otherHeadingsSeen: wrongPage.slice(0, 3), final: frames[frames.length - 1] }
  }

  for (const [label, width, throttle] of [["1440", 1440, 1], ["390", 390, 1], ["1440-slow-cpu", 1440, 6]]) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 } })
    const page = await ctx.newPage()
    const errors = []
    page.on("pageerror", (e) => errors.push(new URL(page.url()).pathname + ": " + e.message))
    page.on("console", (m) => { if (m.type() === "error") errors.push(new URL(page.url()).pathname + ": " + m.text().slice(0, 200)) })
    const cdp = await ctx.newCDPSession(page)
    const r = {}
    const shots = async (name) => { for (const ms of [0, 120, 300, 700]) { if (ms) await page.waitForTimeout(ms - (ms === 120 ? 0 : ms === 300 ? 120 : 300)); await page.screenshot({ path: `screenshots/nav-${tag}-${label}-${name}-${ms}ms.png` }) } }

    // --- student onboarding -> /app/today, starting from the landing page like a person would
    await page.goto(base + "/")
    await page.waitForTimeout(1500)
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle })
    await page.getByRole("link", { name: "Get started" }).first().click()
    await page.getByRole("link", { name: /I’m a student/ }).click()
    await page.getByLabel("College email").pressSequentially("demo.student@nith.ac.in", { delay: 15 })
    await page.getByRole("button", { name: /Continue/ }).click()
    await page.getByRole("button", { name: "Technology" }).click()
    await page.waitForTimeout(800)
    await startSampler(page)
    await page.getByRole("button", { name: /Open Today/ }).hover()
    await page.getByRole("button", { name: /Open Today/ }).click()
    await shots("onboarding")
    r.onboardingToToday = await readSampler(page, "/app/today", "Good")

    // --- student in-app navigation
    const studentNav = width > 900 ? ".student-sidebar nav a" : ".student-tabbar a"
    await startSampler(page)
    await page.locator(studentNav, { hasText: "Discover" }).click()
    r.todayToDiscover = await readSampler(page, "/app/discover", "Discover")

    // --- direct refresh on Today
    await page.goto(base + "/app/today")
    await page.waitForTimeout(600)
    r.todayDirect = await page.evaluate(() => ({ h1: document.querySelector("#root h1")?.innerText, rows: document.querySelectorAll(".student-item-row").length }))
    await page.reload(); await page.waitForTimeout(600)
    r.todayRefresh = await page.evaluate(() => ({ h1: document.querySelector("#root h1")?.innerText, rows: document.querySelectorAll(".student-item-row").length }))

    // --- club Overview -> Drafts -> Published
    await page.goto(base + "/club/overview")
    await page.waitForTimeout(1000)
    if (width <= 900) await page.getByRole("button", { name: /navigation|menu/i }).first().click().catch(() => {})
    const clubLink = (name) => page.locator(".club-sidebar a, nav[aria-label='Club workspace'] a", { hasText: name }).first()
    await startSampler(page)
    await clubLink("Drafts").click()
    await shots("club-drafts")
    r.overviewToDrafts = await readSampler(page, "/club/drafts", "Keep the work")
    if (width <= 900) await page.getByRole("button", { name: /navigation|menu/i }).first().click().catch(() => {})
    await startSampler(page)
    await clubLink("Published").click()
    r.draftsToPublished = await readSampler(page, "/club/published", "What students")
    // quick double navigation: second click lands while the first transition is still running
    if (width > 900) {
      await page.goto(base + "/club/overview"); await page.waitForTimeout(800)
      await startSampler(page)
      await clubLink("Drafts").click(); await page.waitForTimeout(60); await clubLink("Published").click()
      r.rapidDraftsThenPublished = await readSampler(page, "/club/published", "What students")
    }
    // --- browser Back / Forward
    await startSampler(page)
    await page.goBack()
    r.back = await readSampler(page, "/club/", "")
    r.backLandedOn = await page.evaluate(() => location.pathname + " | " + document.querySelector("#root h1")?.innerText.replace(/\s+/g, " "))
    await startSampler(page)
    await page.goForward()
    r.forward = await readSampler(page, "/club/published", "What students")
    await page.reload(); await page.waitForTimeout(700)
    r.publishedRefresh = await page.evaluate(() => location.pathname + " | " + document.querySelector("#root h1")?.innerText.replace(/\s+/g, " "))
    r.errors = [...new Set(errors)].slice(0, 6)
    results[label] = r
    await ctx.close()
  }
  return { tag, results }
}
