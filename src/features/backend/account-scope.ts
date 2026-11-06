import { ApiError } from '../../shared/api/client.ts'

/** Capture the account before an operation; each asynchronous boundary must still belong to it. */
export function accountScope(currentGeneration: () => number) {
  const generation = currentGeneration()
  return {
    async wait<T>(task: Promise<T>): Promise<T> {
      const value = await task
      if (generation !== currentGeneration()) throw new ApiError('로그인 상태가 변경됐어요.', 401, 'AUTH_SESSION_CHANGED')
      return value
    },
  }
}
