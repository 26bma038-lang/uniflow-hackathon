async (mcpPage) => {
  const base = "http://localhost:8443"
  const browser = mcpPage.context().browser()
  const out = {}
  const configs = [["1440", 1440, "no-preference", 1], ["390", 390, "no-preference", 1], ["1440-reduced-motion", 1440, "reduce", 1], ["390-reduced-motion", 390, "reduce", 1], ["1440-slow-cpu", 1440, "no-preference", 6]]
  for (const [label, width, motion, throttle] of configs) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: motion })
    const page = await ctx.newPage()
    const errors = []
    page.on("pageerror", (e) => errors.push(new URL(page.url()).pathname + ": " + e.message))
    page.on("console", (m) => { if (m.type() === "error") errors.push(new URL(page.url()).pathname + ": " + m.text().slice(0, 160)) })
    const cdp = await ctx.newCDPSession(page)
    const r = {}
    const path = () => new URL(page.url()).pathname
    // lowest opacity seen on the page heading over the next ~1.5s, sampled every frame
    const sample = () => page.evaluate(() => new Promise((resolve) => {
      let min = 1, frames = 0, missing = 0
      const t0 = performance.now()
      const tick = () => {
        const h = document.querySelector("#root h1")
        if (!h) missing++
        else { let o = 1; for (let el = h; el && el !== document.body; el = el.parentElement) o *= Number(getComputedStyle(el).opacity); min = Math.min(min, o) }
        frames++
        if (performance.now() - t0 < 1500) requestAnimationFrame(tick); else resolve({ minOpacity: Number(min.toFixed(2)), framesWithoutHeading: missing, frames })
      }
      requestAnimationFrame(tick)
    }))
    const h1 = () => page.evaluate(() => { const h = document.querySelector("#root h1"); const b = h?.getBoundingClientRect(); return h && b.width > 0 ? h.innerText.replace(/\s+/g, " ") : null })
    const hScroll = () => page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1)

    // ---- landing
    await page.goto(base + "/", { waitUntil: "commit" })
    await page.locator("#root h1").waitFor()
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: throttle })
    r.landingLoad = { ...(await sample()), h1: await h1(), font: await page.evaluate(() => getComputedStyle(document.querySelector("h1")).fontFamily.split(",")[0]), hScroll: await hScroll() }
    r.heroLines = await page.evaluate(() => { const h = document.querySelector(".editorial-hero h1"); return Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight)) })
    // scattered -> clear section
    const board = page.locator(".editorial-fragment-board")
    await board.scrollIntoViewIfNeeded(); await page.evaluate(() => document.querySelector(".editorial-fragment-board").scrollIntoView({ block: "center" }))
    const mergedAtStart = await board.evaluate((el) => el.classList.contains("is-merged"))
    await page.waitForTimeout(throttle > 1 ? 4500 : 2600)
    r.fragments = { mergedAtStart, mergedAfterView: await board.evaluate((el) => el.classList.contains("is-merged")), cardsVisible: await page.locator(".editorial-fragment-card").evaluateAll((els) => els.every((el) => Number(getComputedStyle(el).opacity) > 0.5 && el.getBoundingClientRect().width > 0)), clearCardOpacity: await page.locator(".editorial-consolidated-card").evaluate((el) => Number(getComputedStyle(el).opacity).toFixed(2)) }
    await page.getByRole("button", { name: /Scatter the examples|Bring the examples together/ }).click(); await page.waitForTimeout(900)
    r.fragments.afterButton = await board.evaluate((el) => el.classList.contains("is-merged"))
    // hero call to action
    await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(400)
    await page.locator(".editorial-hero-actions a", { hasText: "Get started" }).click()
    r.heroGetStarted = { ...(await sample()), path: path(), h1: await h1(), cards: await page.locator(".access-card").count() }

    // ---- path 1: explore
    await page.locator(".access-card", { hasText: "Explore publicly" }).click()
    r.explore = { ...(await sample()), path: path(), h1: await h1(), updates: await page.locator(".access-info-list li").count(), clubs: await page.locator(".access-club-list li").count(), hScroll: await hScroll() }
    await page.locator(".access-info-list a").first().click(); await page.waitForTimeout(500)
    r.exploreItem = { path: path().replace(/item\/.*/, "item/:id"), h1: await h1() }

    // ---- path 2: student
    await page.goto(base + "/get-started"); await page.locator(".access-card").first().waitFor()
    await page.locator(".access-card", { hasText: "I’m a student" }).click()
    r.studentEmail = { ...(await sample()), path: path(), h1: await h1() }
    await page.getByLabel("College email").fill("not-an-email"); await page.getByRole("button", { name: /Continue/ }).click()
    r.studentError = await page.locator(".access-error").innerText()
    await page.getByLabel("College email").fill("demo.student@nith.ac.in"); await page.getByRole("button", { name: /Continue/ }).click()
    await page.getByRole("button", { name: /Open Today/ }).waitFor()
    r.studentInterests = { path: path(), h1: await h1(), hScroll: await hScroll() }
    await page.getByRole("button", { name: "Technology" }).click(); await page.getByRole("button", { name: /Open Today/ }).click()
    await page.waitForURL("**/app/today"); await page.locator(".student-item-row").first().waitFor()
    r.studentToday = { path: path(), h1: await h1(), rows: await page.locator(".student-item-row").count() }

    // ---- path 3: club
    await page.goto(base + "/get-started"); await page.locator(".access-card").first().waitFor()
    await page.locator(".access-card", { hasText: "club organizer" }).click()
    r.clubAccess = { ...(await sample()), path: path(), h1: await h1(), choices: await page.locator(".access-club-choice label").count(), hScroll: await hScroll() }
    await page.getByRole("button", { name: /Open .*workspace/ }).click(); await page.waitForURL("**/club/overview"); await page.locator("#root h1").waitFor()
    r.clubWorkspace = { path: path(), h1: await h1() }
    r.errors = [...new Set(errors)].slice(0, 6)
    out[label] = r
    await ctx.close()
  }
  return out
}
