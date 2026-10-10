// Stable screenshots of the landing and access pages. Tag comes from globalThis.__polishTag.
async (mcpPage) => {
  const base = "http://localhost:8443"
  const tag = globalThis.__polishTag || "after"
  const browser = mcpPage.context().browser()
  const report = {}
  for (const width of [1440, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: 900 } })
    const page = await ctx.newPage()
    const errors = []
    page.on("pageerror", (e) => errors.push(new URL(page.url()).pathname + ": " + e.message))
    page.on("console", (m) => { if (m.type() === "error") errors.push(new URL(page.url()).pathname + ": " + m.text().slice(0, 160)) })
    await page.goto(base + "/get-started")
    await page.evaluate(() => localStorage.setItem("uniflow-student-access", JSON.stringify({ email: "demo.student@nith.ac.in", interests: ["Technology"] })))
    const pages = [["landing", "/"], ["access", "/get-started"], ["student-email", "/login/student"], ["student-interests", "/login/student/interests"], ["club", "/login/club"], ["explore", "/explore"], ["explore-item", "/explore/item/campus-open-mic"], ["explore-club", "/explore/club/student-arts-circle"]]
    for (const [name, path] of pages) {
      await page.goto(base + path)
      await page.waitForTimeout(900)
      // walk the page so scroll-triggered sections have rendered, then return to the top
      const total = await page.evaluate(() => document.documentElement.scrollHeight)
      for (let y = 0; y < total; y += 600) { await page.evaluate((y) => window.scrollTo(0, y), y); await page.waitForTimeout(name === "landing" ? 260 : 60) }
      await page.evaluate(() => window.scrollTo(0, 0)); await page.waitForTimeout(700)
      await page.screenshot({ path: `screenshots/polish-${tag}-${name}-${width}.png`, fullPage: true })
      if (name === "landing" || name === "access") await page.screenshot({ path: `screenshots/polish-${tag}-${name}-${width}-top.png` })
      const info = await page.evaluate(() => ({ hScroll: document.documentElement.scrollWidth > innerWidth + 1, h1Font: getComputedStyle(document.querySelector("h1")).fontFamily.split(",")[0], height: document.documentElement.scrollHeight }))
      if (info.hScroll) report[`${name}@${width}`] = info
      report[`font@${name}`] = info.h1Font
    }
    report[`errors@${width}`] = [...new Set(errors)].slice(0, 6)
    await ctx.close()
  }
  return { tag, report }
}
