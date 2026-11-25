import { ApiError } from '../../shared/api/client.ts'

/**
 * Credit shortages in a conversation (docs/API_FRONT_GAP_2026-11-25.md §5):
 * - 고급 모드 short of credits: 20 · 28 answer 409 `CREDIT_INSUFFICIENT` (`detail.credits`); nothing was sent, so the
 *   line can go again in 기본 모드 (no credits).
 * - a voice reply short of credits: no error, the reply comes as text (`done.voice` false); said once, briefly.
 */
export function creditShortage(reason: unknown): { credits: number | null } | null {
  if (!(reason instanceof ApiError) || reason.code !== 'CREDIT_INSUFFICIENT') return null
  const credits = reason.detail?.credits
  const remaining = typeof credits === 'number' && Number.isFinite(credits)
    ? credits
    : credits && typeof credits === 'object' && typeof (credits as { todayRemaining?: unknown }).todayRemaining === 'number'
      ? (credits as { todayRemaining: number }).todayRemaining
      : null
  return { credits: remaining }
}

/**
 * The voice-fallback note: only when a voice reply was asked for (`tts: true`, voice-reply.ts `voiceRequested`) and
 * came as text (`done.voice` false: credits short), and only the first time in a call.
 */
export function shouldNoteVoiceFallback(input: { requestedVoice: boolean; voice: boolean | undefined; noted: boolean }) {
  return input.requestedVoice && input.voice === false && !input.noted
}

export const CREDIT_NOTICE_COPY = {
  title: '크레딧이 부족해요',
  body: '고급 대화를 하기엔 오늘 남은 크레딧이 모자라요. 기본 모드는 크레딧 없이 대화할 수 있어요.',
  remaining: (credits: number) => `남은 크레딧 ${credits.toLocaleString('ko-KR')}`,
  basic: '기본 모드로 계속',
  invite: '친구 초대로 받기',
  voiceFallback: '크레딧이 모자라 이번 답장은 글로만 보여 드려요.',
} as const
