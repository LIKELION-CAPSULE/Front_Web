// The call screen's server-facing flow, mounted for real against the local mock (same paths and bodies as the server):
// - under-19 limit: a warning at 10 minutes left; at zero the connection ends once with `endType: MINOR_LIMIT` and the
//   connection record opens;
// - 10 minutes without input (camera off) ends with `endType: AUTO_AWAY`;
// - a start handed over (409) to a connection with another mate goes to that mate's call and says so;
// - the conversation mode toggle is what the message sends (`mode: ADVANCED` → a 30-credit 「고급 대화」 use).
//
// Needs the dev server in local mock mode and Playwright (not a project dependency):
//
//   npx vite --port 5231 --strictPort &
//   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs \
//   PLAYWRIGHT_CHROMIUM=<installed Chromium, optional> \
//     node scripts/check-connection-flow.mjs http://127.0.0.1:5231
//
// Prints one line per check and exits with 1 when any fails.
import { startWatchdog, warmUpDevServer } from './lib/browser-check-guard.mjs'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const [origin = 'http://127.0.0.1:5231'] = process.argv.slice(2)
const watchdog = startWatchdog('check-connection-flow')
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--headless=new'] })
const failures = []
const check = (name, ok, detail = '') => {
  watchdog.step(name)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}
const SCOPE = 'capsule-local-beta:cache:'

/** A fresh mock account on the home screen; `minorSeconds` makes it under 19 with that much time left today. */
async function open({ minorSeconds, clock = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  if (minorSeconds !== undefined) await context.addInitScript(([key, value]) => { try { sessionStorage.setItem(key, value) } catch { /* */ } }, [`${SCOPE}capsule-local-minor-seconds`, String(minorSeconds)])
  const page = await context.newPage()
  if (clock) await page.clock.install()
  await page.goto(`${origin}/`, { waitUntil: 'networkidle' })
  await page.evaluate(() => { localStorage.clear() })
  await page.goto(`${origin}/`, { waitUntil: 'networkidle' })
  if (clock) await page.clock.runFor(2500)
  else await page.waitForTimeout(2500)
  return { context, page }
}
const report = (page, id) => page.evaluate(async (connection) => (await (await fetch(`/api/backend/connections/${connection}`)).json()).data, id)
const connectChaerin = (page) => page.locator('.home-mate-card--active').first().locator('.home-mate-card-enter').click()
/** Waits (real or fake time) until the connection record opens; returns its id. */
async function recordOpened(page, clock, ms = 20_000) {
  for (let waited = 0; waited < ms; waited += 250) {
    const match = page.url().match(/\/connections\/(\d+)/)
    if (match) return match[1]
    if (clock) await page.clock.runFor(250)
    else await page.waitForTimeout(250)
  }
  return null
}

async function minorLimit() {
  // 10 minutes left: the warning.
  {
    const { context, page } = await open({ minorSeconds: 590 })
    await connectChaerin(page)
    await page.waitForURL(/\/connect\/chaerin/)
    await page.waitForTimeout(1500)
    const notice = await page.locator('.connection-notice').textContent().catch(() => '')
    check('minor: the 10-minute warning shows on the call screen', /10분 남았어요/.test(notice ?? ''), notice ?? '')
    await context.close()
  }
  // No time left: ends once with MINOR_LIMIT, then the record.
  const { context, page } = await open({ minorSeconds: 0 })
  await connectChaerin(page)
  let notice = ''
  for (let i = 0; i < 40 && !notice; i++) {
    notice = (await page.locator('.connection-notice:not([hidden])').textContent().catch(() => '')) ?? ''
    await page.waitForTimeout(100)
  }
  check('minor: the limit notice shows', /하루 3시간/.test(notice), notice)
  const id = await recordOpened(page, false)
  check('minor: the connection record opens', id !== null, page.url())
  if (id) {
    const data = await report(page, id)
    check('minor: ended with endType MINOR_LIMIT', data?.endType === 'MINOR_LIMIT', data?.endType)
  }
  await context.close()
}

async function autoAway() {
  const { context, page } = await open({ clock: true })
  await connectChaerin(page)
  for (let i = 0; i < 40 && !/\/connect\/chaerin/.test(page.url()); i++) await page.clock.runFor(250)
  await page.clock.runFor(3000)
  check('idle: the call screen is open (camera off)', /\/connect\/chaerin/.test(page.url()), page.url())
  // Ten minutes without input: the call ends by itself. The hang-up then plays in real time.
  await page.clock.runFor(10 * 60_000 + 2000)
  await page.clock.resume()
  const id = await recordOpened(page, false)
  check('idle: the connection record opens after 10 minutes without input', id !== null, page.url())
  if (id) {
    const data = await report(page, id)
    check('idle: ended with endType AUTO_AWAY', data?.endType === 'AUTO_AWAY', data?.endType)
  }
  await context.close()
}

async function otherMate() {
  const { context, page } = await open()
  // Another tab connected 서도현 after this page read the home screen.
  const started = await page.evaluate(async () => (await (await fetch('/api/backend/connections', { method: 'POST', body: JSON.stringify({ mateId: 990302 }) })).json()).data?.connectionId)
  check('409: another connection is running', typeof started === 'number', String(started))
  await connectChaerin(page)
  await page.waitForURL(/\/connect\//, { timeout: 15_000 }).catch(() => {})
  await page.waitForTimeout(800)
  check('409: goes to the mate actually connected (서도현)', /\/connect\/dohyun/.test(page.url()), page.url())
  const notice = await page.locator('.connection-notice').textContent().catch(() => '')
  check('409: says why', /서도현과 연결 중이었어요/.test(notice ?? ''), notice ?? '')
  const title = await page.locator('.connection-titlebar-left h1').first().textContent().catch(() => '')
  check('409: the call is 서도현’s, not relabelled', /서도현/.test(title ?? ''), title ?? '')
  await context.close()
}

async function advancedMode() {
  const { context, page } = await open()
  await connectChaerin(page)
  await page.waitForURL(/\/connect\/chaerin/)
  await page.waitForTimeout(1500)
  await page.getByRole('button', { name: /고급 · 1턴/ }).click()
  const pressed = await page.getByRole('button', { name: /고급 · 1턴/ }).getAttribute('aria-pressed')
  check('mode: the toggle switches to 고급', pressed === 'true', String(pressed))
  const before = await page.evaluate(async () => (await (await fetch('/api/backend/credits/transactions?filter=USE')).json()).data.items.length)
  const box = page.getByPlaceholder(/에게 한마디/)
  await box.fill('고급 모드로 물어볼게')
  await box.press('Enter')
  await page.waitForTimeout(2500)
  const items = await page.evaluate(async () => (await (await fetch('/api/backend/credits/transactions?filter=USE')).json()).data.items)
  check('mode: the message went as ADVANCED (a 30-credit 고급 use)', items.length === before + 1 && items[0]?.change === -30, JSON.stringify(items[0]))
  await context.close()
}

watchdog.step('warm-up')
await warmUpDevServer(browser, origin, ['/', '/connect/chaerin'])
for (const [name, run] of [['minor limit', minorLimit], ['auto away', autoAway], ['other mate (409)', otherMate], ['advanced mode', advancedMode]]) {
  watchdog.step(name)
  console.log(`— ${name}`)
  try { await run() } catch (error) { check(`${name}: ran to the end`, false, error.message.split('\n')[0]) }
}
await browser.close()
watchdog.stop()
console.log(failures.length ? `\n${failures.length} failed` : '\nall checks passed')
process.exit(failures.length ? 1 : 0)
