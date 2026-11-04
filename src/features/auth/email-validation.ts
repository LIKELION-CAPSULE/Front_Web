export type AuthField = 'email' | 'password' | 'confirmPassword' | 'nickname' | 'agreeTerms' | 'agreePrivacy'
export type AuthErrors = Partial<Record<AuthField, string>>
export type EmailAuthValues = { email: string; password: string; confirmPassword: string; nickname: string; agreeTerms: boolean; agreePrivacy: boolean }

export function validateEmailAuth(values: EmailAuthValues, signup: boolean, emailValid: boolean): AuthErrors {
  const errors: AuthErrors = {}
  if (!values.email.trim()) errors.email = '이메일을 입력해 주세요.'
  else if (!emailValid) errors.email = '이메일 주소를 확인해 주세요.'
  if (!values.password) errors.password = '비밀번호를 입력해 주세요.'
  else if (signup && values.password.length < 8) errors.password = '비밀번호는 8자 이상 입력해 주세요.'
  if (signup) {
    if (!values.confirmPassword) errors.confirmPassword = '비밀번호를 한 번 더 입력해 주세요.'
    else if (values.password !== values.confirmPassword) errors.confirmPassword = '비밀번호가 일치하지 않아요.'
    if (!values.nickname.trim()) errors.nickname = '닉네임을 입력해 주세요.'
    else if (values.nickname.trim().length > 20) errors.nickname = '닉네임은 20자 이내로 입력해 주세요.'
    if (!values.agreeTerms) errors.agreeTerms = '이용약관에 동의해 주세요.'
    if (!values.agreePrivacy) errors.agreePrivacy = '개인정보 처리방침에 동의해 주세요.'
  }
  return errors
}
