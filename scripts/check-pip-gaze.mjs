// Real DOM/window adoption test, with an iframe fallback if Document PiP is unavailable.
/* global document, window, PointerEvent */
import assert from 'node:assert/strict'
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--headless=new'] })
try {
  const page = await browser.newPage()
  await page.goto(process.argv[2] ?? 'http://127.0.0.1:53781')
  const result = await page.evaluate(async () => {
    const { AlivingSessionStage } = await import('/src/features/mate-render/AlivingSessionStage.ts')
    const looks = []
    const player = {
      running: false, raf: 0, last: 0,
      model: { background: [0, 0, 0, 0], draw() {} },
      frame() {}, setView() {}, setExpression() { return true }, talk() { return true },
      lookAt(x, y) { looks.push({ x, y }) }, destroy() {},
    }
    const stage = new AlivingSessionStage({ kind: 'aliving', modelUrl: '/test', engineUrl: '/test', playerUrl: '/test' }, {
      loadScript: async () => {}, getPlayer: () => ({ create: async () => player }),
    })
    const wait = ms => new Promise(resolve => window.setTimeout(resolve, ms))
    await wait(50)
    const host = document.createElement('div')
    host.style.cssText = 'position:fixed;left:0;top:0;width:800px;height:600px'
    document.body.append(host)
    let other, iframe
    let surface = 'Document PiP'
    try { other = await window.documentPictureInPicture.requestWindow({ width: 400, height: 500 }) }
    catch {
      surface = 'iframe window/document fallback'
      iframe = document.createElement('iframe')
      iframe.style.cssText = 'position:fixed;left:0;top:0;width:400px;height:500px'
      iframe.srcdoc = '<body></body>'
      const loaded = new Promise(resolve => { iframe.onload = resolve })
      document.body.append(iframe)
      await loaded
      other = iframe.contentWindow
    }
    const pipHost = other.document.createElement('div')
    pipHost.style.cssText = 'width:320px;height:420px'
    other.document.body.append(pipHost)
    const move = (win, x, y) => win.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: x, clientY: y }))
    stage.attach(host)
    stage.setTracking(true)
    move(window, 800, 0)
    await wait(100)
    const main = looks.at(-1)
    const canvas = host.querySelector('canvas')
    stage.attach(pipHost)
    const entry = looks.at(-1)
    const adopted = canvas === pipHost.querySelector('canvas') && canvas.ownerDocument === other.document
    const count = looks.length
    move(window, 0, 600)
    await wait(50)
    const oldIgnored = count === looks.length
    move(other, 320, 0)
    await wait(100)
    const pip = looks.at(-1)
    pipHost.style.width = '800px'
    await wait(500)
    const resized = looks.at(-1)
    other.dispatchEvent(new Event('blur'))
    await wait(400)
    const blur = looks.at(-1)
    stage.detach(pipHost)
    move(window, 0, 600)
    await wait(100)
    const returned = looks.at(-1)
    stage.destroy()
    const finalCount = looks.length
    move(window, 800, 0); move(other, 320, 0)
    await wait(50)
    const originsDiffer = performance.timeOrigin !== other.performance.timeOrigin
    if (iframe) iframe.remove()
    else other.close()
    host.remove()
    return { surface, main, entry, adopted, oldIgnored, pip, resized, blur, returned, released: finalCount === looks.length, originsDiffer }
  })
  assert.ok(result.main.x > 0)
  assert.deepEqual(result.entry, { x: 0, y: 0 })
  assert.ok(result.adopted && result.oldIgnored && result.released)
  assert.ok(result.pip.x > 0 && result.pip.x <= 0.75 && Number.isFinite(result.pip.y))
  assert.ok(result.resized.x < 0, 'stationary pointer is reprojected after resizing')
  assert.ok(Math.abs(result.blur.x) < Math.abs(result.resized.x))
  assert.ok(result.returned.x < 0)
  assert.ok(result.originsDiffer)
  console.log('ok main → separate window/document → main: canvas adoption, gaze, blur, resize, cleanup', result)
} finally { await browser.close() }
