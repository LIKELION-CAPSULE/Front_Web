export const authNotices = {
  'kakao-cancelled': { tone: 'info', title: '카카오 동의 취소', text: '카카오 로그인을 취소했거나 동의하지 않았어요. 다시 로그인해 주세요.' },
  'kakao-invalid-request': { tone: 'error', title: '요청 확인 불가', text: '로그인 요청을 확인하지 못했어요. 처음부터 다시 시도해 주세요.' },
  'kakao-terms-required': { tone: 'error', title: '필수 약관 누락', text: '필수 약관 동의 정보를 확인하지 못했어요. 약관을 확인하고 카카오로 다시 계속해 주세요.' },
  'kakao-expired': { tone: 'error', title: '카카오 인증 실패', text: '카카오 로그인 요청이 만료됐거나 이미 사용됐어요. 다시 로그인해 주세요.' },
  'kakao-failed': { tone: 'error', title: '카카오 로그인 오류', text: '카카오 로그인에 실패했어요. 다시 로그인해 주세요.' },
  'password-reset': { tone: 'success', title: '비밀번호 변경 완료', text: '비밀번호가 바뀌었어요. 새 비밀번호로 로그인해 주세요.' },
  'account-withdrawn': { tone: 'success', title: '회원탈퇴 완료', text: '그동안 CAPSULE을 이용해 주셔서 감사합니다.' },
} as const

export function authNotice(value: string | null) {
  return value && Object.hasOwn(authNotices, value) ? authNotices[value as keyof typeof authNotices] : null
}

export function kakaoErrorNotice(error: unknown): keyof typeof authNotices {
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === 'TERMS_REQUIRED') return 'kakao-terms-required'
    if (error.code === 'SOCIAL_AUTH_FAILED') return 'kakao-expired'
  }
  return 'kakao-failed'
}
