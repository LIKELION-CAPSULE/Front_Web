import { useEffect, useState, useSyncExternalStore } from 'react'
import { VoicePlayer } from './voice-player'

const GESTURES = ['pointerdown', 'keydown', 'touchend'] as const

/**
 * The connection screen's voice player: one per call screen, the T-3 volume applied, and sound allowed on the first
 * pointer or key press in the call tab or its PiP window (the browser's autoplay rule). Stops and closes on unmount.
 */
export function useVoiceReply({ volume, windows }: { volume: number; windows: readonly (Window | null)[] }) {
  const [player] = useState(() => new VoicePlayer())
  const status = useSyncExternalStore(player.subscribe, player.getSnapshot, () => 'idle' as const)
  useEffect(() => { player.setVolume(volume / 100) }, [player, volume])
  useEffect(() => () => player.release(), [player])
  const [first, second] = windows
  useEffect(() => {
    const surfaces = [first, second].filter((value): value is Window => Boolean(value))
    for (const surface of surfaces) for (const type of GESTURES) surface.addEventListener(type, player.unlock, { capture: true, passive: true })
    return () => { for (const surface of surfaces) for (const type of GESTURES) surface.removeEventListener(type, player.unlock, { capture: true }) }
  }, [player, first, second])
  return { player, status }
}
