import { NICKNAME_MAX_CODE_POINTS } from '../../shared/api/constraints.ts'

export function nicknameError(value: string): string | undefined {
  if (!value.trim()) return '닉네임을 입력해 주세요.'
  if ([...value.trim()].length > NICKNAME_MAX_CODE_POINTS) return '닉네임은 20자 이내로 입력해 주세요.'
}
