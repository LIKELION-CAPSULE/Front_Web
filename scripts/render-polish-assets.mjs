/* global document */
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const origin = process.argv[2] ?? 'http://127.0.0.1:53187'
const out = join(process.env.CX_3D_EVIDENCE_DIR ?? '/tmp/cx-3d-evidence', 'reward')
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } })
  page.on('pageerror', error => console.error(error.message))
  for (const [name, color] of [['hangup-handset-3d', '#6f45f0'], ['hangup-handset-3d-red', '#c4142f']]) {
    await page.goto(`${origin}/src/assets/connection/handset-render.html?color=${encodeURIComponent(color)}`)
    await page.waitForFunction(() => document.title === 'rendered')
    await page.locator('canvas').screenshot({ path: `${out}/${name}-after.png`, omitBackground: true })
  }
} finally { await browser.close() }
