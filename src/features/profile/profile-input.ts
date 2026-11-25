import { NICKNAME_MAX_CODE_POINTS } from '../../shared/api/constraints.ts'

/** 「나에 대해」 (`aboutMe`): the server takes 0–50 characters, an empty string clears it (BACKEND_API.md 2026-11-25, UpdateMeRequest). */
export const ABOUT_ME_MAX_LENGTH = 50

export function nicknameError(value: string): string | undefined {
  if (!value.trim()) return '닉네임을 입력해 주세요.'
  if ([...value.trim()].length > NICKNAME_MAX_CODE_POINTS) return '닉네임은 20자 이내로 입력해 주세요.'
}
