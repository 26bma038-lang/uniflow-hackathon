async (mcpPage) => {
  const base = "http://localhost:8443"
  const browser = mcpPage.context().browser()
  const out = {}
  for (const width of [1440, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 } })
    const page = await ctx.newPage()
    const errors = []
    page.on("pageerror", (e) => errors.push(new URL(page.url()).pathname + ": " + e.message))
    page.on("console", (m) => { if (m.type() === "error") errors.push(new URL(page.url()).pathname + ": " + m.text().slice(0, 200)) })
    const path = () => new URL(page.url()).pathname
    const visibleH1 = () => page.evaluate(() => { const h = document.querySelector("#root h1"); if (!h) return null; const r = h.getBoundingClientRect(); return r.width > 0 && r.height > 0 ? h.innerText.replace(/\s+/g, " ") : "HIDDEN" })
    const ls = (k) => page.evaluate((k) => localStorage.getItem(k), k)
    const notice = () => page.locator(".access-return-notice").count()
    const fillEmail = async (email) => { await page.getByLabel("College email").fill(email); await page.getByRole("button", { name: /Continue/ }).click(); await page.getByRole("button", { name: /Open Today/ }).waitFor() }
    const finishInterests = async () => {
      if (await page.locator('.student-interest-list button[aria-pressed="true"]').count() === 0) await page.getByRole("button", { name: "Technology" }).click()
      await page.getByRole("button", { name: /Open Today/ }).click()
      await page.waitForURL("**/app/**"); await page.locator("#root h1").waitFor(); await page.waitForTimeout(500)
    }
    const reset = async () => { await page.goto(base + "/get-started"); await page.evaluate(() => ["uniflow-demo-session", "uniflow-student-access", "uniflow-student-joined-events", "uniflow-student-saved-items", "uniflow-pending-destination"].forEach((k) => localStorage.removeItem(k))) }

    // ================= Feature 1 =================
    const f1 = {}
    // (a) Join without a session
    await reset()
    await page.goto(base + "/app/item/campus-open-mic"); await page.locator(".student-join").waitFor()
    await page.getByRole("button", { name: /Enter student demo to join/ }).click()
    await page.waitForURL("**/login/student")
    f1.join = { entryPath: path(), pending: await ls("uniflow-pending-destination"), noticeOnEmailStep: await notice() }
    await fillEmail("a.one@nith.ac.in")
    await page.reload(); await page.getByRole("button", { name: /Open Today/ }).waitFor()
    f1.join.afterRefresh = { path: path(), pending: await ls("uniflow-pending-destination"), notice: await notice() }
    await finishInterests()
    f1.join.landed = { path: path(), h1: await visibleH1(), joinBox: await page.locator(".student-join button").allInnerTexts(), joinedStore: await ls("uniflow-student-joined-events"), pendingAfter: await ls("uniflow-pending-destination") }
    // Back / Forward from the returned item
    await page.goBack(); await page.waitForTimeout(700)
    f1.join.back = { path: path(), h1: await visibleH1() }
    await page.goForward(); await page.waitForTimeout(700)
    f1.join.forward = { path: path(), h1: await visibleH1() }

    // (b) Save without a session, from a Discover row
    await reset()
    await page.goto(base + "/app/discover"); await page.locator(".student-item-row").first().waitFor()
    await page.getByRole("button", { name: "Save Design thinking assignment" }).click()
    await page.waitForURL("**/login/student")
    f1.save = { pending: await ls("uniflow-pending-destination"), notice: await notice() }
    await fillEmail("b.two@nith.ac.in"); await finishInterests()
    f1.save.landed = { path: path(), h1: await visibleH1(), saveButton: await page.locator(".student-detail-actions .student-save-button").innerText(), savedStore: await ls("uniflow-student-saved-items"), pendingAfter: await ls("uniflow-pending-destination") }

    // (c) Normal entry ends on Today
    await reset()
    await page.getByRole("link", { name: /I’m a student/ }).click(); await page.waitForURL("**/login/student")
    f1.normal = { notice: await notice() }
    await fillEmail("c.three@nith.ac.in"); await finishInterests()
    f1.normal.landed = { path: path(), h1: await visibleH1() }

    // (d) Switching to the public or club path drops the pending return
    for (const [key, linkName] of [["viaExplore", /Explore without an account/], ["viaClub", /club organizer instead/]]) {
      await reset()
      await page.goto(base + "/app/item/campus-open-mic"); await page.locator(".student-join").waitFor()
      await page.getByRole("button", { name: /Enter student demo to join/ }).click(); await page.waitForURL("**/login/student")
      await page.getByRole("link", { name: linkName }).click(); await page.waitForTimeout(600)
      const pendingAfterSwitch = await ls("uniflow-pending-destination")
      await page.evaluate(() => localStorage.removeItem("uniflow-demo-session"))
      await page.goto(base + "/login/student"); await fillEmail("d.four@nith.ac.in"); await finishInterests()
      f1[key] = { switchedTo: key, pendingAfterSwitch, landed: path() }
    }
    // (e) Back out of entry: the item page is still there
    await reset()
    await page.goto(base + "/app/item/campus-open-mic"); await page.locator(".student-join").waitFor()
    await page.getByRole("button", { name: /Enter student demo to join/ }).click(); await page.waitForURL("**/login/student")
    await page.goBack(); await page.waitForTimeout(800)
    f1.backFromEntry = { path: path(), h1: await visibleH1() }
    // (f) Only item routes are accepted
    f1.invalid = {}
    for (const bad of ["https://example.com/app/item/x", "/club/overview", "/app/item/../../club/overview", "//example.com"]) {
      await reset()
      await page.evaluate((bad) => localStorage.setItem("uniflow-pending-destination", bad), bad)
      await page.goto(base + "/login/student"); const shown = await notice()
      await fillEmail("e.five@nith.ac.in"); await finishInterests()
      f1.invalid[bad] = { notice: shown, landed: path(), leftover: await ls("uniflow-pending-destination") }
    }
    f1.errors = [...new Set(errors)]; errors.length = 0

    // ================= Feature 2 =================
    const f2 = {}
    await page.goto(base + "/club/create")
    await page.getByLabel("Title").fill("Robotics Night"); await page.getByLabel("Category").fill("Event"); await page.getByLabel("Description").fill("Build and race a line-following robot with the club.")
    await page.getByLabel("Event date").fill("2026-10-23"); await page.getByLabel("Start time").fill("17:30"); await page.getByLabel("Venue").fill("Innovation Lab"); await page.getByLabel("Audience").fill("All interested students"); await page.getByLabel("Department").fill("Computer Science")
    await page.getByRole("button", { name: /Continue to review/ }).click(); await page.waitForURL("**/club/review/**")
    await page.getByRole("checkbox", { name: /I compared/ }).check(); await page.getByRole("button", { name: /Confirm human review/ }).click(); await page.getByRole("button", { name: /Approve & publish/ }).click(); await page.waitForURL("**/club/published")
    const readProfile = () => page.evaluate(() => ({
      path: location.pathname,
      h1: document.querySelector("#root h1")?.innerText.replace(/\s+/g, " "),
      description: document.querySelector(".entry-heading > p:last-child")?.innerText,
      status: document.querySelector(".access-club-status")?.innerText,
      count: document.querySelector(".access-section-heading .access-sample-tag")?.innerText,
      updates: [...document.querySelectorAll(".access-info-list li")].map((li) => li.querySelector("strong").innerText + " | " + li.querySelector("small").innerText),
      links: [...document.querySelectorAll(".access-info-list a")].map((a) => a.getAttribute("href")).every((h) => h.startsWith("/explore/item/")),
      back: Boolean(document.querySelector(".access-detail-back a")),
      hScroll: document.documentElement.scrollWidth > innerWidth + 1,
    }))
    await page.goto(base + "/explore"); await page.locator(".access-club-list a").first().waitFor()
    f2.directory = await page.locator(".access-club-list a").evaluateAll((links) => links.map((a) => a.querySelector("strong").innerText + " | " + a.querySelector("small").innerText + " | " + a.getAttribute("href")))
    // sample club
    await page.locator(".access-club-list a", { hasText: "Student Arts Circle" }).click(); await page.waitForURL("**/explore/club/**"); await page.waitForTimeout(500)
    f2.sample = await readProfile()
    await page.screenshot({ path: `screenshots/club-profile-sample-${width}.png`, fullPage: true })
    await page.reload(); await page.waitForTimeout(600)
    f2.sampleSameAfterRefresh = JSON.stringify(await readProfile()) === JSON.stringify(f2.sample)
    await page.locator(".access-info-list a").first().click(); await page.waitForURL("**/explore/item/**"); await page.waitForTimeout(400)
    f2.sampleUpdateOpens = { path: path(), h1: await visibleH1(), label: await page.locator(".access-detail-main .access-sample-tag").innerText() }
    await page.goBack(); await page.waitForTimeout(500)
    await page.locator(".access-detail-back a").click(); await page.waitForURL("**/explore")
    f2.backToExplore = path()
    // publishing demo club
    await page.locator(".access-club-list a", { hasText: "Campus Code Collective" }).click(); await page.waitForURL("**/explore/club/**"); await page.waitForTimeout(500)
    f2.demo = await readProfile()
    await page.screenshot({ path: `screenshots/club-profile-demo-${width}.png`, fullPage: true })
    await page.reload(); await page.waitForTimeout(600)
    f2.demoSameAfterRefresh = JSON.stringify(await readProfile()) === JSON.stringify(f2.demo)
    await page.locator(".access-info-list a", { hasText: "Robotics Night" }).click(); await page.waitForURL("**/explore/item/**"); await page.waitForTimeout(400)
    f2.newUpdateOpens = { h1: await visibleH1(), label: await page.locator(".access-detail-main .access-sample-tag").innerText(), studentActions: await page.locator("button", { hasText: /^(Save|Join)/ }).count() }
    // the profile text comes from the club workspace profile
    await page.goto(base + "/club/profile"); await page.getByLabel("Description").fill("We build small, useful things together on Friday evenings.")
    await page.getByRole("button", { name: /Save profile/ }).click(); await page.waitForTimeout(300)
    await page.goto(base + "/explore/club/campus-code-collective"); await page.waitForTimeout(600)
    f2.demoDescriptionAfterEdit = (await readProfile()).description
    await page.goto(base + "/explore/club/not-a-club"); await page.waitForTimeout(600)
    f2.unknown = await visibleH1()
    f2.errors = [...new Set(errors)]
    out[width] = { feature1: f1, feature2: f2 }
    await ctx.close()
  }
  return out
}
