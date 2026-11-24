// Writes a round-ready thumbnail (head and shoulders, transparent PNG) for each local Live2D sample avatar into
// local-assets/avatars/thumbnails/<key>.png, by capturing the onboarding preview once the model is drawn. The files
// stay in local-assets/ (ignored by Git); the local mock's GET /avatars then uses them instead of silhouettes.
// Production does not use these: the backend sends each avatar's thumbnailUrl.
//
// Needs the dev server in local mock mode and Playwright (not a project dependency):
//
//   npx vite --port 5231 --strictPort &
//   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs \
//   PLAYWRIGHT_CHROMIUM=<installed Chromium, optional> \
//     node scripts/capture-avatar-thumbnails.mjs http://127.0.0.1:5231
/* global document, Image -- page.evaluate bodies run in the browser */
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const KEYS = ['hiyori', 'haru', 'natori', 'chitose', 'epsilon', 'wanko'] // Same order as src/features/local-demo/local-avatars.ts
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const [origin = 'http://127.0.0.1:5231'] = process.argv.slice(2)
const outDir = fileURLToPath(new URL('../local-assets/avatars/thumbnails/', import.meta.url))
mkdirSync(outDir, { recursive: true })

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--headless=new'] })
const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 })
const page = await context.newPage()
// Start from a fresh local account that still needs onboarding (the local Kakao button does that).
await page.goto(`${origin}/login`, { waitUntil: 'networkidle' })
await page.evaluate(() => { localStorage.clear(); sessionStorage.clear() })
await page.goto(`${origin}/login`, { waitUntil: 'networkidle' })
await page.locator('button.kakao-button').first().click()
await page.waitForURL(/onboarding/, { timeout: 15000 })
// Only the model: no page colours, no halo, no fade at the waist.
await page.addStyleTag({ content: `
  html, body, #root, .app-surface, .auth-panel-layout, .onboarding, .onboarding::before { background: transparent !important; }
  .onboarding::before, .avatar-picker-halo, .avatar-picker-model-status, .local-demo-controls { display: none !important; }
  .avatar-picker-figure { -webkit-mask-image: none !important; mask-image: none !important; }
` })

/** Pixels in the eye band that are saturated and not too light (irises, pupils): closed eyes score low. */
function eyeScore(png) {
  return page.evaluate(async (base64) => {
    const image = new Image()
    image.src = `data:image/png;base64,${base64}`
    await image.decode()
    const canvas = document.createElement('canvas')
    canvas.width = image.width
    canvas.height = image.height
    const context = canvas.getContext('2d')
    context.drawImage(image, 0, 0)
    const top = Math.round(image.height * 0.25), height = Math.round(image.height * 0.3)
    const { data } = context.getImageData(0, top, image.width, height)
    let score = 0
    for (let index = 0; index < data.length; index += 4) {
      const [r, g, b, a] = [data[index], data[index + 1], data[index + 2], data[index + 3]]
      const max = Math.max(r, g, b), min = Math.min(r, g, b)
      if (a > 200 && max < 200 && max - min > 60) score++
    }
    return score
  }, png.toString('base64'))
}

const options = page.locator('.avatar-picker-option')
await options.first().waitFor({ timeout: 15000 })
const count = await options.count()
if (count !== KEYS.length) throw new Error(`Expected ${KEYS.length} avatars, found ${count}.`)
for (const [index, key] of KEYS.entries()) {
  await options.nth(index).click()
  await page.waitForSelector('.avatar-picker-model:not([data-leaving]) .live2d-host[data-status="ready"]', { timeout: 30000 })
  await page.mouse.move(0, 0) // Face forward: the preview follows the pointer.
  await page.waitForTimeout(2600)
  const stage = await page.locator('.avatar-picker-stage').boundingBox()
  // Faces sit at about 36% of the 4:5 stage (the framing values); a square of 68% of its width holds head and shoulders.
  const side = stage.width * 0.68
  const clip = { x: stage.x + (stage.width - side) / 2, y: stage.y + stage.height * 0.38 - side / 2, width: side, height: side }
  // Idle motions blink and close the eyes now and then: take several frames and keep the one with the most open eyes.
  let best = null
  for (let frame = 0; frame < 8; frame++) {
    const shot = await page.screenshot({ clip, omitBackground: true })
    const score = await eyeScore(shot)
    if (!best || score > best.score) best = { shot, score }
    await page.waitForTimeout(450)
  }
  writeFileSync(`${outDir}${key}.png`, best.shot)
  console.log(`wrote local-assets/avatars/thumbnails/${key}.png`)
}
await browser.close()
