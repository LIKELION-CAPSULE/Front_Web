// Shared guards for the Playwright checks against the dev server (check-*.mjs).
//
// 1. Warm-up: the first visit after new imports (a branch merge, `npm ci`) makes Vite optimize dependencies again and
//    reload every open page. A reload in the middle of a check turns into a timeout or a stalled step that has
//    nothing to do with the app. Visiting the checked routes once beforehand lets that settle.
// 2. Watchdog: `page.evaluate` and pointer input have no timeout of their own, so a stalled renderer (software WebGL,
//    a frozen tab) would wait forever. The watchdog reports the step it stopped at and exits with 1 instead.
/* global document -- page.evaluate bodies run in the browser */

/**
 * Loads `paths` once (again while Vite keeps reloading) in a throwaway context and closes it. Vite 8 logs 「optimized
 * dependencies changed. reloading」 on the server only; the page just reloads, so a reload is counted from the main
 * frame's navigations (more than one per visit). Also stops the run at once when the dev server is not in local mock
 * mode (`VITE_DATA_SOURCE=api`, e.g. from `.env.local`): the checks need the local data, and in api mode they would only
 * time out on a missing element.
 */
export async function warmUpDevServer(browser, origin, paths) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  let navigations = 0
  page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) navigations++ })
  let localDemo = false
  try {
    for (let round = 0; round < 3; round++) {
      let reloaded = false
      for (const path of paths) {
        navigations = 0
        await page.goto(`${origin}${path}`, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {})
        await page.waitForTimeout(1500)
        if (navigations > 1) reloaded = true
        localDemo ||= await page.evaluate(() => document.body.dataset.localDemo === 'true').catch(() => false)
      }
      if (!reloaded) break
    }
  } finally { await context.close() }
  if (!localDemo) {
    console.log(`FAIL warm-up: ${origin} is not in local mock mode (VITE_DATA_SOURCE=api? check .env.local) — these checks need the local data`)
    process.exit(1)
  }
}

/** Ends the run with a FAIL line naming the last step when it runs longer than `ms` (env `CHECK_TIMEOUT_MS`). */
export function startWatchdog(script, ms = Number(process.env.CHECK_TIMEOUT_MS) || 8 * 60_000) {
  let step = 'start'
  const timer = setTimeout(() => {
    console.log(`FAIL ${script}: stopped at 「${step}」 for over ${Math.round(ms / 1000)} s (renderer stalled or the dev server reloaded)`)
    process.exit(1)
  }, ms)
  timer.unref?.()
  return { step: (name) => { step = name }, stop: () => clearTimeout(timer) }
}
