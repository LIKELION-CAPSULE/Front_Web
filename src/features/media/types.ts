import type { FaceSignal, HandSignal } from './behavior-rules'

export type DeviceKind = 'camera' | 'microphone'
export type DeviceStatus = 'idle' | 'requesting' | 'ready' | 'error'
export type DeviceState = {
  status: DeviceStatus
  stream: MediaStream | null
  error: string
}
export type MediaSnapshot = Record<DeviceKind, DeviceState>

export type FaceBounds = { x: number; y: number; width: number; height: number }
export type Observation = {
  at: number
  faceCount: number
  faceBox: FaceBounds | null
}
export type VisionStatus = {
  status: 'loading' | 'ready' | 'error'
  faceBackend?: 'GPU' | 'CPU'
  error?: string
}
/** Models a frame is run through; gesture and phone load on first use, only during study. */
export type VisionTask = 'face' | 'gesture' | 'phone'
/** One reply per frame. Each part is present only when that model ran; inputs are never mirrored. */
export type FrameResult = {
  at: number
  face?: Omit<Observation, 'at'> & { signal: FaceSignal }
  hand?: HandSignal
  phoneScore?: number
}
export type VisionMessage =
  | { type: 'status'; value: VisionStatus }
  | { type: 'result'; value: FrameResult }
  /** A study-only model failed to load; face detection keeps running without it. */
  | { type: 'task-error'; task: Exclude<VisionTask, 'face'> }
export type VisionRequest =
  | { type: 'init'; baseUrl: string }
  | { type: 'frame'; frame: ImageBitmap; at: number; tasks: VisionTask[] }

export type SegmenterRequest =
  | { type: 'init'; baseUrl: string }
  | { type: 'frame'; id: number; frame: ImageBitmap }
  | { type: 'close' }
export type SegmenterMessage =
  | { type: 'status'; value: 'ready' | 'error' }
  /** The frame travels back with its mask so both are composited in sync; mask is null if segmentation failed. */
  | { type: 'result'; id: number; frame: ImageBitmap; mask: ImageBitmap | null }
