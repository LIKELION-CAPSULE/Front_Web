// Safety check for the service tour (홈 「사용법 보기」, src/features/tour): while it runs nothing real may happen.
// Walks the whole tour in a real browser and spies, for the whole run, on
//   - trusted-less (synthetic) click / pointerdown / pointerup / mousedown / mouseup / submit events,
//   - the app's API calls (the in-page transport is wrapped): any write, and any session / connection / event /
//     reaction / message / credit call — connectMate starts a session through these, and its screen is /connect/…,
//   - navigator.mediaDevices.getUserMedia, documentPictureInPicture.requestWindow, video requestPictureInPicture.
// Scenarios: the full tour, a slow tour chunk (the app must be locked while it loads, and skippable), a wrong `?tour`
// value, an empty mate list, a guest, the account modal (profile → settings → outro, backdrop click), and skip / Esc /
// leaving by the address bar (inert, overflow and focus come back). It also checks that 채린's line never covers a
// control next to the target.
//
// Needs the dev server in local mock mode and Playwright (not a project dependency):
//
//   npx vite --port 5231 --strictPort &
//   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs \
//   PLAYWRIGHT_CHROMIUM=<installed Chromium, optional> \
//     node scripts/check-service-tour.mjs http://127.0.0.1:5231 [scenario …]
//
// Scenarios: full slow wrong-step empty guest account leave (default: all). Prints one line per check and exits
// with 1 when any fails.
/* global window, document, history, innerWidth, innerHeight, PopStateEvent, HTMLVideoElement -- page.evaluate / init script bodies run in the browser */

import { startWatchdog, warmUpDevServer } from './lib/browser-check-guard.mjs'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const [origin = 'http://127.0.0.1:5231', ...picked] = process.argv.slice(2)
const watchdog = startWatchdog('check-service-tour', Number(process.env.CHECK_TIMEOUT_MS) || 15 * 60_000)
const scenarios = picked.length ? picked : ['slow', 'wrong-step', 'empty', 'guest', 'account', 'leave', 'full']
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--headless=new'] })
const failures = []
const check = (name, ok, detail = '') => {
  watchdog.step(name)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}
const panel = '.service-tour-panel'

/** Spies installed before the app runs. `emptyMates`: the home response lists no mates. */
function spies({ emptyMates = false } = {}) {
  return [({ emptyMates }) => {
    const spy = { events: [], api: [], media: 0, pip: 0, videoPip: 0 }
    window.__tourSpy = spy
    for (const type of ['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'submit'])
      document.addEventListener(type, (event) => { if (!event.isTrusted) spy.events.push(`${type}:${String(event.target?.className ?? '').slice(0, 40)}`) }, true)
    const wrap = (fetcher) => async function (input, init) {
      const url = typeof input === 'string' ? input : input?.url ?? String(input)
      const method = String(init?.method ?? input?.method ?? 'GET').toUpperCase()
      spy.api.push(`${method} ${url}`)
      const response = await fetcher.call(this, input, init)
      if (emptyMates && /\/api\/backend\/home(\?|$)/.test(url) && response.ok) {
        const body = await response.clone().json()
        // The API envelope is { success, data }; since 11-25 the mate list is `mates`.
        const data = body && typeof body === 'object' && 'data' in body ? { ...body, data: { ...body.data, mates: [] } } : { ...body, mates: [] }
        return new Response(JSON.stringify(data), { status: 200, headers: { 'content-type': 'application/json' } })
      }
      return response
    }
    let current = wrap(window.fetch)
    Object.defineProperty(window, 'fetch', { configurable: true, get: () => current, set: (value) => { current = wrap(value) } })
    if (navigator.mediaDevices?.getUserMedia) {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
      navigator.mediaDevices.getUserMedia = (...args) => { spy.media++; return original(...args) }
    }
    if (window.documentPictureInPicture) {
      const original = window.documentPictureInPicture.requestWindow.bind(window.documentPictureInPicture)
      window.documentPictureInPicture.requestWindow = (...args) => { spy.pip++; return original(...args) }
    }
    const videoPip = HTMLVideoElement.prototype.requestPictureInPicture
    HTMLVideoElement.prototype.requestPictureInPicture = function (...args) { spy.videoPip++; return videoPip.apply(this, args) }
  }, { emptyMates }]
}

async function open({ reducedMotion = false, emptyMates = false, slowTour = 0, viewport = { width: 1440, height: 900 } } = {}) {
  const context = await browser.newContext({ viewport, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' })
  await context.addInitScript(...spies({ emptyMates }))
  if (slowTour) {
    // A slow network for the tour controller's chunk only (dev: the module itself; production: its hashed chunk).
    await context.route(/\/(src\/features\/tour\/ServiceTour\.tsx|assets\/ServiceTour-[^/]+\.js)(\?|$)/, async (route) => {
      await new Promise((resolve) => setTimeout(resolve, slowTour))
      await route.continue()
    })
  }
  const page = await context.newPage()
  page.on('pageerror', (error) => console.log('  pageerror:', error.message))
  await page.goto(`${origin}/`, { waitUntil: 'networkidle' })
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
  await page.goto(`${origin}/`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1200)
  return { context, page }
}

const spyOf = (page) => page.evaluate(() => window.__tourSpy)
/** Since the mark: what the tour may never do. */
async function nothingReal(page, label, since = { api: 0, events: 0 }) {
  const spy = await spyOf(page)
  const api = spy.api.slice(since.api)
  const forbidden = api.filter((line) => !/^(GET|HEAD) /.test(line) || /\/api\/[^ ]*\/(sessions?|connections?|events?|reactions?|messages?|credits?|study)\b/i.test(line))
  check(`${label}: no write and no session / connection / event / reaction / message / credit call`, forbidden.length === 0, forbidden.join(' | '))
  check(`${label}: no getUserMedia / PIP window / video PIP`, spy.media === 0 && spy.pip === 0 && spy.videoPip === 0, `media=${spy.media} pip=${spy.pip} videoPip=${spy.videoPip}`)
  const events = spy.events.slice(since.events)
  check(`${label}: no synthetic click / pointer / mouse / submit event`, events.length === 0, events.join(', '))
}
const mark = async (page) => { const spy = await spyOf(page); return { api: spy.api.length, events: spy.events.length } }
const lockState = (page) => page.evaluate(() => ({
  rootInert: document.getElementById('root')?.hasAttribute('inert') ?? false,
  anyInert: document.querySelectorAll('[inert]').length,
  overflow: document.documentElement.style.overflow,
  layer: document.querySelectorAll('.service-tour-layer').length,
}))
async function released(page, label) {
  const state = await lockState(page)
  check(`${label}: app released (no inert, page scrolls, no tour layer)`, state.anyInert === 0 && state.overflow !== 'hidden' && state.layer === 0, JSON.stringify(state))
}
async function startFromHome(page) {
  await page.locator('.mate-tutorial-trigger').click()
  await page.waitForSelector(`${panel} [data-tour-next]`, { timeout: 20000 })
}
async function nextUntil(page, test, limit = 40) {
  for (let i = 0; i < limit && !test(new URL(page.url())); i++) {
    await page.locator(`${panel} [data-tour-next]`).click()
    await page.waitForTimeout(250)
  }
}
const count = async (page) => {
  const text = await page.locator('.service-tour-count').innerText().catch(() => '')
  const [n, total] = text.split('/').map((value) => Number(value.trim()))
  return { n, total }
}

/** 채린's line (cursor label or reduced-motion line) against the controls around the target. */
const lineOverControls = (page) => page.evaluate(() => {
  const line = document.querySelector('.service-tour-pointer .showcase-pointer-cursor-label, .service-tour-line')
  if (!line) return null
  const box = line.getBoundingClientRect()
  if (!box.width) return null
  const hit = (other) => box.left < other.right - 1 && other.left < box.right - 1 && box.top < other.bottom - 1 && other.top < box.bottom - 1
  const target = document.querySelector('[data-cursor-hover], [data-cursor-press]')
  // Reduced motion has no cursor: the lit spot (the target plus 8px) tells the target and what is inside it.
  const spot = document.querySelector('.service-tour-dim[data-spot]')?.getBoundingClientRect()
  const inSpot = (rect) => Boolean(spot && rect.left >= spot.left - 1 && rect.top >= spot.top - 1 && rect.right <= spot.right + 1 && rect.bottom <= spot.bottom + 1)
  const aroundSpot = (rect) => Boolean(spot && rect.left <= spot.left + 9 && rect.top <= spot.top + 9 && rect.right >= spot.right - 9 && rect.bottom >= spot.bottom - 9)
  const tour = document.querySelector('.service-tour-layer')
  // With the account modal open only its own controls show; the page behind is covered by it.
  const scope = document.querySelector('dialog[open]') ?? document
  const controls = [...scope.querySelectorAll('a[href], button, input, select, textarea, [role="tab"], [role="button"], [tabindex="0"]')]
    .filter((element) => !tour?.contains(element) && !(target && (target.contains(element) || element.contains(target))))
    .filter((element) => !element.checkVisibility || element.checkVisibility({ opacityProperty: true, visibilityProperty: true }))
  const covered = controls.filter((element) => {
    const rect = element.getBoundingClientRect()
    if (!target && (inSpot(rect) || aroundSpot(rect))) return false
    return rect.width > 0 && rect.height > 0 && hit(rect)
  }).map((element) => (element.getAttribute('aria-label') || element.textContent || element.className).toString().trim().slice(0, 24))
  const panelBox = document.querySelector('.service-tour-panel')?.getBoundingClientRect()
  return { covered, overPanel: Boolean(panelBox && hit(panelBox)), offScreen: box.left < 0 || box.top < 0 || box.right > innerWidth || box.bottom > innerHeight }
})

// ── Scenarios ──────────────────────────────────────────────────────────────────────────────────────────────────────

async function slow() {
  const { context, page } = await open({ slowTour: 6000 })
  const since = await mark(page)
  await page.locator('.mate-tutorial-trigger').click()
  await page.waitForTimeout(400)
  const loading = await page.locator('.service-tour-loading').count()
  const state = await lockState(page)
  check('slow chunk: app is locked at once (inert, no scroll) while the tour loads', state.rootInert && state.overflow === 'hidden', JSON.stringify(state))
  check('slow chunk: a 「사용법 불러오는 중 · 건너뛰기」 panel shows', loading === 1)
  // Try the real 「연결하기」 (connectMate) and a card while it loads: nothing may happen.
  for (const selector of ['[data-tour="mate-card-connect"]', '[data-tour="connect"]', '.home-mate-card-link']) {
    const control = page.locator(selector).first()
    if (await control.count()) await control.click({ force: true, timeout: 2000 }).catch(() => {})
  }
  await page.waitForTimeout(600)
  check('slow chunk: the real screen did not react (still home, no /connect)', new URL(page.url()).pathname === '/', page.url())
  await nothingReal(page, 'slow chunk', since)
  // The loading panel's 건너뛰기 ends it.
  await page.locator('.service-tour-loading button', { hasText: '건너뛰기' }).click()
  await page.waitForTimeout(500)
  check('slow chunk: 건너뛰기 while loading ends the tour', !new URL(page.url()).searchParams.has('tour'), page.url())
  await released(page, 'slow chunk skip')
  // Esc while loading too.
  await page.locator('.mate-tutorial-trigger').click()
  await page.waitForTimeout(300)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(500)
  check('slow chunk: Esc while loading ends the tour', !new URL(page.url()).searchParams.has('tour'), page.url())
  await released(page, 'slow chunk Esc')
  await context.close()
}

async function wrongStep() {
  const { context, page } = await open()
  await page.goto(`${origin}/records?tour=nope`, { waitUntil: 'networkidle' })
  await page.waitForSelector(`${panel} [data-tour-next]`, { timeout: 20000 })
  await page.waitForTimeout(800)
  const { n } = await count(page)
  check('wrong ?tour: starts over from the first step on home', n === 1 && new URL(page.url()).pathname === '/' && new URL(page.url()).searchParams.get('tour') === 'home-card', page.url())
  await context.close()
}

async function empty() {
  const { context, page } = await open({ emptyMates: true })
  const trigger = page.locator('.mate-tutorial-trigger')
  check('no mates: 「사용법 보기」 is disabled', await trigger.isDisabled().catch(() => false))
  await page.goto(`${origin}/?tour=detail-intro`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  const text = await page.locator(panel).innerText().catch(() => '')
  check('no mates: a direct tour link explains and offers to close (no wait, no /mates/ address)', /메이트/.test(text) && /닫기/.test(text) && !/\/mates\/(\?|$)/.test(page.url()), `${page.url()} | ${text.replace(/\n/g, ' ')}`)
  await page.locator(`${panel} button`, { hasText: '닫기' }).click()
  await page.waitForTimeout(500)
  check('no mates: 닫기 ends it', !new URL(page.url()).searchParams.has('tour'), page.url())
  await released(page, 'no mates')
  await context.close()
}

async function guest() {
  const { context, page } = await open()
  await page.locator('.header-avatar-btn').click()
  await page.locator('[data-account-logout]').first().click()
  await page.waitForURL(/\/login/, { timeout: 15000 })
  await page.goto(`${origin}/?tour=home-card`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  check('guest: a tour link leads to login, no tour', /\/login/.test(page.url()) && (await page.locator('.service-tour-layer').count()) === 0, page.url())
  await released(page, 'guest')
  await context.close()
}

async function account() {
  const { context, page } = await open()
  await startFromHome(page)
  const since = await mark(page)
  await nextUntil(page, (url) => url.searchParams.get('account') === 'profile')
  await page.waitForTimeout(1500)
  check('account: the tour layer lives in the open account modal', await page.evaluate(() => Boolean(document.querySelector('dialog[open] .service-tour-layer'))))
  check('account: the modal content is inert, the page behind is not scrolled', await page.evaluate(() => Boolean(document.querySelector('dialog[open] .account-settings-window[inert]')) && document.documentElement.style.overflow === 'hidden'))
  // A click on the backdrop must not close (and reopen) the modal: the same dialog element stays open.
  await page.evaluate(() => { window.__tourDialog = document.querySelector('dialog[open]') })
  await page.evaluate(() => { window.__tourUrls = []; const push = history.replaceState.bind(history); history.replaceState = (...args) => { window.__tourUrls.push(String(args[2])); return push(...args) } })
  await page.mouse.click(20, 450)
  await page.waitForTimeout(800)
  const kept = await page.evaluate(() => ({ same: document.querySelector('dialog[open]') === window.__tourDialog && Boolean(window.__tourDialog?.open), urls: window.__tourUrls }))
  check('account: a backdrop click keeps the same modal open (no close and reopen)', kept.same && kept.urls.length === 0 && new URL(page.url()).searchParams.get('tour') === 'account-profile', `${page.url()} ${JSON.stringify(kept.urls)}`)
  await page.locator(`${panel} [data-tour-next]`).click()
  await page.waitForTimeout(1200)
  check('account: 다음 goes to the settings tab', new URL(page.url()).searchParams.get('account') === 'settings' && (await page.locator('dialog[open] [data-tour="account-settings"]').count()) === 1, page.url())
  await nextUntil(page, (url) => url.searchParams.get('tour') === 'outro')
  await page.waitForTimeout(1200)
  check('account: outro closes the modal and keeps the tour', (await page.locator('dialog[open]').count()) === 0 && new URL(page.url()).searchParams.get('tour') === 'outro', page.url())
  const state = await lockState(page)
  check('account: back on the page the app is locked by the root again', state.rootInert && state.layer === 1, JSON.stringify(state))
  await nothingReal(page, 'account', since)
  // Skip from inside the modal closes it with the tour.
  await page.locator(`${panel} button`, { hasText: '이전' }).click()
  await page.waitForTimeout(1500)
  await page.locator(`${panel} [data-tour-skip]`).click()
  await page.waitForTimeout(700)
  check('account: 건너뛰기 in the modal closes it with the tour', (await page.locator('dialog[open]').count()) === 0 && !/account=|tour=/.test(page.url()), page.url())
  await released(page, 'account skip')
  await context.close()
}

async function leave() {
  const { context, page } = await open()
  // Esc from the practice call: back home, focus on 「사용법 보기」.
  await startFromHome(page)
  await nextUntil(page, (url) => url.pathname.startsWith('/tour/call/'))
  await page.waitForTimeout(1500)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(700)
  check('Esc: back where the tour started', new URL(page.url()).pathname === '/' && !new URL(page.url()).searchParams.has('tour'), page.url())
  await released(page, 'Esc')
  check('Esc: focus back on 「사용법 보기」', await page.evaluate(() => document.activeElement?.classList.contains('mate-tutorial-trigger')))
  // 건너뛰기 from my mates.
  await startFromHome(page)
  await nextUntil(page, (url) => url.pathname === '/mates/me')
  await page.waitForTimeout(1500)
  await page.locator(`${panel} [data-tour-skip]`).click()
  await page.waitForTimeout(700)
  check('건너뛰기: back where the tour started', new URL(page.url()).pathname === '/' && !new URL(page.url()).searchParams.has('tour'), page.url())
  await released(page, '건너뛰기')
  check('건너뛰기: focus back on 「사용법 보기」', await page.evaluate(() => document.activeElement?.classList.contains('mate-tutorial-trigger')))
  // Leaving by history (the address without ?tour).
  await startFromHome(page)
  await nextUntil(page, (url) => url.pathname === '/records')
  await page.waitForTimeout(1200)
  await page.evaluate(() => { window.history.pushState(null, '', '/records'); window.dispatchEvent(new PopStateEvent('popstate')) })
  await page.waitForTimeout(800)
  await released(page, 'route left')
  check('route left: focus is not lost in a removed layer', await page.evaluate(() => document.activeElement === document.body || document.body.contains(document.activeElement)))
  await context.close()
}

async function full({ reducedMotion = false } = {}) {
  const label = reducedMotion ? 'full (reduced motion)' : 'full'
  const { context, page } = await open({ reducedMotion })
  await startFromHome(page)
  const since = await mark(page)
  const covered = []
  const seen = new Set()
  /** The step counter shows a step other than `value` (a missing counter is not a change). */
  const movedFrom = (value) => page.waitForFunction((current) => {
    const text = document.querySelector('.service-tour-count')?.textContent
    return Boolean(text) && !text.startsWith(`${current} /`)
  }, value, { timeout: 15000 }).then(() => true).catch(() => false)
  for (let guard = 0; guard < 120; guard++) {
    const { n, total } = await count(page)
    if (!n) { await page.waitForTimeout(300); continue }
    if (!seen.has(n)) {
      seen.add(n)
      await page.waitForTimeout(reducedMotion ? 700 : 2700)
      const line = await lineOverControls(page)
      if (line && (line.covered.length || line.overPanel || line.offScreen)) covered.push(`${n}: ${JSON.stringify(line)}`)
      if (n === total) break
      const nextText = await page.locator(`${panel} [data-tour-next]`).innerText()
      // Screens change only on 다음 (and every step under reduced motion); inside a screen the step moves on by itself.
      if (reducedMotion || nextText.includes('·')) await page.locator(`${panel} [data-tour-next]`).click()
    }
    if (!(await movedFrom(n))) await page.locator(`${panel} [data-tour-next]`).click()
  }
  const { n, total } = await count(page)
  check(`${label}: reached the end (${n}/${total})`, n === total && total > 0)
  check(`${label}: 채린's line never covers a control near the target, the panel or the screen edge`, covered.length === 0, covered.join(' ; '))
  check(`${label}: never left for the real call screen`, !/\/connect\//.test(page.url()))
  await nothingReal(page, label, since)
  await page.locator(`${panel} button`, { hasText: '메이트 만나러 가기' }).click()
  await page.waitForTimeout(900)
  check(`${label}: 메이트 만나러 가기 closes it on the mate list`, !new URL(page.url()).searchParams.has('tour') && (await page.evaluate(() => document.activeElement?.id)) === 'mates-heading', page.url())
  await released(page, label)
  await context.close()
}

const run = { slow, 'wrong-step': wrongStep, empty, guest, account, leave, full: async () => { await full(); await full({ reducedMotion: true }) } }
watchdog.step('warm-up')
await warmUpDevServer(browser, origin, ['/', '/mates/me', '/records', '/mates/chaerin'])
for (const name of scenarios) {
  watchdog.step(name)
  console.log(`— ${name}`)
  try {
    await run[name]()
  } catch (error) {
    check(`${name}: ran to the end`, false, error.message.split('\n')[0])
  }
}
await browser.close()
watchdog.stop()
console.log(failures.length ? `\n${failures.length} failed` : '\nall checks passed')
process.exit(failures.length ? 1 : 0)
