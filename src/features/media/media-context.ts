import { createContext, useContext } from 'react'
import type { DeviceController } from './device-controller'
import type { SegmentationClient } from './segmentation-client'
import type { BehaviorMonitor } from './behavior-monitor'
import type { MediaSnapshot, Observation, VisionStatus } from './types'

export const MediaContext = createContext<{
  devices: MediaSnapshot
  controller: DeviceController
  vision: VisionStatus | null
  observation: Observation | null
  retryVision: () => void
  flushFocus: () => void
  segmentation: SegmentationClient
  /** Short notice after a virtual background failed and fell back to the plain camera. */
  backgroundNotice: string | null
  /** Study-time behavior detections (away, drowsy, …); empty outside a running study session. */
  behavior: BehaviorMonitor
} | null>(null)

export function useMedia() {
  const value = useContext(MediaContext)
  if (!value) throw new Error('useMedia requires MediaProvider')
  return value
}
