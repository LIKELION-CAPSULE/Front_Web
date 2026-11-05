import {
  advanceExpression, cancelPendingExpression, createExpressionSchedule, expressionRequest, nextExpressionDeadline, requestExpression,
  type ExpressionCommand, type ExpressionCue, type ExpressionSchedule,
} from './expression-scheduler'
import type { SessionModelStage } from './session-model'

/** Runs the pure scheduler on a timer and forwards its commands to the current stage. */
export class ExpressionDirector {
  private schedule: ExpressionSchedule = createExpressionSchedule()
  private timer: number | undefined
  private stage: SessionModelStage | null = null
  private readonly now: () => number

  constructor(now = () => performance.now()) {
    this.now = now
  }

  /** A stage that appears later (or reloads) picks up the face already on schedule. */
  setStage(stage: SessionModelStage | null) {
    this.stage = stage
    const shown = this.schedule.shown
    stage?.setExpression(shown && (shown.until === null || this.now() < shown.until) ? shown.file : null)
  }

  cue(cue: ExpressionCue) {
    const request = expressionRequest(cue)
    if (request) this.run(requestExpression(this.schedule, request, this.now()))
  }

  cancelPending() {
    this.schedule = cancelPendingExpression(this.schedule)
    this.arm()
  }

  private run(result: { schedule: ExpressionSchedule; command: ExpressionCommand | null }) {
    this.schedule = result.schedule
    if (result.command) this.stage?.setExpression(result.command.file)
    this.arm()
  }

  private arm() {
    window.clearTimeout(this.timer)
    const deadline = nextExpressionDeadline(this.schedule)
    if (deadline === null) return
    this.timer = window.setTimeout(() => this.run(advanceExpression(this.schedule, this.now())), Math.max(0, deadline - this.now()))
  }

  dispose() {
    window.clearTimeout(this.timer)
    this.stage = null
  }
}
