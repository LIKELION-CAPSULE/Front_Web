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
  if (entry.file.includes('withdrawal-confirmation')) return { id: 'withdraw', exact: false }
  if (entry.file.includes('AccountSecurityPanel')) return { id: 'account-security', exact: false }
  if (entry.file.includes('AccountSettingsDialog')) return { id: entry.text.includes('로그아웃') ? 'account-logout' : 'account-profile', exact: false }
  if (entry.file.includes('PasswordRecoveryForm')) return { id: 'reset-invalid', exact: false }
  if (entry.file.endsWith('/PasswordResetPage.tsx') && entry.text === '비밀번호 변경 완료') return { id: 'reset-done', exact: true }
  if (entry.file.endsWith('/PasswordResetPage.tsx') && entry.statusTone === 'error') return { id: 'reset-missing', exact: true }
  if (entry.file.includes('EmailVerificationForm')) return { id: 'verification-expired', exact: false }
  if (entry.file.includes('ProfileEditor')) return { id: entry.statusTone === 'error' ? 'account-profile-error' : 'account-profile', exact: false }
  if (entry.file.includes('/schedule/')) return { id: entry.statusTone === 'empty' ? 'account-schedule-empty' : entry.statusTone === 'error' ? 'account-schedule-add-error' : 'account-schedule-add', exact: false }
  if (entry.file.includes('/media/')) return { id: 'camera-error', exact: false }
  if (entry.file.includes('StudyNotifications')) return {
    id: entry.text.includes('자리 지킴') ? 'study-presence-warning'
      : entry.text.includes('카메라') ? 'camera-error'
        : entry.text.includes('마이크') ? 'microphone-error' : 'study-sync-error',
    exact: false,
  }
  if (entry.file.includes('StudyPage')) return { id: 'study-finish-error', exact: false }
  if (entry.file.includes('HomePage')) {
    const states: Record<string, string> = {
      '페이지를 찾을 수 없어요': 'not-found', '홈으로 이동했어요. 주소를 다시 확인해 주세요.': 'not-found',
      '앱 연결 실패': 'app-error', '다시 연결하기': 'app-error',
      '아직 등록된 스터디룸이 없어요': 'home-empty', '스터디룸이 등록되면 이곳에 표시돼요.': 'home-empty',
      '아직 저장한 스터디룸이 없어요': 'home-saved', '마음에 드는 스터디룸을 저장해 보세요.': 'home-saved',
      '검색 결과가 없어요': 'home-search', '스터디룸이나 친구 이름으로 다시 검색해 보세요.': 'home-search',
    }
    return { id: states[entry.text] ?? 'home-search', exact: !!states[entry.text] }
  }
  if (entry.file.includes('AppLoading') || entry.file.includes('RouteLoading')) return { id: 'app-loading', exact: false }
  if (entry.file.includes('PageSkeleton')) {
    const screens: Record<string, string> = {
      '홈 화면을 불러오고 있어요.': 'home-loading', '프로필 선택 화면을 불러오고 있어요.': 'onboarding-loading',
      '스터디룸을 불러오고 있어요.': 'room-loading', '공부 설정을 불러오고 있어요.': 'prepare-loading',
      '공부 화면을 불러오고 있어요.': 'study-loading', '공부 리포트를 불러오고 있어요.': 'report-loading', '캡슐 카드를 불러오고 있어요.': 'card-loading',
    }
    return { id: screens[entry.text] ?? 'app-loading', exact: !!screens[entry.text] }
  }
  if (entry.file.includes('KakaoCallbackPage')) return { id: 'kakao-loading', exact: false }
  return null
}

export const reviewMessageScenarios: { id: string; tone: ReviewMessageTone }[] = [
  { id: 'login-error', tone: 'error' }, { id: 'login-locked', tone: 'error' }, { id: 'signup-errors', tone: 'error' },
  { id: 'verification-expired', tone: 'error' }, { id: 'verification-wrong', tone: 'error' },
  { id: 'reset-requested', tone: 'success' }, { id: 'reset-invalid', tone: 'error' }, { id: 'reset-done', tone: 'success' },
  { id: 'kakao-loading', tone: 'loading' }, { id: 'kakao-failed', tone: 'error' }, { id: 'kakao-cancelled', tone: 'info' },
  { id: 'kakao-invalid', tone: 'error' }, { id: 'kakao-terms', tone: 'error' }, { id: 'kakao-error', tone: 'error' },
  { id: 'onboarding-error', tone: 'error' }, { id: 'home-empty', tone: 'empty' }, { id: 'home-search', tone: 'empty' }, { id: 'home-saved', tone: 'empty' },
  { id: 'app-loading', tone: 'loading' }, { id: 'app-error', tone: 'error' },
  { id: 'home-loading', tone: 'loading' }, { id: 'onboarding-loading', tone: 'loading' }, { id: 'kakao-onboarding-loading', tone: 'loading' },
  { id: 'kakao-home-loading', tone: 'loading' }, { id: 'kakao-account-loading', tone: 'loading' },
  { id: 'room-loading', tone: 'loading' }, { id: 'prepare-loading', tone: 'loading' },
  { id: 'study-loading', tone: 'loading' }, { id: 'report-loading', tone: 'loading' }, { id: 'card-loading', tone: 'loading' },
  { id: 'account-schedule-empty', tone: 'empty' }, { id: 'prepare-error', tone: 'error' },
  { id: 'account-schedule-add-error', tone: 'error' }, { id: 'account-schedule-add-pending', tone: 'loading' },
  { id: 'account-profile-error', tone: 'error' }, { id: 'account-logout-error', tone: 'error' },
  { id: 'account-password-requested', tone: 'success' }, { id: 'account-password-error', tone: 'error' }, { id: 'account-password-pending', tone: 'loading' },
  { id: 'study-recover', tone: 'info' }, { id: 'study-message-error', tone: 'error' }, { id: 'study-finish', tone: 'warning' },
  { id: 'study-finish-error', tone: 'error' }, { id: 'study-unknown', tone: 'warning' }, { id: 'study-none', tone: 'empty' },
  { id: 'study-presence-warning', tone: 'warning' }, { id: 'study-sync-error', tone: 'error' },
  { id: 'camera-error', tone: 'error' }, { id: 'microphone-error', tone: 'error' }, { id: 'report-error', tone: 'error' },
  { id: 'withdraw', tone: 'warning' }, { id: 'withdraw-conflict', tone: 'error' }, { id: 'withdraw-error', tone: 'error' },
  { id: 'withdraw-pending', tone: 'loading' }, { id: 'withdraw-done', tone: 'success' }, { id: 'not-found', tone: 'warning' },
]
