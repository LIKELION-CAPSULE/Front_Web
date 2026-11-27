// Renders the capsule stills (src/assets/capsule/README.md) from src/assets/capsule/capsule-render.html: the canonical
// capsule of src/shared/three/capsule-model.ts, one transparent WebP per screen that only needs a picture.
//
// Needs the dev server and Playwright (not a project dependency):
//
//   npx vite --port 5231 --strictPort &
//   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs \
//   PLAYWRIGHT_CHROMIUM=<installed Chromium, optional> \
//     node scripts/render-capsule-stills.mjs http://127.0.0.1:5231 [name ...]
//
// Without names it renders every still below. The page renders with SwiftShader so the result does not depend on the
// machine's GPU.
/* global document, window -- page.evaluate and waitForFunction bodies run in the browser */

import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

/** Each still: its file and the render query (capsule-render.html documents the parameters). */
export const CAPSULE_STILLS = [
  // 친구 초대 progress strip (invite page): lying diagonally like the strip always had it, filled or still empty.
  { file: 'src/assets/capsule/capsule-filled.webp', query: 'state=filled&w=224&h=224&roll=212&yaw=-14&fill=0.98&glow=2.3&sat=1.15' },
  { file: 'src/assets/capsule/capsule-empty.webp', query: 'state=empty&w=224&h=224&roll=212&yaw=-14&fill=0.98&glow=2.6' },
  // Upright, a little tilted: the empty records jar when WebGL is missing.
  { file: 'src/assets/capsule/capsule-upright.webp', query: 'state=filled&w=320&h=320&roll=104&yaw=-12&fill=0.82&glow=1.6' },
  // Mate detail hero: the capsule beside the mate, opening (tinted half lifted), at the old neon capsule's angle.
  { file: 'src/assets/capsule/capsule-open.webp', query: 'state=open&w=500&h=500&roll=118&yaw=-16&fill=0.8&glow=1.6' },
]

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
  const [origin = 'http://127.0.0.1:5231', ...names] = process.argv.slice(2)
  const browser = await chromium.launch({
    executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined,
    args: ['--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
  })
  const page = await browser.newPage({ viewport: { width: 1200, height: 700 } })
  page.on('pageerror', (error) => console.error(`page error: ${error.message}`))
  let failed = false
  for (const still of CAPSULE_STILLS) {
    if (names.length && !names.some((name) => still.file.includes(name))) continue
    await page.goto(`${origin}/src/assets/capsule/capsule-render.html?${still.query}`)
    try {
      await page.waitForFunction(() => document.title === 'ready', null, { timeout: 30_000 })
    } catch {
      console.error(`FAIL ${still.file}: the render page did not finish`)
      failed = true
      continue
    }
    const { webp, width, height } = await page.evaluate(() => window.__capsuleStill)
    if (!webp.startsWith('data:image/webp')) {
      console.error(`FAIL ${still.file}: the browser did not encode WebP`)
      failed = true
      continue
    }
    const bytes = Buffer.from(webp.slice(webp.indexOf(',') + 1), 'base64')
    await writeFile(still.file, bytes)
    console.log(`ok   ${still.file} ${width}×${height} ${(bytes.length / 1024).toFixed(1)} kB`)
  }
  await browser.close()
  process.exit(failed ? 1 : 0)
}
