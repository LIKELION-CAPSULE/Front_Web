import {
  LOCAL_MODEL_URL,
  LOCAL_V2_ENGINE_URL,
  LOCAL_V2_MODEL_URL,
  LOCAL_V2_PLAYER_URL,
  LOCAL_V2_REACTIONS_URL,
} from '@/features/local-demo/local-asset-urls'
import { chaerinArtwork } from '@/features/mates/artwork'
import {
  DEFAULT_BUBBLE_POSITION,
  DEFAULT_EXPRESSION_MAPPING,
  type ExpressionMapping,
} from './desktop-config'

export interface LoginMateModelConfig {
  modelJsonUrl: string
  scale: number
  offsetX: number
  offsetY: number
}

export interface LoginMateV2ModelConfig {
  modelJsonUrl: string
  engineUrl: string
  playerUrl?: string
  reactionsUrl?: string
}

export interface LoginMateBubblePosition {
  align: 'left' | 'center' | 'right'
  bottomPx: number
  maxWidthPercent: number
}

export interface LoginMateProfile {
  id: string
  name: string
  ageRating: string
  portraitImage: string
  callBackgroundImage: string | null
  model: LoginMateModelConfig | null
  v2Model?: LoginMateV2ModelConfig | null
  expressions: ExpressionMapping
  bubblePosition: LoginMateBubblePosition
}

export interface LoginMateSource {
  getCandidates(): readonly LoginMateProfile[]
  selectMate(): LoginMateProfile
}

const LAST_MATE_STORAGE_KEY = 'capsule-login-last-mate:v1'

/**
 * The local Live2D models (dev server only). `import.meta.env.DEV` is a build-time constant: in production this is
 * `return null` and the local URLs are dropped from the bundle.
 */
function localModels(): Pick<LoginMateProfile, 'model' | 'v2Model'> | null {
  if (!import.meta.env.DEV) return null
  return {
    model: { modelJsonUrl: LOCAL_MODEL_URL, scale: 1.54, offsetX: 0, offsetY: 20 },
    v2Model: {
      modelJsonUrl: LOCAL_V2_MODEL_URL,
      engineUrl: LOCAL_V2_ENGINE_URL,
      playerUrl: LOCAL_V2_PLAYER_URL,
      reactionsUrl: LOCAL_V2_REACTIONS_URL,
    },
  }
}

function createDefaultChaerin(includeLocalModel: boolean): LoginMateProfile {
  const local = includeLocalModel ? localModels() : null
  return {
    id: 'chaerin',
    name: '채린',
    ageRating: '전연령',
    portraitImage: chaerinArtwork.hero,
    callBackgroundImage: chaerinArtwork.callBackground.portrait,
    model: local?.model ?? null,
    v2Model: local?.v2Model ?? null,
    expressions: { ...DEFAULT_EXPRESSION_MAPPING },
    bubblePosition: { ...DEFAULT_BUBBLE_POSITION },
  }
}

function selectRotatingMate(candidates: readonly LoginMateProfile[]): LoginMateProfile {
  if (candidates.length <= 1) return candidates[0]!
  let lastId: string | null = null
  try {
    lastId = window.localStorage.getItem(LAST_MATE_STORAGE_KEY)
  } catch {
    // Storage blocked or unavailable: fall back cleanly
  }
  const lastIdx = lastId ? candidates.findIndex((m) => m.id === lastId) : -1
  const nextIdx = (lastIdx + 1) % candidates.length
  const chosen = candidates[nextIdx]!
  try {
    window.localStorage.setItem(LAST_MATE_STORAGE_KEY, chosen.id)
  } catch {
    // Ignore storage write errors
  }
  return chosen
}

/**
 * Port for login-screen mate metadata & Live2D model availability.
 * - mock mode (development builds with VITE_DATA_SOURCE !== 'api'): serves the local Chaerin Live2D model + portrait.
 * - api mode, and every production build whatever its data source: static portrait only (model: null)
 *   until backend exposes a public pre-login mate endpoint.
 */
export function createLoginMateSource(
  mode: 'mock' | 'api' = import.meta.env.DEV && import.meta.env.VITE_DATA_SOURCE !== 'api' ? 'mock' : 'api',
): LoginMateSource {
  const candidates: readonly LoginMateProfile[] = [createDefaultChaerin(mode === 'mock')]
  return {
    getCandidates: () => candidates,
    selectMate: () => selectRotatingMate(candidates),
  }
}
