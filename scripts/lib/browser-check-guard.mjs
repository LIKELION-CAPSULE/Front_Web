// Shared guards for the Playwright checks against the dev server (check-*.mjs).
//
// 1. Warm-up: the first visit after new imports (a branch merge, `npm ci`) makes Vite optimize dependencies again and
//    reload every open page. A reload in the middle of a check turns into a timeout or a stalled step that has
//    nothing to do with the app. Visiting the checked routes once beforehand lets that settle.
// 2. Watchdog: `page.evaluate` and pointer input have no timeout of their own, so a stalled renderer (software WebGL,
//    a frozen tab) would wait forever. The watchdog reports the step it stopped at and exits with 1 instead.

/** Loads `paths` once (twice when Vite reloads meanwhile) in a throwaway context and closes it. */
export async function warmUpDevServer(browser, origin, paths) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  let reloads = 0
  page.on('console', (message) => { if (/optimized dependencies changed|new dependencies optimized/i.test(message.text())) reloads++ })
  try {
    for (let round = 0; round < 2; round++) {
      const before = reloads
      for (const path of paths) {
        await page.goto(`${origin}${path}`, { waitUntil: 'networkidle', timeout: 60_000 }).catch(() => {})
        await page.waitForTimeout(1500)
      }
      if (round === 0 && reloads === before) break
    }
  } finally { await context.close() }
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
