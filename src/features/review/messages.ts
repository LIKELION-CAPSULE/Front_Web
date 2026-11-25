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
  if (entry.file.includes('ConnectionSettingsPanel')) return { id: 'account-settings', exact: false }
  if (entry.file.includes('/media/')) return { id: 'connection-camera-error', exact: false }
  if (entry.file.includes('ConnectMateButton')) return { id: 'connection-start-error', exact: false }
  if (entry.file.includes('ConnectionRecordPage')) return { id: 'connection-record', exact: false }
  if (entry.file.includes('ConnectionPage')) return { id: 'connection-active', exact: false }
  if (entry.file.includes('HomePage')) {
    const states: Record<string, string> = {
      '페이지를 찾을 수 없어요': 'not-found', '홈으로 이동했어요. 주소를 다시 확인해 주세요.': 'not-found',
      '앱 연결 실패': 'app-error', '다시 시도': 'app-error',
    }
    return { id: states[entry.text] ?? 'home-first', exact: !!states[entry.text] }
  }
  if (entry.file.includes('AppLoading') || entry.file.includes('RouteLoading')) return { id: 'app-loading', exact: false }
  if (entry.file.includes('PageSkeleton')) {
    const screens: Record<string, string> = {
      '홈 화면을 불러오고 있어요.': 'home-loading', '프로필 선택 화면을 불러오고 있어요.': 'onboarding-loading',
      '메이트를 불러오고 있어요.':'mate-detail','연결 화면을 불러오고 있어요.':'connection-entry','연결 기록을 불러오고 있어요.':'connection-record',
    }
    return { id: screens[entry.text] ?? 'app-loading', exact: !!screens[entry.text] }
  }
  if (entry.file.includes('KakaoCallbackPage')) return { id: 'kakao-loading', exact: false }
  if (entry.file.includes('KakaoTermsPage')) {
    const states: Record<string, string> = {
      '가입 확인 시간이 지났어요': 'kakao-terms-expired', '가입 요청을 확인하지 못했어요': 'kakao-terms-invalid',
      '약관이 새로 바뀌었어요. 내용을 다시 확인하고 동의해 주세요.': 'kakao-terms-changed',
    }
    return { id: states[entry.text] ?? 'kakao-terms-consent', exact: !!states[entry.text] }
  }
  return null
}

export const reviewMessageScenarios: { id: string; tone: ReviewMessageTone }[] = [
  { id: 'login-error', tone: 'error' }, { id: 'login-locked', tone: 'error' }, { id: 'signup-errors', tone: 'error' },
  { id: 'verification-expired', tone: 'error' }, { id: 'verification-wrong', tone: 'error' },
  { id: 'reset-requested', tone: 'success' }, { id: 'reset-invalid', tone: 'error' }, { id: 'reset-done', tone: 'success' },
  { id: 'kakao-loading', tone: 'loading' }, { id: 'kakao-failed', tone: 'error' }, { id: 'kakao-cancelled', tone: 'info' },
  { id: 'kakao-invalid', tone: 'error' }, { id: 'kakao-terms', tone: 'error' }, { id: 'kakao-error', tone: 'error' },
  { id: 'kakao-terms-expired', tone: 'error' }, { id: 'kakao-terms-invalid', tone: 'error' }, { id: 'kakao-terms-changed', tone: 'warning' },
  { id: 'kakao-terms-pending', tone: 'loading' },
  { id:'connection-model-missing',tone:'error' },{ id:'connection-camera-error',tone:'error' },{ id:'connection-finish-error',tone:'error' },{ id:'connection-message-error',tone:'error' },{ id:'connection-record-error',tone:'error' },{ id: 'onboarding-error', tone: 'error' }, { id: 'home-empty', tone: 'empty' }, { id: 'connection-start-error', tone: 'error' },
  { id: 'app-loading', tone: 'loading' }, { id: 'app-error', tone: 'error' },
  { id: 'home-loading', tone: 'loading' }, { id: 'onboarding-loading', tone: 'loading' }, { id: 'kakao-onboarding-loading', tone: 'loading' },
  { id: 'kakao-home-loading', tone: 'loading' }, { id: 'kakao-account-loading', tone: 'loading' },



  { id: 'account-profile-error', tone: 'error' }, { id: 'account-logout-error', tone: 'error' },
  { id: 'account-password-requested', tone: 'success' }, { id: 'account-password-error', tone: 'error' }, { id: 'account-password-pending', tone: 'loading' },




  { id: 'withdraw', tone: 'warning' }, { id: 'withdraw-conflict', tone: 'error' }, { id: 'withdraw-error', tone: 'error' },
  { id: 'withdraw-pending', tone: 'loading' }, { id: 'withdraw-done', tone: 'success' }, { id: 'not-found', tone: 'warning' },
]
