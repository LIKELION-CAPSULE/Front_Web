import { ApiError } from '../../shared/api/client.ts'

/** 409 `CONNECTION_ENDED` (17 · 18 · 19 · 20 · 21 · 28): the server already ended this connection. */
export const CONNECTION_ENDED = 'CONNECTION_ENDED'
export function isConnectionEnded(reason: unknown): reason is ApiError {
  return reason instanceof ApiError && reason.code === CONNECTION_ENDED
}

/** Local context for an existing server `CONNECTION_ENDED` error, not a new wire field. */
export class EndedConnectionError extends ApiError {
  readonly connectionId: string
  constructor(error: ApiError, connectionId: string) {
    super(error.message, error.status, error.code, error.detail)
    this.connectionId = connectionId
  }
  /** @deprecated old name; use `connectionId`. */
  get sessionId() { return this.connectionId }
}
