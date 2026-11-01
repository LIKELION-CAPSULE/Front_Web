export type CameraBackgroundOption =
  | { id: string; label: string; kind: 'none' | 'blur' }
  | { id: string; label: string; kind: 'image'; src: string }

/** Every camera background the user can pick; image provenance lives in src/assets/camera-backgrounds/README.md. */
export const cameraBackgrounds = [
  { id: 'none', label: '기본', kind: 'none' },
  { id: 'blur', label: '블러', kind: 'blur' },
  {
    id: 'classroom-sunset',
    label: '노을 지는 교실',
    kind: 'image',
    src: new URL('../../assets/camera-backgrounds/classroom-sunset-v1.webp', import.meta.url).href,
  },
  {
    id: 'library-rainy-night',
    label: '비 오는 밤의 도서관',
    kind: 'image',
    src: new URL('../../assets/camera-backgrounds/library-rainy-night-v1.webp', import.meta.url).href,
  },
  {
    id: 'study-room-night-city',
    label: '야경 보이는 공부방',
    kind: 'image',
    src: new URL('../../assets/camera-backgrounds/study-room-night-city-v1.webp', import.meta.url).href,
  },
] as const satisfies readonly CameraBackgroundOption[]

export type CameraBackgroundId = (typeof cameraBackgrounds)[number]['id']
export type CameraBackground = (typeof cameraBackgrounds)[number]

export const DEFAULT_CAMERA_BACKGROUND: CameraBackgroundId = 'none'

/** Saved values from older builds or removed options fall back to the untouched camera. */
export function normalizeCameraBackground(value: unknown): CameraBackgroundId {
  return cameraBackgrounds.find((option) => option.id === value)?.id ?? DEFAULT_CAMERA_BACKGROUND
}

export function getCameraBackground(id: CameraBackgroundId): CameraBackground {
  return cameraBackgrounds.find((option) => option.id === id) ?? cameraBackgrounds[0]
}
