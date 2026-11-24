// Renders a v2 (Aliving2D) mate's still images from its real model with the app's own v2 player, in the exact engine
// views of 채린's stills (src/assets/characters/chaerin-v2/renders.json), so every mate's stills, face thumbnails and
// expression busts line up with the live model through the same framing code (aliving-view.ts `CHAERIN_V2_RENDERS`).
// Only rendered pictures are written: the model and engine stay in local-assets/ (never in the repository).
//
// Needs the dev server in local mock mode (it serves local-assets/<mate>/ at /__local-assets/<mate>/) and Playwright
// (not a project dependency):
//
//   npx vite --port 5231 --strictPort &
//   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs PLAYWRIGHT_CHROMIUM=<Chromium, optional> \
//     node scripts/render-mate-stills.mjs http://127.0.0.1:5231 seojin src/assets/characters/seojin
//
// Writes into <out>:
//   <mate>-hero.webp, <mate>-card.webp, <mate>-avatar.webp, <mate>-full.webp, renders.json   (still images)
//   expressions/<name>.webp + expressions.json            face thumbnails (192×192), as 채린's expressions/
//   expressions-bust/<name>.webp + expressions.json       upper bodies in the hero view, as 채린's expressions-bust/
// `--only stills|expressions|bust` renders one group. Each picture keeps the most typical of five samples taken a
// little apart, so a blink never ends up in a still.
/* global document, window, requestAnimationFrame, Image -- page.evaluate bodies run in the browser */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const args = process.argv.slice(2)
const onlyIndex = args.indexOf('--only')
const only = onlyIndex >= 0 ? args[onlyIndex + 1] : null
const [origin = 'http://127.0.0.1:5231', mate = 'seojin', out = `src/assets/characters/${mate}`] =
  args.filter((arg, index) => !arg.startsWith('--') && index !== onlyIndex + 1)
const base = `/__local-assets/${mate}`
const EXPRESSIONS = ['sulky', 'happy', 'contempt', 'yawn', 'angry', 'laugh', 'shy', 'focus']
// 채린's still views are the reference for every mate (same 1280×1280 model canvas).
const reference = JSON.parse(readFileSync(new URL('../src/assets/characters/chaerin-v2/renders.json', import.meta.url), 'utf8'))
const still = (key) => reference[`chaerin-v2-${key}`]
const thumbnailView = { zoom: Number(((192 / (348 - 118)) * (1280 / 192)).toFixed(4)), cx: 640, cy: (118 + 348) / 2 }

const jobs = []
if (!only || only === 'stills') {
  for (const key of ['hero', 'card', 'avatar', 'full']) {
    jobs.push({ file: `${out}/${mate}-${key}.webp`, size: still(key).size, view: still(key).view, expression: null })
  }
}
if (!only || only === 'expressions') {
  for (const name of ['neutral', ...EXPRESSIONS]) {
    jobs.push({ file: `${out}/expressions/${name}.webp`, size: [192, 192], view: thumbnailView, expression: name === 'neutral' ? null : name })
  }
}
if (!only || only === 'bust') {
  for (const name of EXPRESSIONS) {
    jobs.push({ file: `${out}/expressions-bust/${name}.webp`, size: still('hero').size, view: still('hero').view, expression: name })
  }
}

const browser = await chromium.launch({ args: ['--headless=new'], executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined })
const page = await (await browser.newContext({ viewport: { width: 400, height: 400 } })).newPage()
await page.goto(`${origin}/`, { waitUntil: 'domcontentloaded' })
await page.waitForLoadState('networkidle')
await page.waitForTimeout(800)
await page.evaluate(async (base) => {
  document.body.innerHTML = ''
  for (const src of [`${base}/engine/engine.js`, `${base}/engine/player.js`]) {
    await new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.onload = resolve
      script.onerror = reject
      document.head.append(script)
    })
  }
}, base)

for (const job of jobs) {
  const samples = await page.evaluate(
    async ({ base, job }) => {
      const canvas = document.createElement('canvas')
      canvas.width = job.size[0]
      canvas.height = job.size[1]
      document.body.append(canvas)
      const player = await window.CapsuleV2Player.create(canvas, `${base}/model/model.json`, {
        reactions: `${base}/engine/reactions.default.json`,
        idle: false,
        zoom: job.view.zoom,
        cx: job.view.cx,
        cy: job.view.cy,
      })
      player.model.background = [0, 0, 0, 0]
      player.setView(job.view.zoom, job.view.cx, job.view.cy)
      player.lookAt(0, 0)
      if (job.expression) player.setExpression(job.expression)
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
        shots.push(canvas.toDataURL('image/webp', job.size[0] > 512 ? 0.86 : 0.92))
      }
      player.destroy()
      canvas.remove()
      return shots
    },
    { base, job },
  )
  const pixels = await page.evaluate(async (urls) => {
    const read = async (url) => {
      const image = new Image()
      image.src = url
      await image.decode()
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
  mkdirSync(job.file.slice(0, job.file.lastIndexOf('/')), { recursive: true })
  writeFileSync(job.file, Buffer.from(samples[best].split(',')[1], 'base64'))
  console.log(`${job.file} (sample ${best + 1}/${samples.length})`)
}

if (!only || only === 'stills') {
  const renders = Object.fromEntries(['hero', 'card', 'avatar', 'full'].map((key) => [`${mate}-${key}`, still(key)]))
  writeFileSync(`${out}/renders.json`, `${JSON.stringify(renders, null, 1)}\n`)
}
if (!only || only === 'expressions') {
  writeFileSync(`${out}/expressions/expressions.json`, `${JSON.stringify({ size: [192, 192], view: thumbnailView, framing: 'model y 118..348', expressions: ['neutral', ...EXPRESSIONS] }, null, 1)}\n`)
}
if (!only || only === 'bust') {
  writeFileSync(`${out}/expressions-bust/expressions.json`, `${JSON.stringify({ size: still('hero').size, view: still('hero').view, framing: still('hero').framing, expressions: EXPRESSIONS }, null, 1)}\n`)
}
await browser.close()
