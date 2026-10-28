import type { DemoState } from './types.ts'

function currentSystemCopy(value: string) {
  return value
    .replace(/^캐릭터 패스(?= ·|$)/, '친구 패스')
    .replace(/^시험기간 응원 패스(?= ·|$)/, '시험 기간 응원 패스')
    .replace(/^공부 옵션 · /, '대화 옵션 · ')
    .replace(/^등급 올리기 · /, '대화 옵션 변경 · ')
}

/** Update system labels in saved history without changing user-authored content or balances. */
export function migrateDemoCopy(state: DemoState): DemoState {
  let pass = state.pass
  if (pass) {
    const name = currentSystemCopy(pass.name)
    if (name !== pass.name) pass = { ...pass, name }
  }
  let changed = pass !== state.pass
  const ledger = state.ledger.map((entry) => {
    const description = currentSystemCopy(entry.description)
    if (description === entry.description) return entry
    changed = true
    return { ...entry, description }
  })
  return changed ? { ...state, pass, ledger } : state
}
