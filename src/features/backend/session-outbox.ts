import type { StateEvent } from './presence-clock.ts'

type Outbox = {
  alive: boolean
  outbox: StateEvent[]
  draining: Promise<void> | null
  flow: { revision: number }
}

/** Finish the in-flight event, but never send the next event after its study screen is gone. */
export function flushSessionOutbox<T>(current: Outbox, send: (event: StateEvent) => Promise<T>, onSent: (result: T, event: StateEvent, revision: number) => void): Promise<void> {
  if (current.draining) return current.draining
  const task = (async () => {
    while (current.alive && current.outbox.length) {
      const event = current.outbox[0]!
      const revision = current.flow.revision
      const result = await send(event)
      current.outbox.shift()
      if (current.alive) onSent(result, event, revision)
    }
  })()
  current.draining = task
  const cleanup = () => { if (current.draining === task) current.draining = null }
  void task.then(cleanup, cleanup)
  return task
}
