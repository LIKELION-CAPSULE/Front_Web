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
export type VisionMessage =
  | { type: 'status'; value: VisionStatus }
  | { type: 'result'; value: Observation }
export type VisionRequest =
  | { type: 'init'; baseUrl: string }
  | { type: 'frame'; frame: ImageBitmap; at: number }
