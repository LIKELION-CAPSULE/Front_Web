// Regression check for the collectible record card of a capsule (CapsuleRecordCard): its 「연결 기록 보기」 link,
// 「닫기」 and the day pager must take real clicks, Enter and Space — also while the card is tilted under the pointer
// (the 3D card once let its empty wrapper catch the clicks) and under reduced motion. Opens the card from the
// my-mates recent list and from the records board (「함께 쌓은 시간」): by keyboard (the board's day list, Enter) and by
// a real click on the day's column in the WebGL scene, in 2.5D and in 2D.
//
// Needs the dev server in local mock mode and Playwright (not a project dependency):
//
//   npx vite --port 5231 --strictPort &
//   PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs \
//   PLAYWRIGHT_CHROMIUM=<installed Chromium, optional> \
//     node scripts/check-capsule-record-card.mjs http://127.0.0.1:5231
//
// Prints one line per check and exits with 1 when any fails.
/* global document -- page.evaluate bodies run in the browser */

import { startWatchdog, warmUpDevServer } from './lib/browser-check-guard.mjs'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const [origin = 'http://127.0.0.1:5231'] = process.argv.slice(2)
const watchdog = startWatchdog('check-capsule-record-card')
const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM || undefined, args: ['--headless=new'] })
const failures = []
const check = (name, ok, detail = '') => {
  watchdog.step(name)
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`)
  if (!ok) failures.push(name)
}
const openCount = (page) => page.locator('dialog[open]').count()
const topElementAt = (page, x, y) =>
  page.evaluate(([px, py]) => {
    const element = document.elementFromPoint(px, py)
    const control = element?.closest('button, a')
    return control ? `${control.tagName}.${control.className}` : `${element?.tagName}.${element?.className}`
  }, [x, y])
const centre = (box) => [box.x + box.width / 2, box.y + box.height / 2]

async function openFromRecentList(page) {
  await page.locator('.mate-game-slot').first().click()
  await page.waitForSelector('dialog[open] .capsule-jar-card-close', { timeout: 6000 })
  await page.waitForTimeout(1400) // the arrival
}

async function myMates({ reducedMotion }) {
  const label = reducedMotion ? 'reduced motion' : 'motion'
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, reducedMotion: reducedMotion ? 'reduce' : 'no-preference' })
  const page = await context.newPage()
  await page.goto(`${origin}/mates/me`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(4000)

  // Pointer: tilt the card from each corner, then the controls must be the top element under the pointer and click.
  await openFromRecentList(page)
  const card = await page.locator('.record-holo-stage').boundingBox()
  for (const [fx, fy] of [[0.12, 0.15], [0.88, 0.15], [0.12, 0.9], [0.88, 0.9], [0.5, 0.5]]) {
    await page.mouse.move(card.x + card.width * fx, card.y + card.height * fy, { steps: 4 })
    await page.waitForTimeout(250)
    for (const selector of ['.capsule-jar-card-close', '.capsule-jar-card-link']) {
      const box = await page.locator(selector).boundingBox()
      const [x, y] = centre(box)
      await page.mouse.move(x, y, { steps: 2 })
      await page.waitForTimeout(150)
      const top = await topElementAt(page, x, y)
      check(`${label}: ${selector} is on top after tilting from (${fx}, ${fy})`, top.includes(selector.slice(1)), top)
    }
  }
  const [cx, cy] = centre(await page.locator('.capsule-jar-card-close').boundingBox())
  await page.mouse.click(cx, cy)
  await page.waitForTimeout(500)
  check(`${label}: clicking 닫기 closes the card`, (await openCount(page)) === 0)

  // Keyboard: Enter and Space on 닫기 (it has the focus first).
  for (const key of ['Enter', 'Space']) {
    await openFromRecentList(page)
    const focused = await page.evaluate(() => document.activeElement?.className ?? '')
    check(`${label}: 닫기 has the focus when the card opens`, focused.includes('capsule-jar-card-close'), focused)
    await page.keyboard.press(key)
    await page.waitForTimeout(500)
    check(`${label}: ${key} on 닫기 closes the card`, (await openCount(page)) === 0)
  }

  // The link, by click (tilted) and by Enter.
  await openFromRecentList(page)
  const link = await page.locator('.capsule-jar-card-link').boundingBox()
  await page.mouse.move(card.x + card.width * 0.85, card.y + card.height * 0.2, { steps: 3 })
  await page.mouse.click(...centre(link))
  await page.waitForTimeout(800)
  check(`${label}: clicking 연결 기록 보기 opens the connection record`, page.url().includes('/connections/'), page.url())
  await page.goto(`${origin}/mates/me`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(3000)
  await openFromRecentList(page)
  await page.keyboard.press('Shift+Tab')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(800)
  check(`${label}: Enter on 연결 기록 보기 opens the connection record`, page.url().includes('/connections/'), page.url())
  await context.close()
}

async function recordsCalendar() {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  await page.goto(`${origin}/records`, { waitUntil: 'networkidle' })
  await page.waitForTimeout(1500)
  // The local dummy tool's 「밤에 주로 만남」 pattern has days with two connections, so the card shows its pager.
  const toggle = page.locator('.local-demo-icon-toggle')
  if (await toggle.count()) {
    await toggle.click()
    await page.getByLabel('더미 기록 패턴').selectOption('night')
    await page.waitForTimeout(1500)
    await page.locator('.local-demo-toggle').click()
  }
  await page.waitForTimeout(1500)
  // Days with records (their accessible names carry the time); prefer one with two connections (the pager).
  const labels = await page.locator('[data-board-day]').evaluateAll((buttons) =>
    buttons.map((button) => [button.getAttribute('data-board-day'), button.getAttribute('aria-label') ?? '']),
  )
  const withRecords = labels.filter(([, label]) => label.includes('함께한 시간'))
  const target = (withRecords.find(([, label]) => / 2회/.test(label)) ?? withRecords[withRecords.length - 1])?.[0]
  let opened = false
  if (target) {
    // Keyboard: the day's button in the board's list, Enter.
    await page.locator(`[data-board-day="${target}"]`).focus()
    await page.keyboard.press('Enter')
    await page.waitForTimeout(500)
    check('records: Enter on a board day opens the card', (await openCount(page)) > 0)
    await page.keyboard.press('Escape')
    await page.waitForTimeout(600)
    for (const view of ['2d', '25d']) {
      await page.locator(`[data-board-view="${view}"]`).click()
      await page.waitForTimeout(1200)
      // Pointer: click the day where the scene draws it (just under its tooltip).
      await page.locator(`[data-board-day="${target}"]`).focus()
      await page.waitForTimeout(300)
      const tip = await page.locator('.capsule-board-tooltip').boundingBox()
      await page.locator(`[data-board-day="${target}"]`).blur()
      if (!tip) continue
      await page.mouse.click(tip.x + tip.width / 2, tip.y + tip.height + (view === '2d' ? 26 : 22))
      await page.waitForTimeout(500)
      opened = (await openCount(page)) > 0
      check(`records: clicking the day on the ${view === '2d' ? '2D' : '2.5D'} board opens the card`, opened)
      if (view === '2d' && opened) {
        await page.keyboard.press('Escape')
        await page.waitForTimeout(600)
        opened = false
      }
    }
  }
  check('records: a day with records opens the card', opened)
  if (!opened) return context.close()
  await page.waitForTimeout(1400)
  const card = await page.locator('.record-holo-stage').boundingBox()
  await page.mouse.move(card.x + card.width * 0.85, card.y + card.height * 0.85, { steps: 4 })
  await page.waitForTimeout(250)
  const pagerNext = page.locator('.capsule-jar-card-pager button').last()
  if (await pagerNext.count()) {
    const before = await page.locator('.capsule-jar-card-pager [aria-live]').textContent()
    if (await pagerNext.isEnabled()) {
      await page.mouse.click(...centre(await pagerNext.boundingBox()))
      await page.waitForTimeout(300)
      const after = await page.locator('.capsule-jar-card-pager [aria-live]').textContent()
      check('records: the day pager takes a click', before !== after, `${before} → ${after}`)
      await page.keyboard.press('Shift+Tab')
      await page.keyboard.press('Shift+Tab')
      const focused = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') ?? '')
      if (focused.includes('이전')) {
        await page.keyboard.press('Enter')
        await page.waitForTimeout(300)
        const back = await page.locator('.capsule-jar-card-pager [aria-live]').textContent()
        check('records: Enter on the pager goes back', back === before, `${after} → ${back}`)
      }
    }
  } else console.log('skip records: no day with several connections (pager not shown)')
  const [cx, cy] = centre(await page.locator('.capsule-jar-card-close').boundingBox())
  const top = await topElementAt(page, cx, cy)
  check('records: 닫기 is on top while tilted', top.includes('capsule-jar-card-close'), top)
  await page.mouse.click(cx, cy)
  await page.waitForTimeout(500)
  check('records: clicking 닫기 closes the card', (await openCount(page)) === 0)
  await context.close()
}

watchdog.step('warm-up')
await warmUpDevServer(browser, origin, ['/mates/me', '/records'])
watchdog.step('my mates (motion)')
await myMates({ reducedMotion: false })
watchdog.step('my mates (reduced motion)')
await myMates({ reducedMotion: true })
watchdog.step('records calendar')
await recordsCalendar()
await browser.close()
watchdog.stop()
console.log(failures.length ? `\n${failures.length} check(s) failed` : '\nall checks passed')
process.exit(failures.length ? 1 : 0)
