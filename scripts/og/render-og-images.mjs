// Renders the link-preview images (1200×630 JPEG) from scripts/og/og-card.html into public/og/:
//   og-default.jpg  — every page (index.html og:image)
//   og-invite.jpg   — invite links /i/<code> (server/og-meta.ts), the same card with 「친구 초대」 and the reward line
//
// The scene on the left (dozing Chaerin, laptop with the CAPSULE logo, mug, desk) is not redrawn here: it is captured
// from the real login screen (DozeMateStage / DozeDesk), so lid perspective, logo keystone and props stay identical to
// it. Step 1 opens the login page of a running dev server with reduced motion (the still path: no Live2D, no nod, no
// heatmap shader), widens the stage to the whole viewport, hides everything but the stage and drops its UI (the
// 「깨워 보세요」 bubble, buttons), and screenshots the stage with a transparent background twice: the scene without the
// 「z z Z」, then the 「z z Z」 alone (the still staircase of reduced motion, same shape, place and size as on the login
// screen). Step 2 places the scene on the card (og-card.html) over the blurred room, and the 「z z Z」 above the card's
// scrim so they keep the login screen's white and halo, with the copy on the right.
//
// Needs Playwright (not a project dependency) and the dev server (mock data is enough):
//
//   npm run dev                                   # http://localhost:3000, VITE_DATA_SOURCE=mock (the default)
//   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs \
//   PLAYWRIGHT_CHROMIUM=<installed Chromium, optional> \
//   OG_LOGIN_URL=http://localhost:3000/login \    # optional, this is the default
//     node scripts/og/render-og-images.mjs
//
// Prints each file with its size; aims for about 300 KB (KakaoTalk and most scrapers take up to a few MB).
/* global window, document, requestAnimationFrame -- page.addInitScript / evaluate / waitForFunction bodies run in the browser */
import { mkdir, stat } from 'node:fs/promises'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { PIXEL_ART, pixelArtSize, pixelArtUrl } from '../../src/shared/ui/pixel/pixel-art.ts'
import { computeDozeScene } from '../../src/features/auth/login-variants/doze/doze-view.ts'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const template = pathToFileURL(fileURLToPath(new URL('./og-card.html', import.meta.url)))
const outDir = fileURLToPath(new URL('../../public/og/', import.meta.url))
const loginUrl = process.env.OG_LOGIN_URL || 'http://localhost:3000/login'
const QUALITY = Number(process.env.OG_JPEG_QUALITY) || 90

/**
 * Stage size of the capture (CSS px). The height sets the login framing's scale (doze-view.ts computeDozeCamera):
 * 665 px gives k ≈ 0.75, about the old card's size, so the scene lands 1:1 on the card. The width only has to keep the
 * desk running past both card edges and the stage's right-edge fade (doze.css .doze-stage-mask, 120 px) off the card.
 * Rendered at 2 device px per CSS px; the card shows it at 1:1 CSS px, so the JPEG gets a supersampled picture.
 */
const SCENE = { width: 2000, height: 665, scale: 2 }
/** Where her centre line and the desk top land on the 1200×630 card (copy starts at x 690). */
const CARD = { mateCx: 335, deskTop: 552 }

/** Style toggles for the two shots of the stage: the scene without the 「z z Z」, then the 「z z Z」 alone. */
const SCENE_ONLY = '.doze-zz { visibility: hidden !important; }'
const ZZ_ONLY = '.doze-stage-root * { visibility: hidden !important; } .doze-stage-root .doze-zz, .doze-stage-root .doze-zz * { visibility: visible !important; }'

const pixels = Object.fromEntries(['capsule', 'coin'].map(name => {
  const art = PIXEL_ART[name]
  const { width, height } = pixelArtSize(art, 1)
  return [name, { width, height, url: pixelArtUrl(art) }]
}))

await mkdir(outDir, { recursive: true })
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--headless=new', '--allow-file-access-from-files'] })
try {
  const scene = await captureLoginScene()
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })
  await page.addInitScript(value => { window.OG_PIXELS = value.pixels; window.OG_SCENE = value.scene }, { pixels, scene })
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

/** Screenshots of the login stage (transparent background): the scene and the 「z z Z」, and where they go on the card. */
async function captureLoginScene() {
  const page = await browser.newPage({
    viewport: { width: SCENE.width, height: SCENE.height },
    deviceScaleFactor: SCENE.scale,
    reducedMotion: 'reduce',
  })
  try {
    await page.goto(loginUrl, { waitUntil: 'networkidle' })
    await page.waitForSelector('.doze-stage-root[data-doze-mode="static"] .doze-lid-icon', { timeout: 20000 })
    await page.addStyleTag({
      content: `
        html, body, #root, .login-variant-root { background: transparent !important; }
        .login-variant-root { --login-stage-right: 0px !important; }
        .doze-call, .doze-hit, .doze-replay-btn, .doze-stage-root .sr-only { display: none !important; }
        * { transition: none !important; animation: none !important; }
      `,
    })
    // Everything outside the stage (room picture, scrim, caption chips, dialogue, form panel, settings) goes.
    await page.evaluate(() => {
      for (let node = document.querySelector('.doze-stage-root'); node && node !== document.body; node = node.parentElement) {
        for (const sibling of node.parentElement?.children ?? []) {
          if (sibling !== node) sibling.style.setProperty('visibility', 'hidden', 'important')
        }
      }
    })
    // The stage re-lays itself out for the new width (ResizeObserver): wait for it and for every picture in it.
    const expected = computeDozeScene(SCENE.width, SCENE.height)
    await page.waitForFunction(
      cx => Math.abs(Number(document.querySelector('.doze-stage-root')?.dataset.mateCx) - cx) < 0.5,
      expected.mate.cx,
      { timeout: 10000 },
    )
    await page.evaluate(async () => {
      const root = document.querySelector('.doze-stage-root')
      await Promise.all([...root.querySelectorAll('img')].map(image => image.decode().catch(() => {})))
      await document.fonts.ready
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)))
    })
    const box = await page.locator('.doze-stage-root').boundingBox()
    if (!box || Math.round(box.width) !== SCENE.width || Math.round(box.height) !== SCENE.height) {
      throw new Error(`login stage is ${box?.width}×${box?.height}, expected ${SCENE.width}×${SCENE.height} (layout changed?)`)
    }
    const stage = page.locator('.doze-stage-root')
    const shoot = async css => {
      const toggle = await page.addStyleTag({ content: css })
      const png = await stage.screenshot({ type: 'png', omitBackground: true })
      await toggle.evaluate(node => node.remove())
      return `data:image/png;base64,${png.toString('base64')}`
    }
    return {
      url: await shoot(SCENE_ONLY),
      zzUrl: await shoot(ZZ_ONLY),
      width: SCENE.width,
      height: SCENE.height,
      left: CARD.mateCx - expected.mate.cx,
      top: CARD.deskTop - expected.deskTop,
    }
  } finally {
    await page.close()
  }
}
