// The mate's voice on the call screen, against the local mock (28 `tts` → the mock's test tone in three mp3 cuts):
// - off until the user turns it on (the server default `voiceEnabled: true` alone sends `tts: false`); the dock's
//   「메이트 음성 켜기」 turns it on (aria-pressed, a one-time note, the settings switch shows the same value) and
//   「끄기」 stops a voice that is playing;
// - a reply's pieces play back to back on one clock (each part starts where the one before ends, 1.6 s in all), the
//   turn is charged as a voice turn (20) and `done.voice` is true;
// - the v2 mouth follows the voice (`ParamMouthOpenY` sent every frame while it plays) — when the dev model is there;
// - a new reply stops the voice before it; so does pressing to talk (누르고 말하기, a stand-in recognizer);
// - a hidden tab stops it, unless the PiP window is open: then it plays on and the mouth moves in that window (when
//   the browser offers Document PiP);
// - the browser's autoplay rule: the voice waits, 「소리 켜기」 shows, and a press lets it play;
//
// Needs the dev server in local mock mode and Playwright (not a project dependency):
//
//   npx vite --port 5231 --strictPort &
//   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs \
//   PLAYWRIGHT_CHROMIUM=<installed Chromium, optional> \
//     node scripts/check-voice-reply.mjs http://127.0.0.1:5231
//
// With CHECK_BROWSER=webkit (and PLAYWRIGHT_WEBKIT=<installed WebKit>, optional) it runs in Safari's engine.
//
// Prints one line per check and exits with 1 when any fails.
/* global window, document, AudioBufferSourceNode, AudioContext -- page.evaluate / init script bodies run in the browser */
import { startWatchdog, warmUpDevServer } from './lib/browser-check-guard.mjs'

const { chromium, webkit } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const [origin = 'http://127.0.0.1:5231'] = process.argv.slice(2)
const watchdog = startWatchdog('check-voice-reply')
// CHECK_BROWSER=webkit runs it in Playwright's WebKit (Safari's engine; PLAYWRIGHT_WEBKIT: its executable, optional).
const onWebkit = process.env.CHECK_BROWSER === 'webkit'
const browser = onWebkit
  ? await webkit.launch({ executablePath: process.env.PLAYWRIGHT_WEBKIT || undefined })
  : await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--headless=new'] })
const failures = []
const check = (name, ok, detail = '') => {
  watchdog.step(name)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}
const note = (text) => console.log(`note ${text}`)

/**
 * Watches Web Audio and the v2 player from outside the app: every started / stopped source, the context, the mouth
 * values sent to the model. `__voice.slow` plays sources at quarter speed (a voice still playing when the next
 * thing happens); `__voice.block` refuses `resume()` like a browser holding sound until a gesture. A stand-in
 * recognizer lets 누르고 말하기 start without a microphone.
 */
function instrument() {
  const log = window.__voice = { starts: [], stops: 0, open: 0, slow: false, block: false, bodies: [] }
  const Start = AudioBufferSourceNode.prototype.start
  AudioBufferSourceNode.prototype.start = function (when, offset, duration) {
    if (log.slow) this.playbackRate.value = 0.25
    log.starts.push({ when, offset, duration })
    return Start.call(this, when, offset, duration)
  }
  const Stop = AudioBufferSourceNode.prototype.stop
  AudioBufferSourceNode.prototype.stop = function (...args) { log.stops++; return Stop.apply(this, args) }
  const Resume = AudioContext.prototype.resume
  AudioContext.prototype.resume = function () { return log.block ? Promise.reject(new DOMException('held', 'NotAllowedError')) : Resume.call(this) }
  const Context = window.AudioContext
  window.AudioContext = class extends Context {
    constructor(...args) { super(...args); window.__voiceContext = this; if (log.block) void this.suspend() }
  }
  let player
  Object.defineProperty(window, 'CapsuleV2Player', { configurable: true, get: () => player, set: (value) => {
    const create = value.create.bind(value)
    player = { ...value, create: async (...args) => {
      const created = await create(...args)
      const track = created.track?.bind(created)
      if (track) created.track = (params) => { if ((params.ParamMouthOpenY ?? 0) > 0.05) log.open++; return track(params) }
      return created
    } }
  } })
  class Recognition {
    start() { setTimeout(() => this.onstart?.(), 0) }
    stop() { setTimeout(() => this.onend?.(), 0) }
    abort() { setTimeout(() => this.onend?.(), 0) }
  }
  window.SpeechRecognition = Recognition
  window.webkitSpeechRecognition = Recognition
  // The local mock replaces `fetch` (and the API client keeps the one it found): log the bodies of the one it sets.
  let current = window.fetch
  Object.defineProperty(window, 'fetch', { configurable: true, get: () => current, set: (value) => {
    current = function (input, init) {
      if (String(input?.url ?? input).includes('/messages/stream') && typeof init?.body === 'string') log.bodies.push(JSON.parse(init.body))
      return value.call(this, input, init)
    }
  } })
}

async function call({ block = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  await context.addInitScript(instrument)
  const page = await context.newPage()
  await page.goto(`${origin}/`, { waitUntil: 'networkidle' })
  await page.evaluate(() => { localStorage.clear() })
  await page.goto(`${origin}/`, { waitUntil: 'networkidle' })
  if (block) await page.evaluate(() => { window.__voice.block = true })
  await page.waitForTimeout(2500)
  await page.locator('.home-mate-card--active').first().locator('.home-mate-card-enter').click()
  await page.waitForURL(/\/connect\/chaerin/)
  await page.waitForTimeout(3000)
  return { context, page }
}
/** The dock's 「메이트 음성」 button: on (a one-time note the first time). */
async function turnVoiceOn(page) {
  await page.getByRole('button', { name: '메이트 음성 켜기' }).click()
  await page.waitForTimeout(300)
}
const voice = (page) => page.evaluate(() => ({ starts: window.__voice.starts, stops: window.__voice.stops, open: window.__voice.open, state: window.__voiceContext?.state, bodies: window.__voice.bodies }))
async function say(page, text) {
  const box = page.locator('textarea')
  // The previous reply may still be typing: the composer waits for it.
  for (let i = 0; i < 100; i++) {
    if (!(await box.inputValue())) await box.fill(text)
    if (await page.getByRole('button', { name: '메시지 보내기' }).isEnabled()) break
    await page.waitForTimeout(100)
  }
  await page.getByRole('button', { name: '메시지 보내기' }).click()
}
const settle = (page, ms = 2500) => page.waitForTimeout(ms)

async function reply() {
  const { context, page } = await call()
  await turnVoiceOn(page)
  const before = await page.evaluate(async () => (await (await fetch('/api/backend/credits/transactions?filter=USE')).json()).data.items.length)
  await say(page, '안녕')
  await settle(page)
  const { starts, open, bodies } = await voice(page)
  check('reply: the message asks for voice (tts: true)', bodies[0]?.tts === true, JSON.stringify(bodies[0]))
  const joined = starts.length >= 2 && starts.every((part, index) => index === 0 || Math.abs(part.when - (starts[index - 1].when + starts[index - 1].duration)) < 0.002)
  check('reply: the pieces play back to back (each part starts where the one before ends)', joined, JSON.stringify(starts.map(({ when, duration }) => [when.toFixed(3), duration.toFixed(3)])))
  const total = starts.reduce((sum, part) => sum + part.duration, 0)
  // 1.6 s of tone; WebKit keeps the mp3 encoder's start and end padding that Chrome trims (≈ 1.66 s there).
  check('reply: all of the voice plays, once (1.6 s, plus the encoder padding WebKit keeps)', total > 1.58 && total < 1.7, total.toFixed(3))
  const items = await page.evaluate(async () => (await (await fetch('/api/backend/credits/transactions?filter=USE')).json()).data.items)
  check('reply: charged as a voice turn (20)', items.length === before + 1 && items[0]?.change === -20, JSON.stringify(items[0]))
  if (await page.locator('.connection-mate canvas').count()) check('reply: the v2 mouth follows the voice', open > 10, `${open} open frames`)
  else note('no v2 model on this dev server (local-assets): the mouth is checked by the unit tests only')
  if (process.env.CHECK_SCREENSHOT_DIR) await page.screenshot({ path: `${process.env.CHECK_SCREENSHOT_DIR}/voice-reply.png` })
  await context.close()
}

async function stops() {
  const { context, page } = await call()
  await turnVoiceOn(page)
  await page.evaluate(() => { window.__voice.slow = true })
  await say(page, '첫 번째')
  await page.waitForTimeout(800)
  const first = await voice(page)
  await say(page, '두 번째')
  await page.waitForTimeout(800)
  const second = await voice(page)
  check('next reply: the voice before it stops', second.stops > first.stops && second.starts.length > first.starts.length, `stops ${first.stops} → ${second.stops}`)
  // 누르고 말하기 (Space held, outside the composer): the voice gives way. Talking waits for the reply to finish typing
  // (the composer's send button says when); the slowed voice is still playing then.
  const box = page.locator('textarea')
  for (let i = 0; i < 100; i++) {
    await box.fill('x')
    if (await page.getByRole('button', { name: '메시지 보내기' }).isEnabled()) break
    await page.waitForTimeout(100)
  }
  await box.fill('')
  await page.evaluate(() => { document.activeElement?.blur?.() })
  const playing = await voice(page)
  await page.keyboard.down('Space')
  await page.waitForTimeout(300)
  const listening = await voice(page)
  await page.keyboard.up('Space')
  const status = await page.locator('.connection-stt').getAttribute('data-status').catch(() => null)
  check('push to talk: pressing stops the voice', listening.stops > playing.stops, `stops ${playing.stops} → ${listening.stops}, stt ${status}`)
  // A hidden tab (no PiP): stops.
  await page.waitForTimeout(1500)
  await say(page, '세 번째')
  await page.waitForTimeout(800)
  const shown = await voice(page)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(200)
  const hidden = await voice(page)
  check('hidden tab: the voice stops', hidden.stops > shown.stops, `stops ${shown.stops} → ${hidden.stops}`)
  await page.evaluate(() => { delete document.hidden; document.dispatchEvent(new Event('visibilitychange')) })
  await context.close()
}

async function pip() {
  const { context, page } = await call()
  const supported = await page.evaluate(() => 'documentPictureInPicture' in window)
  if (!supported) { note('this browser has no Document PiP: PiP playback is left to a manual check'); await context.close(); return }
  await page.getByRole('button', { name: /PIP로 띄우기/ }).click()
  await page.waitForTimeout(1500)
  const opened = await page.evaluate(() => Boolean(window.documentPictureInPicture?.window))
  if (!opened) { note('the PiP window did not open here (headless): PiP playback is left to a manual check'); await context.close(); return }
  await turnVoiceOn(page)
  await page.evaluate(() => { window.__voice.slow = true })
  await say(page, 'PIP에서도 들려?')
  await page.waitForTimeout(800)
  const before = await voice(page)
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true })
    document.dispatchEvent(new Event('visibilitychange'))
  })
  await page.waitForTimeout(300)
  const after = await voice(page)
  check('PiP: the voice plays with the PiP window open', before.starts.length > 0)
  check('PiP: a hidden tab keeps the voice while PiP is open', after.stops === before.stops, `stops ${before.stops} → ${after.stops}`)
  // The model moved into the PiP window draws there (its own frames): the mouth keeps following the voice.
  await page.waitForTimeout(600)
  const later = await voice(page)
  const live = await page.evaluate(() => Boolean(window.documentPictureInPicture?.window?.document.querySelector('canvas')))
  if (live) check('PiP: the mouth follows the voice in the PiP window, tab hidden', later.open > after.open, `${after.open} → ${later.open} open frames`)
  else note('no live model in the PiP window (still image): the PiP mouth is not checked')
  await context.close()
}

async function blocked() {
  const { context, page } = await call({ block: true })
  await turnVoiceOn(page)
  await say(page, '들려?')
  await page.waitForTimeout(1500)
  const unlock = page.getByRole('button', { name: '소리 켜기' })
  const visible = await unlock.isVisible().catch(() => false)
  const held = await voice(page)
  check('autoplay: the voice waits and 「소리 켜기」 shows', visible && held.state === 'suspended', `visible ${visible}, context ${held.state}`)
  await page.evaluate(() => { window.__voice.block = false })
  if (visible) await unlock.click()
  await page.waitForTimeout(1200)
  const after = await voice(page)
  const gone = !(await unlock.isVisible().catch(() => false))
  check('autoplay: a press lets it play and the button goes', after.state === 'running' && gone, `context ${after.state}, button gone ${gone}`)
  await context.close()
}

async function toggle() {
  const { context, page } = await call()
  const dir = process.env.CHECK_SCREENSHOT_DIR
  const dock = page.locator('.connection-controls')
  // Off by default (server voiceEnabled true): nothing is asked for.
  const offButton = page.getByRole('button', { name: '메이트 음성 켜기' })
  check('default: 메이트 음성 is off (aria-pressed false)', (await offButton.getAttribute('aria-pressed')) === 'false')
  if (dir) await dock.screenshot({ path: `${dir}/dock-voice-off.png` })
  await say(page, '조용히')
  await settle(page, 1500)
  let state = await voice(page)
  check('default: the message goes with tts: false and nothing plays', state.bodies.at(-1)?.tts === false && state.starts.length === 0, JSON.stringify(state.bodies.at(-1)))
  // On from the dock: pressed, a one-time note, the same value in the settings.
  await offButton.click()
  const onButton = page.getByRole('button', { name: '메이트 음성 끄기' })
  const note = page.locator('.connection-voice-intro')
  check('dock: on (aria-pressed true) with a short note', (await onButton.getAttribute('aria-pressed')) === 'true' && await note.isVisible(), await note.textContent().catch(() => ''))
  if (dir) { await page.mouse.move(10, 10); await page.waitForTimeout(300); await dock.screenshot({ path: `${dir}/dock-voice-on.png` }); await page.screenshot({ path: `${dir}/call-voice-on.png` }) }
  await page.getByRole('button', { name: '설정' }).first().click()
  const toggle = page.getByRole('switch', { name: '메이트 음성' })
  await toggle.waitFor()
  check('settings: the switch shows the same value (on) and the credit line', (await toggle.getAttribute('aria-checked')) === 'true' && /답장마다 음성 20 크레딧/.test(await page.locator('.connection-settings-sections').textContent()))
  await page.keyboard.press('Escape')
  await page.waitForTimeout(400)
  // Off while her voice plays: it stops at once; on again: no second note.
  await page.evaluate(() => { window.__voice.slow = true })
  await say(page, '들려?')
  await page.waitForTimeout(900)
  const playing = await voice(page)
  await onButton.click()
  await page.waitForTimeout(200)
  state = await voice(page)
  check('dock: off stops the voice that is playing', state.stops > playing.stops && playing.starts.length > 0, `stops ${playing.stops} → ${state.stops}`)
  await page.getByRole('button', { name: '메이트 음성 켜기' }).click()
  await page.waitForTimeout(300)
  check('dock: the note shows only the first time', !(await note.isVisible().catch(() => false)))
  await context.close()
}

await warmUpDevServer(browser, origin, ['/'])
for (const [name, run] of [['reply', reply], ['stops', stops], ['pip', pip], ['autoplay', blocked], ['on and off', toggle]]) {
  watchdog.step(name)
  console.log(`— ${name}`)
  try { await run() } catch (error) { check(`${name}: ran to the end`, false, error.message.split('\n')[0]) }
}
await browser.close()
watchdog.stop()
console.log(failures.length ? `\n${failures.length} failed` : '\nall checks passed')
process.exit(failures.length ? 1 : 0)
