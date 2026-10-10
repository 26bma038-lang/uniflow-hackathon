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
    const r = {}
    const path = () => new URL(page.url()).pathname
    const h1 = () => page.evaluate(() => document.querySelector("#root h1")?.innerText.replace(/\s+/g, " ") ?? null)
    const ls = (k) => page.evaluate((k) => JSON.parse(localStorage.getItem(k) ?? "null"), k)

    // Existing single-club data in the old storage shape (no clubId anywhere)
    await page.goto(base + "/get-started")
    await page.evaluate(() => {
      const now = new Date().toISOString()
      localStorage.setItem("uniflow-club-drafts", JSON.stringify([{ id: "legacy-draft-1", title: "Old CCC draft", description: "Saved before clubs could be switched.", category: "Notice", startDate: "2026-10-24", startTime: "10:00", endDate: "", endTime: "", timezone: "Asia/Kolkata", venue: "Lab 2", eligibility: "Members", registrationDeadline: "", registrationUrl: "", status: "needs_review", updatedAt: now, createdAt: now, source: "Manual entry", sourceName: "Manual entry", department: "Computer Science", publisher: "Campus Code Collective", publisherCampusId: "demo-campus", reviewedAt: null, approvedAt: null, publishedAt: null, reviewConfirmed: false }]))
      localStorage.setItem("uniflow-club-profile", JSON.stringify({ name: "Campus Code Collective", description: "Legacy profile text for CCC.", category: "Technology", contact: "", departments: "Computer Science", campusId: "demo-campus" }))
      localStorage.setItem("uniflow-club-activity", JSON.stringify([{ id: "legacy-act", label: "Draft saved", detail: "Old CCC draft", createdAt: now }]))
    })

    const draftsList = async () => { await page.goto(base + "/club/drafts"); await page.locator(".club-page-heading").waitFor(); await page.waitForTimeout(400); return page.locator(".club-draft-row").evaluateAll((rows) => rows.map((row) => row.innerText.replace(/\s+/g, " ").slice(0, 60))) }
    const publishedList = async () => { await page.goto(base + "/club/published"); await page.locator(".club-page-heading").waitFor(); await page.waitForTimeout(400); return page.locator(".club-published-row").evaluateAll((rows) => rows.map((row) => row.querySelector("h2").innerText + " | " + row.querySelector("p").innerText + " | " + (row.querySelector(".club-rsvp-count")?.innerText.replace(/\s+/g, " ").trim() ?? "no count"))) }
    const identity = () => page.evaluate(() => ({ sidebar: document.querySelector(".club-sidebar-bottom strong").innerText, topbar: document.querySelector(".club-topbar div span").innerText, note: [...document.querySelectorAll(".club-sidebar-bottom > span")].map((s) => s.innerText).join(" | ") }))
    const publish = async (title) => {
      await page.goto(base + "/club/create")
      await page.getByLabel("Title").fill(title); await page.getByLabel("Category").fill("Event"); await page.getByLabel("Description").fill("Details for " + title + ".")
      await page.getByLabel("Event date").fill("2026-10-23"); await page.getByLabel("Start time").fill("17:30"); await page.getByLabel("Venue").fill("Innovation Lab"); await page.getByLabel("Audience").fill("All interested students"); await page.getByLabel("Department").fill("Computer Science")
      await page.getByRole("button", { name: /Continue to review/ }).click(); await page.waitForURL("**/club/review/**")
      await page.getByRole("checkbox", { name: /I compared/ }).check(); await page.getByRole("button", { name: /Confirm human review/ }).click(); await page.getByRole("button", { name: /Approve & publish/ }).click(); await page.waitForURL("**/club/published")
      return page.evaluate((title) => JSON.parse(localStorage.getItem("uniflow-club-drafts")).find((x) => x.title === title).id, title)
    }
    const switchClub = async (name) => {
      if (width <= 900) await page.locator(".club-mobile-menu").click()
      await page.locator(".club-identity-switch select").selectOption({ label: name })
      await page.waitForURL("**/club/overview"); await page.waitForTimeout(500)
    }

    // ---- Club A: Campus Code Collective, chosen on the access page
    await page.goto(base + "/login/club")
    r.accessPage = { choices: await page.locator(".access-club-choice label").allInnerTexts(), notice: (await page.locator(".access-notice").innerText()).slice(0, 62) }
    await page.getByRole("radio", { name: "Campus Code Collective" }).check()
    await page.getByRole("button", { name: /Open Campus Code Collective/ }).click(); await page.waitForURL("**/club/overview"); await page.waitForTimeout(400)
    r.A_identity = await identity()
    r.A_legacyDraft = await draftsList()
    await page.goto(base + "/club/profile"); await page.waitForTimeout(400)
    r.A_legacyProfile = await page.getByLabel("Description").inputValue()
    const aEvent = await publish("Robotics Night")
    r.A_published = await publishedList()

    // a student joins A's event
    await page.goto(base + "/login/student"); await page.getByLabel("College email").fill("a.one@nith.ac.in"); await page.getByRole("button", { name: /Continue/ }).click()
    await page.getByRole("button", { name: /Open Today/ }).waitFor(); await page.getByRole("button", { name: "Technology" }).click(); await page.getByRole("button", { name: /Open Today/ }).click(); await page.waitForURL("**/app/today")
    await page.goto(base + "/app/item/" + aEvent); await page.getByRole("button", { name: "Join event" }).click()
    r.studentJoined = await page.locator(".student-join-state").innerText()

    // ---- switch to club B inside the workspace
    await page.goto(base + "/club/overview"); await page.locator(".club-page-heading").waitFor(); await page.waitForTimeout(300)
    await switchClub("Student Arts Circle")
    r.B_identity = await identity()
    r.B_overviewRsvpStrip = await page.locator(".club-rsvp-strip").count()
    r.B_drafts = await draftsList()
    r.B_published = await publishedList()
    await page.goto(base + "/club/profile"); await page.waitForTimeout(400)
    r.B_profileDescription = await page.getByLabel("Description").inputValue()
    await page.getByLabel("Description").fill("Open stages for music, poetry, and short performances."); await page.getByRole("button", { name: /Save profile/ }).click(); await page.waitForTimeout(300)
    // direct URLs to A's records while acting as B
    await page.goto(base + "/club/review/legacy-draft-1"); await page.waitForTimeout(500)
    r.B_opensAReview = { text: await page.locator(".club-empty-state h2").innerText().catch(() => "NO NOTICE"), fields: await page.locator(".club-review-fields input").count() }
    await page.goto(base + "/club/create/legacy-draft-1"); await page.waitForTimeout(500)
    r.B_opensADraftForm = { titleField: await page.getByLabel("Title").inputValue() }
    await page.goto(base + "/club/review/" + aEvent); await page.waitForTimeout(500)
    r.B_opensAPublished = await page.locator(".club-empty-state h2").innerText().catch(() => "NO NOTICE")
    const bEvent = await publish("Poetry Slam")
    r.B_publishedAfter = await publishedList()
    await page.reload(); await page.waitForTimeout(600)
    r.B_afterRefresh = { identity: (await identity()).sidebar, published: await page.locator(".club-published-row h2").allInnerTexts() }

    // ---- public and student views show both clubs together
    await page.goto(base + "/explore"); await page.locator(".access-info-list a").first().waitFor()
    r.exploreUpdates = (await page.locator(".access-info-list li").evaluateAll((items) => items.map((li) => li.querySelector("strong").innerText + " | " + li.querySelector("small").innerText))).filter((t) => /Robotics Night|Poetry Slam/.test(t))
    for (const [key, title, clubName] of [["A", "Robotics Night", "Campus Code Collective"], ["B", "Poetry Slam", "Student Arts Circle"]]) {
      await page.goto(base + "/explore"); await page.locator(".access-info-list a", { hasText: title }).click(); await page.waitForURL("**/explore/item/**"); await page.waitForTimeout(400)
      const publisherLink = page.locator(".access-detail-source dd a", { hasText: clubName })
      const publisher = await publisherLink.innerText()
      await publisherLink.click(); await page.waitForURL("**/explore/club/**"); await page.waitForTimeout(500)
      r["public" + key] = { publisher, profilePath: path(), profileH1: await h1(), description: await page.locator(".entry-heading > p:last-child").innerText(), updates: await page.locator(".access-info-list strong").allInnerTexts(), hScroll: await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1) }
    }
    await page.goto(base + "/app/discover"); await page.locator(".student-item-row").first().waitFor(); await page.waitForTimeout(400)
    r.studentDiscover = (await page.locator(".student-discover-list .student-item-row").evaluateAll((rows) => rows.map((row) => row.querySelector("h3").innerText + " | " + row.querySelector(".student-item-kicker span:last-child").innerText))).filter((t) => /Robotics Night|Poetry Slam/.test(t))
    await page.goto(base + "/app/item/" + bEvent); await page.locator(".student-detail-main h1").waitFor()
    r.studentDetailB = { publisher: await page.locator(".student-provenance-block strong").first().innerText(), profileLink: await page.locator(".student-publisher-link").getAttribute("href"), joinAvailable: await page.locator(".student-join button").innerText() }

    // ---- back to club A: data and RSVP count intact
    await page.goto(base + "/club/overview"); await page.locator(".club-page-heading").waitFor(); await page.waitForTimeout(300)
    await switchClub("Campus Code Collective")
    r.A_again = { identity: (await identity()).sidebar, overviewRsvp: await page.locator(".club-rsvp-strip .club-activity-list > div").allInnerTexts().then((t) => t.map((x) => x.replace(/\s+/g, " "))), drafts: await draftsList(), published: await publishedList() }
    await page.reload(); await page.waitForTimeout(600)
    r.A_afterRefresh = { identity: (await identity()).sidebar, published: await publishedList() }
    await page.goto(base + "/club/profile"); await page.waitForTimeout(400)
    r.A_profileStill = await page.getByLabel("Description").inputValue()
    if (width <= 900) { await page.locator(".club-mobile-menu").click(); await page.waitForTimeout(400); await page.screenshot({ path: "screenshots/multi-club-switcher-390.png" }) } else { await page.screenshot({ path: "screenshots/multi-club-switcher-1440.png" }) }

    // ---- storage after the change
    r.storage = {
      records: (await ls("uniflow-club-drafts")).map((x) => x.clubId + " | " + x.publisher + " | " + x.title + " | " + x.status),
      legacyProfileKeyKept: Boolean(await ls("uniflow-club-profile")),
      profiles: Object.fromEntries(Object.entries(await ls("uniflow-club-profiles")).map(([k, v]) => [k, v.description])),
      current: await page.evaluate(() => localStorage.getItem("uniflow-club-current")),
      activityOwners: (await ls("uniflow-club-activity")).map((x) => (x.clubId ?? "none") + ":" + x.label),
      joined: (await ls("uniflow-student-joined-events")).length,
    }
    r.errors = [...new Set(errors)]
    out[width] = r
    await ctx.close()
  }
  return out
}
