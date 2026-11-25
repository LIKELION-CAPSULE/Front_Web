import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { findReviewScenario, reviewPreviewUrl } from './catalog'
import { createReviewTransport, REVIEW_SESSION_ID, REVIEW_USER_ID } from './fixtures'
import { createReviewStorage } from './storage'
import { createReviewImageStage } from './image-stage'

export async function mountReview(root: HTMLElement, id: string | null) {
  if (!id) {
    const { ReviewWorkbench } = await import('./ReviewWorkbench')
    createRoot(root).render(<StrictMode><ReviewWorkbench /></StrictMode>)
    return
  }
  const scenario = findReviewScenario(id)
  if (id !== scenario.id) history.replaceState(null, '', reviewPreviewUrl(scenario))
  window.name = `capsule-ui-review:${scenario.id}`
  document.documentElement.dataset.reviewScenario = scenario.id
  const local = createReviewStorage(), session = createReviewStorage()
  Object.defineProperty(window, 'localStorage', { configurable: true, value: local })
  Object.defineProperty(window, 'sessionStorage', { configurable: true, value: session })
  if (scenario.mateHistory) local.setItem(`capsule-beta-cache:v1:${REVIEW_USER_ID}`, JSON.stringify({
    version: 1, userId: REVIEW_USER_ID, records: [], latestRecordId: null,
    // Reuse the workbench's existing reply; no new character dialogue is authored.
    messages: [201, 202].map(characterId => ({ id: `review-confirmed-${characterId}`, sessionId: String(REVIEW_SESSION_ID), characterId: String(characterId), sender: 'character', text: '좋아, 우리 조금만 더 집중해 보자!', voice: false, delivery: 'confirmed' })),
  }))
  session.setItem('capsule-kakao', JSON.stringify({ state: 'review-state', next: scenario.loginNext ?? '/', redirect: `${location.origin}/oauth/kakao` }))
  if (scenario.id !== 'report-no-target') local.setItem(`capsule-session:${REVIEW_USER_ID}:${REVIEW_SESSION_ID}`, JSON.stringify({ targetSeconds: 1800, focus: scenario.cameraFocus }))
  const recordsScenarios = new Set(['records', 'records-two-mates', 'records-past-empty'])
  const recordsCamOffIds = new Set([9004, 9007])
  const recordsDurationsSec = [1500, 2100, 3000, 2400, 2700, 3600, 1800, 3000, 4500, 2400, 3300, 3900]
  for (const [index, id] of (scenario.reports ?? []).entries()) {
    const focus = scenario.cameraFocus
    if (recordsScenarios.has(scenario.id)) {
      if (recordsCamOffIds.has(id)) {
        local.setItem(`capsule-session:${REVIEW_USER_ID}:${id}`, JSON.stringify({}))
      } else {
        const studySec = recordsDurationsSec[index] ?? 1500
        const focusedSec = Math.round(studySec * 0.92)
        local.setItem(
          `capsule-session:${REVIEW_USER_ID}:${id}`,
          JSON.stringify({ focus: { observedMs: studySec * 1000, focusedMs: focusedSec * 1000, returns: 1 } }),
        )
      }
      continue
    }
    local.setItem(
      `capsule-session:${REVIEW_USER_ID}:${id}`,
      JSON.stringify({
        focus: focus
          ? { observedMs: focus.observedMs * (index + 1), focusedMs: focus.focusedMs * (index + 1), returns: focus.returns }
          : undefined,
      }),
    )
  }
  if (scenario.session !== 'unknown') local.setItem(`capsule-presence:${REVIEW_USER_ID}:${REVIEW_SESSION_ID}`, JSON.stringify({ studySeconds: 65, presentSeconds: 55, known: true }))
  // Install before importing App: ApiClient captures fetch when its singleton is constructed.
  globalThis.fetch = createReviewTransport(scenario, globalThis.fetch.bind(globalThis))
  if (navigator.mediaDevices) Object.defineProperty(navigator.mediaDevices, 'getUserMedia', {
    configurable: true, value: () => Promise.reject(new DOMException('UI review uses no camera or microphone', 'NotAllowedError')),
  })
  // OAuth uses location.assign rather than fetch. Keep it inside the preview as well.
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('a, button') : null
    if ((target instanceof HTMLAnchorElement && target.origin !== location.origin) || target?.matches('button.kakao-button')) {
      event.preventDefault(); event.stopImmediatePropagation()
      parent.postMessage({ type: 'capsule-review:notice', text: '외부 이동은 미리보기에서 실행하지 않아요. 카카오 상태는 왼쪽 목록에서 선택해 주세요.' }, location.origin)
    }
  }, true)
  const [{ mountApp }, { ReviewSetup }, { ReviewStudyGate }] = await Promise.all([
    import('@/app/bootstrap'), import('./ReviewSetup'), import('./ReviewStudyGate'),
  ])
  const accountPort = scenario.accountContract ? (await import('./account-port')).createReviewAccountPort(scenario) : undefined
  const matePort = scenario.mateContract ? (await import('./mate-port')).createReviewMatePort(scenario) : undefined
  const featurePort = (() => {
    const now = Date.now()
    const expiresAt = now + (3 * 3600 + 12 * 60 + 40) * 1000
    const day2 = Date.UTC(2026, 10, 22, 16, 6, 0) // 11/23 01:06 KST
    const day1 = Date.UTC(2026, 10, 21, 20, 0, 0) // 11/22 05:00 KST

    const baseInvitation = {
      code: 'CAP-7K2Q',
      url: 'https://capsule.local/?ref=CAP-7K2Q',
      invitedCount: 3,
      rewardedCredits: 3000,
      canRedeem: true,
    }
    const baseWallet = {
      attendance: 980,
      invitation: 200,
      usedToday: 320,
      attendanceExpiresAt: expiresAt,
      entries: [
        { id: 'r1', at: day2, description: '보이스 대화 · 채린', kind: 'use' as const, change: -20, balance: 1180 },
        { id: 'r2', at: day2 - 600_000, description: '고급 모드 · 채린', kind: 'use' as const, change: -30, balance: 1200 },
        { id: 'r3', at: day2 - 3_600_000, description: '출석', kind: 'attendance' as const, change: 1500, balance: 1700 },
        { id: 'r4', at: day1 + 7_200_000, description: '친구 초대 · 민지님 첫 연결', kind: 'invite' as const, change: 1000, balance: 1200 },
        { id: 'r5', at: day1 + 3_600_000, description: '보이스 대화 · 채린', kind: 'use' as const, change: -20, balance: 200 },
        { id: 'r6', at: day1, description: '출석분 소멸', kind: 'expiration' as const, change: -320, balance: 220 },
      ],
    }

    if (scenario.id === 'connection-record-credit-out') {
      return {
        read: () => ({
          wallet: { attendance: 0, invitation: 0, usedToday: 300, attendanceExpiresAt: expiresAt, entries: [] },
          invitation: { code: 'CAP-REVIEW', url: 'https://capsule.local/?ref=CAP-REVIEW', invitedCount: 0, rewardedCredits: 0, canRedeem: true },
          records: [],
          messages: [],
          affinities: {},
          settings: { voice: false, advanced: false },
        }),
        subscribe: () => () => {},
        redeemInvitation: async () => {},
        setSettings: () => {},
      }
    }
    if (scenario.id === 'credits-filled' || scenario.id === 'invite-filled') {
      return {
        read: () => ({
          wallet: baseWallet,
          invitation: baseInvitation,
          records: [],
          messages: [],
          affinities: {},
          settings: { voice: false, advanced: false },
        }),
        subscribe: () => () => {},
        redeemInvitation: async () => {},
        setSettings: () => {},
      }
    }
    if (scenario.id === 'credits-empty') {
      return {
        read: () => ({
          wallet: { attendance: 1500, invitation: 0, usedToday: 0, attendanceExpiresAt: expiresAt, entries: [] },
          invitation: baseInvitation,
          records: [],
          messages: [],
          affinities: {},
          settings: { voice: false, advanced: false },
        }),
        subscribe: () => () => {},
        redeemInvitation: async () => {},
        setSettings: () => {},
      }
    }
    if (scenario.id === 'invite-full') {
      return {
        read: () => ({
          wallet: baseWallet,
          invitation: {
            code: 'CAP-7K2Q',
            url: 'https://capsule.local/?ref=CAP-7K2Q',
            invitedCount: 10,
            rewardedCredits: 10000,
            canRedeem: false,
          },
          records: [],
          messages: [],
          affinities: {},
          settings: { voice: false, advanced: false },
        }),
        subscribe: () => () => {},
        redeemInvitation: async () => {},
        setSettings: () => {},
      }
    }
    if (scenario.id === 'my-mates-full') {
      const silentWav = (() => {
        const sampleBytes = 32000 // 2 seconds at 8000 Hz, 16-bit mono
        const bytes = new Uint8Array(44 + sampleBytes)
        const view = new DataView(bytes.buffer)
        const text = (at: number, value: string) =>
          [...value].forEach((ch, idx) => view.setUint8(at + idx, ch.charCodeAt(0)))
        text(0, 'RIFF')
        view.setUint32(4, bytes.length - 8, true)
        text(8, 'WAVE')
        text(12, 'fmt ')
        view.setUint32(16, 16, true)
        view.setUint16(20, 1, true)
        view.setUint16(22, 1, true)
        view.setUint32(24, 8000, true)
        view.setUint32(28, 16000, true)
        view.setUint16(32, 2, true)
        view.setUint16(34, 16, true)
        text(36, 'data')
        view.setUint32(40, sampleBytes, true)
        let binary = ''
        for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
        return `data:audio/wav;base64,${btoa(binary)}`
      })()
      const unlockDay1 = Date.UTC(2026, 10, 17, 12, 0, 0)
      const unlockDay2 = Date.UTC(2026, 10, 20, 14, 0, 0)
      return {
        read: () => ({
          wallet: baseWallet,
          invitation: baseInvitation,
          records: [],
          messages: [],
          affinities: {},
          settings: { voice: false, advanced: false },
          mateUnlocks: {
            chaerin: {
              expressions: [
                {
                  id: 'expr-smile',
                  label: '따뜻한 미소',
                  expressionFile: 'files/009.exp3.json',
                  unlocked: true,
                  unlockedAt: unlockDay1,
                },
                {
                  id: 'expr-playful',
                  label: '장난스러운 웃음',
                  expressionFile: 'files/010.exp3.json',
                  unlocked: true,
                  unlockedAt: unlockDay2,
                },
                {
                  id: 'expr-eyes-closed',
                  label: '눈 감고 웃음',
                  expressionFile: 'files/005.exp3.json',
                  unlocked: false,
                  condition: '4단계 · 친한 친구에서 열려요',
                },
                {
                  id: 'expr-surprise',
                  label: '깜짝 놀람',
                  expressionFile: 'files/006.exp3.json',
                  unlocked: false,
                  condition: '5단계 · 단짝에서 열려요',
                },
              ],
              voices: [
                {
                  id: 'voice-1',
                  text: '오늘도 왔네? 기다리고 있었어.',
                  audioUrl: silentWav,
                  unlocked: true,
                },
                {
                  id: 'voice-2',
                  text: '옆에 있으니까 좀 든든하다.',
                  audioUrl: silentWav,
                  unlocked: true,
                },
                {
                  id: 'voice-3',
                  text: '잠깐 기지개 한 번 펴고 갈까?',
                  audioUrl: silentWav,
                  unlocked: true,
                },
                {
                  id: 'voice-4',
                  text: '오늘 하루도 잘 보내고 있어?',
                  audioUrl: silentWav,
                  unlocked: true,
                },
                { id: 'voice-5', text: '', unlocked: false, condition: '4단계 · 친한 친구에서 열려요' },
                { id: 'voice-6', text: '', unlocked: false, condition: '4단계 · 친한 친구에서 열려요' },
                { id: 'voice-7', text: '', unlocked: false, condition: '5단계 · 단짝에서 열려요' },
                { id: 'voice-8', text: '', unlocked: false, condition: '5단계 · 단짝에서 열려요' },
              ],
            },
          },
        }),
        subscribe: () => () => {},
        redeemInvitation: async () => {},
        setSettings: () => {},
      }
    }
    if (scenario.id === 'connection-record-levelup') {
      // The reviewed session opened a new expression, so the level-up card shows its unlock box.
      return {
        read: () => ({
          wallet: baseWallet,
          invitation: baseInvitation,
          records: [],
          messages: [],
          affinities: {},
          settings: { voice: false, advanced: false },
          mateUnlocks: {
            chaerin: {
              expressions: [
                { id: 'expr-eyes-closed', label: '눈 감고 웃음', expressionFile: 'files/005.exp3.json', unlocked: true, unlockedAt: now },
              ],
              voices: [],
            },
          },
        }),
        subscribe: () => () => {},
        redeemInvitation: async () => {},
        setSettings: () => {},
      }
    }
    return undefined
  })()
  // Modal design drafts (review only): drawn over the real page, never imported by the product entry.
  const DialogDesign = scenario.dialogDesign ? (await import('./dialog-design/DialogDesignPreview')).DialogDesignPreview : undefined
  const extra = <>
    <ReviewSetup scenario={scenario} />
    {DialogDesign && scenario.dialogDesign && <DialogDesign variant={scenario.dialogDesign} />}
  </>
  mountApp(root, extra, scenario.session && scenario.session !== 'recover' ? <ReviewStudyGate /> : undefined, createReviewImageStage, accountPort, matePort, featurePort)
}
