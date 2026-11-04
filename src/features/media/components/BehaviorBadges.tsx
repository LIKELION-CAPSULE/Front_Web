import { useSyncExternalStore } from 'react'
import { SHOW_BEHAVIOR_OVERLAY } from '../behavior-constants'
import { behaviorLabels } from '../behavior-rules'
import { useMedia } from '../media-context'

/** Debug overlay for checking detections: rule names in a corner of the user's own tile. */
export function BehaviorBadges() {
  const { behavior } = useMedia()
  const active = useSyncExternalStore(behavior.subscribe, behavior.getSnapshot)
  if (!SHOW_BEHAVIOR_OVERLAY || !active.length) return null
  return (
    <ul className="behavior-badges" aria-label="감지된 상태">
      {active.map((kind) => <li key={kind} data-kind={kind}>{behaviorLabels[kind]}</li>)}
    </ul>
  )
}
