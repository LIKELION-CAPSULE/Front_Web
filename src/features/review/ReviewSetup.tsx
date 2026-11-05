import { useEffect, useRef } from 'react'
import { useBackend } from '@/features/backend/backend-context'
import { useDemo } from '@/features/demo/demo-context'
import { createDemoState } from '@/features/demo/seed'
import { studyRooms } from '@/features/rooms/data/rooms'
import { setServerRooms } from '@/features/rooms/services/room-service'
import { getCharacterArtwork } from '@/features/characters/artwork'
import { getRoomArtwork } from '@/features/rooms/artwork'
import { roomPosters } from '@/features/rooms/posters'
import type { ReviewScenario, ReviewStep } from './catalog'
import { captureReviewMessages } from './capture-messages'

function findTarget(step: ReviewStep): HTMLElement | null {
  if ('fill' in step) return document.querySelector<HTMLElement>(step.fill)
  const selector = 'selector' in step && step.selector ? step.selector : 'click' in step ? 'button, a, summary' : 'h1, h2, [role="status"]'
  return [...document.querySelectorAll<HTMLElement>(selector)].find(element => {
    if (!element.getClientRects().length || element.matches(':disabled')) return false
    const text = (element.getAttribute('aria-label') || element.textContent)?.replace(/\s+/g, ' ').trim() ?? ''
    const expected = 'click' in step ? step.click : step.wait
    return !expected || ('includes' in step && step.includes ? text.includes(expected) : text === expected)
  }) ?? null
}

function waitForScreen(loading?: string) {
  return new Promise<void>((resolve, reject) => {
    const check = () => loading ? !!document.querySelector(`[data-loading-screen="${loading}"]`) : !document.querySelector('[data-loading-screen], [data-account-loading]') && !!document.querySelector('main, [role="alert"]')
    if (check()) { resolve(); return }
    const timeout = setTimeout(() => { clearInterval(timer); reject(new Error('화면을 아직 준비하지 못했어요. 상태 초기화를 눌러 다시 열어 주세요.')) }, 12_000)
    const timer = setInterval(() => {
      if (check()) { clearTimeout(timeout); clearInterval(timer); resolve() }
    }, 50)
  })
}

async function runStep(step: ReviewStep) {
  const element = await new Promise<HTMLElement>((resolve, reject) => {
    const existing = findTarget(step)
    if (existing) { resolve(existing); return }
    const timeout = setTimeout(() => { observer.disconnect(); reject(new Error(`조작할 요소를 찾지 못했어요: ${JSON.stringify(step)}`)) }, 12_000)
    const observer = new MutationObserver(() => {
      const target = findTarget(step)
      if (target) { clearTimeout(timeout); observer.disconnect(); resolve(target) }
    })
    observer.observe(document.body, { subtree: true, childList: true, attributes: true })
  })
  if ('fill' in step) {
    const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
    Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(element, step.value)
    element.dispatchEvent(new Event('input', { bubbles: true }))
    element.dispatchEvent(new Event('change', { bubbles: true }))
  } else if ('click' in step) element.click()
  await new Promise(resolve => setTimeout(resolve, 80))
}

export function ReviewSetup({ scenario }: { scenario: ReviewScenario }) {
  const { status, resumeSession } = useBackend()
  const { state, dispatch } = useDemo()
  const initialized = useRef(false)
  useEffect(() => {
    if (initialized.current || (status === 'loading' && !scenario.loading)) return
    initialized.current = true
    const run = async () => {
      if (scenario.draft) {
        setServerRooms(studyRooms.map(room => ({ ...room, coverUrl: roomPosters[getRoomArtwork(room.id).tone],
          characters: room.characters.map(character => ({ ...character, avatarUrl: getCharacterArtwork(character.id).study })) })))
        const sample = createDemoState()
        dispatch({ type: 'SERVER_SYNC', patch: { ...sample, profile: { ...sample.profile, name: '검토하는 나', loggedIn: true, onboarded: true }, ...(scenario.empty ? { records: [] } : {}) } })
      }
      if (scenario.session && scenario.session !== 'recover') {
        await resumeSession('9001')
        if (scenario.session === 'break') dispatch({ type: 'TAKE_BREAK', now: Date.now() })
        await new Promise(resolve => setTimeout(resolve, 160))
      }
      await waitForScreen(scenario.loading)
      for (const step of scenario.steps ?? []) await runStep(step)
      await new Promise(resolve => setTimeout(resolve, scenario.fault === 'verification-expired' ? 1200 : 200))
      await waitForScreen(scenario.loading)
      document.body.dataset.reviewReady = scenario.id
      parent.postMessage({ type: 'capsule-review:ready', id: scenario.id }, location.origin)
    }
    void run().catch(error => {
      parent.postMessage({ type: 'capsule-review:notice', text: error instanceof Error ? error.message : '자동 준비를 마치지 못했어요. 화면에서 직접 조작할 수 있어요.' }, location.origin)
    })
  }, [status, resumeSession, dispatch, scenario])

  useEffect(() => {
    let last = ''
    const capture = () => {
      const lines = document.body.innerText.split(/\n+/).map(text => text.trim()).filter(Boolean)
      const labels = [...document.querySelectorAll<HTMLElement>('[aria-label], [placeholder], img[alt]')]
        .filter(element => element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden')
        .flatMap(element => ['aria-label', 'placeholder', 'alt'].map(name => element.getAttribute(name) ?? '').filter(Boolean))
      const texts = [...new Set([...lines, ...labels])]
      const messages = captureReviewMessages(document)
      const serialized = JSON.stringify([texts, messages])
      if (serialized === last) return
      last = serialized
      parent.postMessage({ type: 'capsule-review:copy', texts, messages, path: location.pathname + location.search + location.hash }, location.origin)
    }
    capture()
    const timer = window.setInterval(capture, 750)
    return () => clearInterval(timer)
  }, [])
  // The real contexts are intentionally used; no placeholder page replaces product UI.
  return <span hidden data-review-profile={state.profile.loggedIn ? 'member' : 'guest'} />
}
