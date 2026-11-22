import { ApiError } from '../../shared/api/client.ts'

/** Capture the account before an operation; each asynchronous boundary must still belong to it. */
export function accountScope(currentGeneration: () => number) {
  const generation = currentGeneration()
  const check = () => {
    if (generation !== currentGeneration()) throw new ApiError('로그인 상태가 변경됐어요.', 401, 'AUTH_SESSION_CHANGED')
  }
  return {
    async wait<T>(task: Promise<T>): Promise<T> {
      try {
        const value = await task
        check()
        return value
      } catch (error) {
        // Rejected responses also reach operation-specific catch handlers. An old
        // conflict must not invalidate a newly authenticated account's cache.
        check()
        throw error
      }
    },
  }
}
