import { ApiError } from '../../shared/api/client.ts'

/** Local context for an existing server SESSION_ENDED error, not a new wire field. */
export class EndedConnectionError extends ApiError {
  readonly sessionId: string
  constructor(error: ApiError, sessionId: string) {
    super(error.message, error.status, error.code, error.detail)
    this.sessionId = sessionId
  }
}
