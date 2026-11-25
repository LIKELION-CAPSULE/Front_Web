// Renders one picture per Chaerin v2 expression: face thumbnails (my-mates expression collection) or, with
// `--bust`, upper-body stills in the exact view of `chaerin-v2-hero.webp` (the still the my-mates panel shows under
// reduced motion, while the model loads and on failure; a picked expression swaps it).
//
// Needs the dev server in local mock mode (it serves the model and engine from `local-assets/` at /__local-assets)
// and Playwright (not a project dependency):
//
//   npx vite --port 5231 --strictPort &
//   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs \
//     node scripts/render-chaerin-expressions.mjs http://127.0.0.1:5231 src/assets/characters/chaerin-v2/expressions
//   PLAYWRIGHT_MODULE=... node scripts/render-chaerin-expressions.mjs http://127.0.0.1:5231 \
//     src/assets/characters/chaerin-v2/expressions-bust --bust
//
// Output: `<name>.webp` (transparent background, 2x) for every v2 expression (plus `neutral.webp` for thumbnails;
// the bust's neutral face is the hero still itself), and `expressions.json` with the engine view. Only rendered
// pictures are written: the model and engine stay local.
/* global document, window, requestAnimationFrame, Image -- page.evaluate bodies run in the browser */
import { mkdirSync, writeFileSync } from 'node:fs'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const args = process.argv.slice(2)
const bust = args.includes('--bust')
const [origin = 'http://127.0.0.1:5231', out = bust ? 'src/assets/characters/chaerin-v2/expressions-bust' : 'src/assets/characters/chaerin-v2/expressions'] =
  args.filter((arg) => !arg.startsWith('--'))
const EXPRESSIONS = bust
  ? ['sulky', 'happy', 'contempt', 'yawn', 'angry', 'laugh', 'shy', 'focus']
  : ['neutral', 'sulky', 'happy', 'contempt', 'yawn', 'angry', 'laugh', 'shy', 'focus']
// Thumbnails: square face crop, model y 118…348 (forehead to chin, eyes at 238; landmarks in aliving-view.ts), 96 CSS
// px at 2x. Bust: the hero still's canvas and view (renders.json `chaerin-v2-hero`: 760×900 at 2x, model y 31…769).
const TOP = bust ? 31 : 118
const BOTTOM = bust ? 769 : 348
const CENTER_X = 640
const SIZE = bust ? [1520, 1800] : [192, 192]
const view = bust
  ? { zoom: 1.9718, cx: CENTER_X, cy: 384.6 }
  : { zoom: Number(((SIZE[0] / (BOTTOM - TOP)) * (1280 / SIZE[0])).toFixed(4)), cx: CENTER_X, cy: (TOP + BOTTOM) / 2 }

mkdirSync(out, { recursive: true })
// `PLAYWRIGHT_CHROMIUM` points at an installed Chromium when Playwright's own download is missing.
const browser = await chromium.launch({ headless: false, executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined })
const page = await (await browser.newContext({ viewport: { width: 400, height: 400 } })).newPage()
await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' })
// The app may redirect (login, onboarding) right after loading: let it settle before taking the page over.
await page.waitForLoadState('networkidle')
await page.waitForTimeout(800)
await page.evaluate(async () => {
  document.body.innerHTML = ''
  for (const src of ['/__local-assets/chaerin-v3/engine/engine.js', '/__local-assets/chaerin-v3/engine/player.js']) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.onload = resolve
      script.onerror = reject
      document.head.append(script)
    })
  }
})

for (const name of EXPRESSIONS) {
  // Several samples a little apart: the one closest to the others is kept, so a blink never ends up in a thumbnail.
  const samples = await page.evaluate(
    async ({ name, size, view }) => {
      const canvas = document.createElement('canvas')
      canvas.width = size[0]
      canvas.height = size[1]
      document.body.append(canvas)
      const player = await window.CapsuleV2Player.create(canvas, '/__local-assets/chaerin-v3/model/model.json', {
        reactions: '/__local-assets/chaerin-v3/engine/reactions.default.json',
        idle: false,
        zoom: view.zoom,
        cx: view.cx,
        cy: view.cy,
      })
      player.model.background = [0, 0, 0, 0]
      player.setView(view.zoom, view.cx, view.cy)
      player.lookAt(0, 0)
      if (name !== 'neutral') player.setExpression(name)
      const frames = (ms) =>
        new Promise((resolve) => {
          const until = performance.now() + ms
          const tick = (now) => {
            player.frame(now)
            if (now < until) requestAnimationFrame(tick)
            else resolve()
          }
          requestAnimationFrame(tick)
        })
      await frames(1200)
      const shots = []
      for (let index = 0; index < 5; index++) {
        await frames(220)
        player.frame(performance.now())
        shots.push(canvas.toDataURL('image/webp', size[0] > 512 ? 0.86 : 0.92))
      }
      player.destroy()
      canvas.remove()
      return shots
    },
    { name, size: SIZE, view },
  )
  const pixels = await page.evaluate(async (urls) => {
    const read = async (url) => {
      const image = new Image()
      image.src = url
      await image.decode()
      // Compared at most 256 px wide (the bust stills are big).
      const scale = Math.min(1, 256 / image.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(image.width * scale)
      canvas.height = Math.round(image.height * scale)
      const context = canvas.getContext('2d')
      context.drawImage(image, 0, 0, canvas.width, canvas.height)
      return Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data)
    }
    return Promise.all(urls.map(read))
  }, samples)
  const distance = (a, b) => {
    let sum = 0
    for (let index = 0; index < a.length; index += 4) sum += Math.abs(a[index] - b[index]) + Math.abs(a[index + 3] - b[index + 3])
    return sum
  }
  let best = 0
  let bestScore = Infinity
  for (let index = 0; index < pixels.length; index++) {
    const score = pixels.reduce((total, other, otherIndex) => total + (otherIndex === index ? 0 : distance(pixels[index], other)), 0)
    if (score < bestScore) {
      bestScore = score
      best = index
    }
  }
  writeFileSync(`${out}/${name}.webp`, Buffer.from(samples[best].split(',')[1], 'base64'))
  console.log(`${name}.webp (sample ${best + 1}/${samples.length})`)
}

writeFileSync(
  `${out}/expressions.json`,
  `${JSON.stringify({ size: SIZE, view, framing: `model y ${TOP}..${BOTTOM}`, expressions: EXPRESSIONS }, null, 1)}\n`,
)
await browser.close()
