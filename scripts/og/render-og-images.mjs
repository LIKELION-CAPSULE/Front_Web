// Renders the link-preview images (1200×630 JPEG) from scripts/og/og-card.html into public/og/:
//   og-default.jpg  — every page (index.html og:image)
//   og-invite.jpg   — invite links /i/<code> (server/og-meta.ts), the same card with the 「친구 초대」 badge
//
// Needs Playwright (not a project dependency) and no dev server: the template only uses repository files.
//
//   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs \
//   PLAYWRIGHT_CHROMIUM=<installed Chromium, optional> \
//     node scripts/og/render-og-images.mjs
//
// Prints each file with its size; aims for about 300 KB (KakaoTalk and most scrapers take up to a few MB).
/* global window, document -- page.addInitScript / waitForFunction bodies run in the browser */
import { mkdir, stat } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PIXEL_ART, pixelArtSize, pixelArtUrl } from '../../src/shared/ui/pixel/pixel-art.ts'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const template = pathToFileURL(fileURLToPath(new URL('./og-card.html', import.meta.url)))
const outDir = fileURLToPath(new URL('../../public/og/', import.meta.url))
const QUALITY = Number(process.env.OG_JPEG_QUALITY) || 90

const pixels = Object.fromEntries(['capsule', 'coin'].map(name => {
  const art = PIXEL_ART[name]
  const { width, height } = pixelArtSize(art, 1)
  return [name, { width, height, url: pixelArtUrl(art) }]
}))

await mkdir(outDir, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--headless=new', '--allow-file-access-from-files'] })
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await page.addInitScript(value => { window.OG_PIXELS = value }, pixels)
  for (const [variant, file] of [['default', 'og-default.jpg'], ['invite', 'og-invite.jpg']]) {
    const url = new URL(template)
    url.searchParams.set('variant', variant)
    await page.goto(url.href, { waitUntil: 'load' })
    await page.waitForSelector('body[data-ready="true"]')
    await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0))
    const path = `${outDir}${file}`
    await page.screenshot({ path, type: 'jpeg', quality: QUALITY, clip: { x: 0, y: 0, width: 1200, height: 630 } })
    console.log(`${file}  ${Math.round((await stat(path)).size / 1024)} KB`)
  }
} finally {
  await browser.close()
}
