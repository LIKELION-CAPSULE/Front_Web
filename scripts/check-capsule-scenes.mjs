// Regression check for the canonical capsule's real-time scenes: the 친구 초대 dome (InviteHeroArt,
// invite-dome-scene.ts) and the empty records jar (RecordsEmptyJar, empty-jar-scene.ts). For each: the 3D draws
// (render mode `webgl`), stays within its budget (≤ 60k triangles for the dome, device pixel ratio ≤ 1.75), stops its
// loop when nothing moves, answers motion (entry drop, a new invite, the pointer tilt, the button hover), draws a
// still frame under reduced motion, and falls back to the picture without WebGL and after a lost context. With a
// second origin (the same pages before the change) it also compares the hero layout at 900, 1280 and 1440 px.
//
// Needs the dev server in local mock mode and Playwright (not a project dependency):
//
//   VITE_DATA_SOURCE=mock npx vite --port 5231 --strictPort &
//   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs \
//   PLAYWRIGHT_CHROMIUM=<installed Chromium, optional> \
//     node scripts/check-capsule-scenes.mjs http://127.0.0.1:5231 [baseline origin] [screenshot dir]
//
// Prints one line per check and exits with 1 when any fails.
/* global document, window, Image -- page.evaluate bodies run in the browser */

import { startWatchdog } from './lib/browser-check-guard.mjs'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const [origin = 'http://127.0.0.1:5231', baseline, shots] = process.argv.slice(2)
const watchdog = startWatchdog('check-capsule-scenes')
const launch = (args = []) =>
  chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
    args: ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', ...args],
  })
const browser = await launch()
const failures = []
const check = (name, ok, detail = '') => {
  watchdog.step(name)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}
const shot = async (page, name) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png` })
}
const errorsOf = (page) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}
const renderMode = (page, selector) => page.locator(selector).getAttribute('data-render')
const waitForMode = (page, selector, mode, timeout = 20_000) =>
  page.waitForSelector(`${selector}[data-render='${mode}']`, { timeout }).then(() => true, () => false)
const domeStats = (page) => page.evaluate(() => window.__inviteDome?.stats() ?? null)
const loseContext = (page, selector) =>
  page.evaluate((canvasSelector) => {
    const canvas = document.querySelector(canvasSelector)
    const gl = canvas?.getContext('webgl2') ?? canvas?.getContext('webgl')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return Boolean(gl)
  }, selector)
/** Mean absolute pixel change of an element between two moments (0…255). */
async function change(page, selector, waitMs) {
  const box = await page.locator(selector).boundingBox()
  const clip = { x: box.x, y: box.y, width: box.width, height: box.height }
  const a = await page.screenshot({ clip })
  await page.waitForTimeout(waitMs)
  const b = await page.screenshot({ clip })
  return page.evaluate(
    async ([first, second]) => {
      const load = async (base64) => {
        const image = new Image()
        image.src = `data:image/png;base64,${base64}`
        await image.decode()
        const canvas = document.createElement('canvas')
        canvas.width = image.width
        canvas.height = image.height
        const context = canvas.getContext('2d')
        context.drawImage(image, 0, 0)
        return context.getImageData(0, 0, image.width, image.height).data
      }
      const [x, y] = await Promise.all([load(first), load(second)])
      let sum = 0
      for (let index = 0; index < x.length; index += 4) sum += Math.abs(x[index] - y[index]) + Math.abs(x[index + 1] - y[index + 1]) + Math.abs(x[index + 2] - y[index + 2])
      return sum / (x.length / 4) / 3
    },
    [a.toString('base64'), b.toString('base64')],
  )
}

/** Mean pixel change (0…255) below which a region counts as still: the page behind the transparent canvas may shift faintly. */
const STILL = 0.25
const ART = '.invite-art'
const INVITE = (scenario) => `/credits/invite?__review=${scenario}`

// ── Invite dome ──
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  const page = await context.newPage()
  const errors = errorsOf(page)
  await page.goto(origin + INVITE('invite-full'))
  check('dome: 3D replaces the picture', await waitForMode(page, ART, 'webgl'))
  await page.waitForTimeout(2600)
  // The entry drop again from empty (software rendering may have drawn most of the first one before the check looked).
  await page.evaluate(() => {
    window.__inviteDome.setFilled(0, 0)
    window.__inviteDome.setFilled(10, 0)
  })
  check('dome: capsules drop in', (await domeStats(page))?.animating === true)
  await page.waitForTimeout(700)
  await shot(page, 'invite-mid-drop')
  await page.waitForTimeout(2600)
  const stats = await domeStats(page)
  check('dome: ≤ 60k triangles', stats && stats.triangles <= 60_000, `${stats?.triangles} triangles, ${stats?.calls} draw calls`)
  check('dome: device pixel ratio ≤ 1.75 on a 2× screen', stats && stats.dpr <= 1.75, `dpr ${stats?.dpr}`)
  check('dome: loop stops once the capsules sit', stats?.animating === false)
  await shot(page, 'invite-1440-full')
  // Pointer tilt: moves, then settles and stops again.
  const art = await page.locator(ART).boundingBox()
  await page.mouse.move(art.x + art.width * 0.95, art.y + art.height * 0.1, { steps: 3 })
  check('dome: the pointer tilts it (loop running)', (await domeStats(page))?.animating === true)
  await page.mouse.move(5, 5)
  await page.waitForTimeout(2200)
  check('dome: tilt settles and the loop stops', (await domeStats(page))?.animating === false)
  // A new invite: one capsule drops, the highlight sweeps, the flag waves — then still again.
  await page.evaluate(() => {
    window.__inviteDome.setFilled(9, 9)
    window.__inviteDome.setFilled(10, 9)
    window.__inviteDome.celebrate()
  })
  await page.waitForTimeout(450)
  await shot(page, 'invite-new-invite')
  check('dome: a new invite animates', (await domeStats(page))?.animating === true)
  await page.waitForTimeout(2400)
  check('dome: and stops after it', (await domeStats(page))?.animating === false)
  // Off screen: nothing draws.
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
  await page.waitForTimeout(300)
  await page.evaluate(() => window.__inviteDome.celebrate())
  check('dome: no loop while off screen', (await domeStats(page))?.animating === false)
  await page.evaluate(() => window.scrollTo(0, 0))
  check('dome: one WebGL canvas', (await page.locator(`${ART} canvas`).count()) === 1)
  // A lost context: the picture comes back.
  await loseContext(page, `${ART} canvas`)
  check('dome: a lost context shows the picture', await waitForMode(page, ART, 'fallback', 4000))
  check('dome: the picture shows the counted capsules', (await page.locator('.invite-dome-capsule').count()) === 10)
  check('dome: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

for (const [scenario, filled] of [['invite-empty', 0], ['invite-three', 3], ['invite-full', 10]]) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(origin + INVITE(scenario))
  const ready = await waitForMode(page, ART, 'webgl')
  await page.waitForTimeout(2600)
  const strip = await page.locator('.invite-progress-capsules li[data-filled]').count()
  check(`dome: ${scenario} draws (${filled} capsules, strip ${strip})`, ready && strip === filled)
  await shot(page, `invite-${filled}`)
  await context.close()
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto(origin + INVITE('invite-full'))
  check('dome, reduced motion: still frame', await waitForMode(page, ART, 'webgl'))
  await page.waitForTimeout(400)
  check('dome, reduced motion: no loop, capsules seated at once', (await domeStats(page))?.animating === false)
  const art = await page.locator(ART).boundingBox()
  await page.mouse.move(art.x + art.width * 0.95, art.y + 10, { steps: 3 })
  check('dome, reduced motion: no tilt', (await domeStats(page))?.animating === false)
  await shot(page, 'invite-reduced-motion')
  await context.close()
}

// Layout: the hero art keeps its place at 900, 1280 and 1440 px (against the baseline origin, when given).
for (const width of [900, 1280, 1440]) {
  const measure = async (base) => {
    // Reduced motion: the mascots' float would move their boxes between the two measurements.
    const context = await browser.newContext({ viewport: { width, height: 900 }, reducedMotion: 'reduce' })
    const page = await context.newPage()
    await page.goto(base + INVITE('invite-filled'))
    await page.waitForSelector(ART)
    await page.waitForTimeout(1500)
    const boxes = await page.evaluate(() =>
      ['.invite-art', '.invite-dome', '.invite-mascot--left', '.invite-mascot--right', '.invite-hero-copy', '.invite-progress'].map((selector) => {
        const box = document.querySelector(selector)?.getBoundingClientRect()
        return box ? [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)] : null
      }),
    )
    if (base === origin) await shot(page, `invite-${width}`)
    await context.close()
    return boxes
  }
  const now = await measure(origin)
  if (baseline) {
    const before = await measure(baseline)
    const same = JSON.stringify(now) === JSON.stringify(before)
    check(`dome: hero layout unchanged at ${width}px`, same, same ? '' : `before ${JSON.stringify(before)} now ${JSON.stringify(now)}`)
  } else check(`dome: hero laid out at ${width}px`, now.every(Boolean))
}

// ── Empty records jar ──
const JAR = '.records-empty-jar'
const RECORDS = '/records?__review=records-empty'
{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
  const page = await context.newPage()
  const errors = errorsOf(page)
  await page.goto(origin + RECORDS)
  check('records: 3D jar draws', await waitForMode(page, JAR, 'webgl'))
  const size = await page.evaluate(() => {
    const canvas = document.querySelector('.records-empty-jar canvas')
    return { ratio: canvas.width / canvas.clientWidth, height: canvas.clientHeight, canvases: document.querySelectorAll('.records-empty-jar canvas').length }
  })
  check('records: device pixel ratio ≤ 1.75, one canvas, ~200px high', size.ratio <= 1.751 && size.canvases === 1 && Math.abs(size.height - 200) <= 2, JSON.stringify(size))
  await page.waitForTimeout(800)
  const moving = await change(page, `${JAR} canvas`, 700)
  check('records: the capsule floats and breathes', moving > STILL, `mean change ${moving.toFixed(3)}`)
  await shot(page, 'records-empty')
  await page.locator('a', { hasText: '메이트 만나러 가기' }).hover()
  await page.waitForTimeout(230)
  await shot(page, 'records-empty-hop')
  check('records: no page errors', errors.length === 0, errors.join(' | '))
  await loseContext(page, `${JAR} canvas`)
  check('records: a lost context shows the still picture', await waitForMode(page, JAR, 'fallback', 4000))
  await context.close()
}

{
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' })
  const page = await context.newPage()
  await page.goto(origin + RECORDS)
  check('records, reduced motion: still frame', await waitForMode(page, JAR, 'webgl'))
  await page.waitForTimeout(600)
  const still = await change(page, `${JAR} canvas`, 900)
  check('records, reduced motion: nothing moves', still <= STILL, `mean change ${still.toFixed(3)}`)
  await page.locator('a', { hasText: '메이트 만나러 가기' }).hover()
  const hover = await change(page, `${JAR} canvas`, 300)
  check('records, reduced motion: no hop', hover <= STILL, `mean change ${hover.toFixed(3)}`)
  await context.close()
}

await browser.close()

// ── Without WebGL ──
{
  const noGl = await launch(['--disable-webgl', '--disable-3d-apis'])
  const context = await noGl.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(origin + INVITE('invite-three'))
  await page.waitForSelector(ART)
  check('no WebGL: the dome picture with its capsules', (await renderMode(page, ART)) === 'fallback' && (await page.locator('.invite-dome-capsule').count()) === 3)
  await page.waitForTimeout(1500)
  await shot(page, 'invite-no-webgl')
  await page.goto(origin + RECORDS)
  await page.waitForSelector(JAR)
  check('no WebGL: the empty records still picture', (await renderMode(page, JAR)) === 'fallback' && (await page.locator(`${JAR} img`).count()) === 1)
  await shot(page, 'records-empty-no-webgl')
  await noGl.close()
}

watchdog.stop()
console.log(failures.length ? `\n${failures.length} failed` : '\nall passed')
process.exit(failures.length ? 1 : 0)
