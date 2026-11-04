import { activeBehaviors, createBehaviorState, stepBehavior, type BehaviorInput, type BehaviorKind } from './behavior-rules.ts'

/** A rule that just started or just stopped holding. Times are epoch milliseconds. */
export type BehaviorChange = {
  at: number
  started: BehaviorKind[]
  ended: { kind: BehaviorKind; since: number }[]
}

const none: readonly BehaviorKind[] = []

/**
 * Feeds model outputs through the pure rules and publishes only transitions,
 * so React re-renders when the set of detections changes rather than every frame.
 */
export class BehaviorMonitor {
  private state = createBehaviorState()
  private active = none
  private readonly since = new Map<BehaviorKind, number>()
  private readonly listeners = new Set<() => void>()
  private readonly changeListeners = new Set<(change: BehaviorChange) => void>()

  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  getSnapshot = () => this.active
  onChange(listener: (change: BehaviorChange) => void) {
    this.changeListeners.add(listener)
    return () => { this.changeListeners.delete(listener) }
  }

  /** `at` is the frame's capture time on the performance clock, as the vision worker reports it. */
  observe(input: BehaviorInput, at: number, epoch = performance.timeOrigin + at) {
    this.state = stepBehavior(this.state, input, at)
    const next = activeBehaviors(this.state, at)
    const started = next.filter((kind) => !this.active.includes(kind))
    const ended = this.active.filter((kind) => !next.includes(kind))
      .map((kind) => ({ kind, since: this.since.get(kind) ?? epoch }))
    if (!started.length && !ended.length) return
    for (const kind of started) this.since.set(kind, epoch)
    for (const { kind } of ended) this.since.delete(kind)
    this.active = next
    for (const listener of this.changeListeners) listener({ at: epoch, started, ended })
    for (const listener of this.listeners) listener()
  }

  /** Stopping detection (pause, break, hidden tab, camera off) is not a return, so nothing is reported as ended. */
  reset() {
    this.state = createBehaviorState()
    this.since.clear()
    if (this.active === none) return
    this.active = none
    for (const listener of this.listeners) listener()
  }
}
