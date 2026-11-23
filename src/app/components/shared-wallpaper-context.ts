import { createContext, useContext } from 'react'
import type { DesktopControls, WindowRect } from '@/features/auth/login-backgrounds/desktop/desktop-config'

export interface AuthWallpaperOverride {
  controls: DesktopControls
  paused: boolean
  inputFocused: boolean
  windowRects: { mate: WindowRect; login: WindowRect }
  shinyTriggerNonce: number
  disableShiny: boolean
  captureWallpaperMode: 'tubes' | 'fallback' | null
  onSecretHover?: (normPos: { x: number; y: number }) => void
  onShinyFound?: (normPos: { x: number; y: number }) => void
}

export interface SharedWallpaperContextValue {
  webgl2Available: boolean
  reducedMotion: boolean
  isMobile: boolean
  lowPower: boolean
  canRender3D: boolean
  canRenderMate: boolean
  degradationStage: 0 | 1 | 2 | 3
  setDegradationStage: (stage: 0 | 1 | 2 | 3) => void
  fps: number | null
  setAuthOverride: (override: AuthWallpaperOverride | null) => void
}

export const SharedWallpaperContext = createContext<SharedWallpaperContextValue | null>(null)

export function useSharedWallpaper(): SharedWallpaperContextValue | null {
  return useContext(SharedWallpaperContext)
}
