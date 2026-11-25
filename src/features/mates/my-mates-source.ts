import { mergeMyMates, type MyMateConnection, type MyMateView } from '../backend/records-adapters.ts'
import type { AvailableMate } from './catalog.ts'
import { frontMateOf } from './connected-mate.ts'
import { CAPSULE_COUNT, capsulesForConnection } from './capsule-jar/capsule-floor-layout.ts'
import type { CapsuleRecord } from './capsule-jar/capsule-jar-types.ts'

/** 37 내 메이트 → the my-mates page (use-my-mates.ts reads it). Pure, so the tests import it directly. */

export function myMatesByLaunchMate(views: readonly MyMateView[], mates: readonly AvailableMate[]): ReadonlyMap<string, MyMateView> {
  const groups = new Map<string, MyMateView[]>()
  for (const view of views) {
    const mate = frontMateOf(String(view.serverIds[0]), view.name, mates)
    if (!mate) continue
    groups.set(mate.id, [...(groups.get(mate.id) ?? []), view])
  }
  return new Map([...groups].map(([id, entries]) => [id, mergeMyMates(entries)]))
}

/** 37 `recent[]` as the capsule jar's capsules, oldest first (it stacks them in time order). */
export function capsulesFromConnections(connections: readonly MyMateConnection[]): CapsuleRecord[] {
  return connections
    .map(connection => ({
      id: connection.connectionId,
      startedAt: connection.endedAt - connection.connectedSeconds * 1000,
      endedAt: connection.endedAt,
      durationSeconds: connection.connectedSeconds,
      connectionId: connection.connectionId,
    }))
    .sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id))
}

/**
 * Capsules of all of a mate's connections. 37 lists only the newest five, so the rest is estimated from the totals with
 * the jar's own rule (capsule-floor-layout.ts): one per `minutesPerCapsule` of their time, at least `min` per connection.
 */
export function estimatedCapsuleCount(view: Pick<MyMateView, 'connectionCount' | 'totalConnectedSeconds' | 'recent'>) {
  const recent = view.recent.reduce((sum, connection) => sum + capsulesForConnection(connection.connectedSeconds), 0)
  const olderCount = Math.max(0, view.connectionCount - view.recent.length)
  if (!olderCount) return recent
  const olderSeconds = Math.max(0, view.totalConnectedSeconds - view.recent.reduce((sum, connection) => sum + connection.connectedSeconds, 0))
  return recent + Math.max(olderCount * CAPSULE_COUNT.min, Math.round(olderSeconds / 60 / CAPSULE_COUNT.minutesPerCapsule))
}
