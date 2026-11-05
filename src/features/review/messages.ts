export type ReviewMessageTone = 'error' | 'success' | 'warning' | 'loading' | 'empty' | 'info'
export type ReviewLiveMessage = { text: string; tone: ReviewMessageTone }
export type ReviewMessageEntry = { id: string; text: string; file: string; line: number; kind: string; statusTone?: ReviewMessageTone; symbol?: string }

export const reviewMessageTones: Record<ReviewMessageTone, { label: string; icon: string }> = {
  error: { label: '오류', icon: '×' }, success: { label: '완료', icon: '✓' }, warning: { label: '주의', icon: '!' },
  loading: { label: '로딩', icon: '◌' }, empty: { label: '빈 상태', icon: '○' }, info: { label: '안내', icon: 'i' },
}

/** Links are exact only when the existing preset reproduces that source condition. */
export function messagePreview(entry: ReviewMessageEntry): { id: string; exact: boolean } | null {
  const notices: Record<string, string> = {
    'account-withdrawn': 'withdraw-done', 'kakao-cancelled': 'kakao-cancelled',
    'kakao-expired': 'kakao-failed', 'kakao-invalid-request': 'kakao-invalid', 'kakao-terms-required': 'kakao-terms', 'kakao-failed': 'kakao-error',
  }
  const errors: Record<string, string> = { INVALID_CREDENTIALS: 'login-error', LOGIN_LOCKED: 'login-locked', INVALID_CODE: 'verification-wrong' }
  if (entry.file.endsWith('auth-notices.ts') && entry.symbol && notices[entry.symbol]) return { id: notices[entry.symbol]!, exact: true }
  if (entry.file.endsWith('/api/client.ts') && entry.symbol && errors[entry.symbol]) return { id: errors[entry.symbol]!, exact: true }
  if (entry.file.endsWith('email-validation.ts')) return { id: 'signup-errors', exact: false }
  if (entry.file.includes('AccountWithdrawalDialog')) return { id: 'withdraw-conflict', exact: false }
  if (entry.file.includes('PasswordRecoveryForm')) return { id: 'reset-invalid', exact: false }
  if (entry.file.endsWith('/PasswordResetPage.tsx') && entry.text === '비밀번호 변경 완료') return { id: 'reset-done', exact: true }
  if (entry.file.endsWith('/PasswordResetPage.tsx') && entry.statusTone === 'error') return { id: 'reset-missing', exact: true }
  if (entry.file.includes('EmailVerificationForm')) return { id: 'verification-expired', exact: false }
  if (entry.file.includes('ProfileEditor')) return { id: 'profile-saved', exact: false }
  if (entry.file.includes('/schedule/')) return { id: entry.statusTone === 'empty' ? 'schedule-empty' : 'schedule-add', exact: false }
  if (entry.file.includes('/media/')) return { id: 'camera-error', exact: false }
  if (entry.file.includes('StudyPage')) return { id: 'study-finish-error', exact: false }
  if (entry.file.includes('HomePage')) return { id: 'home-search', exact: false }
  if (entry.file.includes('PageSkeleton')) return { id: 'app-loading', exact: true }
  if (entry.file.includes('KakaoCallbackPage')) return { id: 'kakao-loading', exact: false }
  return null
}

export const reviewMessageScenarios: { id: string; tone: ReviewMessageTone }[] = [
  { id: 'login-error', tone: 'error' }, { id: 'login-locked', tone: 'error' }, { id: 'signup-errors', tone: 'error' },
  { id: 'verification-expired', tone: 'error' }, { id: 'verification-wrong', tone: 'error' },
  { id: 'reset-requested', tone: 'success' }, { id: 'reset-invalid', tone: 'error' }, { id: 'reset-done', tone: 'success' },
  { id: 'kakao-loading', tone: 'loading' }, { id: 'kakao-failed', tone: 'error' }, { id: 'kakao-cancelled', tone: 'info' },
  { id: 'kakao-invalid', tone: 'error' }, { id: 'kakao-terms', tone: 'error' }, { id: 'kakao-error', tone: 'error' },
  { id: 'onboarding-error', tone: 'error' }, { id: 'home-search', tone: 'empty' }, { id: 'home-saved', tone: 'empty' },
  { id: 'app-loading', tone: 'loading' }, { id: 'app-error', tone: 'error' }, { id: 'profile-saved', tone: 'success' },
  { id: 'profile-error', tone: 'error' }, { id: 'schedule-empty', tone: 'empty' }, { id: 'prepare-error', tone: 'error' },
  { id: 'study-recover', tone: 'info' }, { id: 'study-message-error', tone: 'error' }, { id: 'study-finish', tone: 'warning' },
  { id: 'study-finish-error', tone: 'error' }, { id: 'study-unknown', tone: 'warning' }, { id: 'study-none', tone: 'empty' },
  { id: 'camera-error', tone: 'error' }, { id: 'microphone-error', tone: 'error' }, { id: 'report-error', tone: 'error' },
  { id: 'withdraw', tone: 'warning' }, { id: 'withdraw-conflict', tone: 'error' }, { id: 'withdraw-error', tone: 'error' },
  { id: 'withdraw-pending', tone: 'loading' }, { id: 'withdraw-done', tone: 'success' }, { id: 'not-found', tone: 'empty' },
]
