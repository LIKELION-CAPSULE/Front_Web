/**
 * One onboarding finish at a time. The lock is taken before the invite code check starts, so a second press of
 * 「시작하기」, a 「건너뛰기」 or a 「이전」 while the check is still running cannot start a second save (or let a late save
 * overwrite an earlier one). The check and the save share one try/finally, so the lock always opens again.
 *
 * `isCurrent` runs right before the save: when the screen has been left or the signed-in account changed while the
 * check was running, nothing is saved.
 */
export type OnboardingFinishResult = 'busy' | 'invalid' | 'stale' | 'saved'

export function createFinishGate() {
  let pending = false
  return {
    isPending: () => pending,
    async run(steps: {
      /** The invite code check; `false` stops before saving. Omitted when there is no code. */
      validate?: () => Promise<boolean>
      isCurrent: () => boolean
      save: () => Promise<void>
    }): Promise<OnboardingFinishResult> {
      if (pending) return 'busy'
      pending = true
      try {
        if (steps.validate && !(await steps.validate())) return 'invalid'
        if (!steps.isCurrent()) return 'stale'
        await steps.save()
        return 'saved'
      } finally {
        pending = false
      }
    },
  }
}
