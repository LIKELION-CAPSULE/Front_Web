import { useCallback, useEffect, useState } from 'react'
import type { ModelInfo } from '@/shared/api/types'
import { Live2DStage } from './live2d-stage'
import { SessionModel, type SessionModelFactory, type SessionModelStage } from './session-model'

const createStage: SessionModelFactory = (url, layout) => new Live2DStage(url, layout, new URL(import.meta.env.BASE_URL, location.href).href)
export type AvatarModelStatus = 'missing' | 'loading' | 'ready' | 'error'

/** Owns an avatar independently of the companion; changing its host never reloads the model. */
export function useAvatarModel(model: ModelInfo | undefined, scope = '') {
  const { modelJsonUrl, scale, offsetX, offsetY } = model ?? {}
  const [attempt, setAttempt] = useState(0)
  const key = JSON.stringify([scope, modelJsonUrl, scale, offsetX, offsetY, attempt])
  const [result, setResult] = useState<{ key: string; stage: SessionModelStage | null } | null>(null)
  const current = result?.key === key ? result : null
  const stage = current?.stage ?? null
  const status: AvatarModelStatus = !modelJsonUrl ? 'missing' : stage ? 'ready' : current ? 'error' : 'loading'
  const retry = useCallback(() => setAttempt(value => value + 1), [])

  useEffect(() => {
    if (!modelJsonUrl) return
    const loader = new SessionModel(createStage)
    let alive = true
    void loader.prepare({ modelJsonUrl, scale, offsetX, offsetY }).then(value => {
      if (alive) setResult({ key, stage: value })
    }).catch(() => {
      if (alive) setResult({ key, stage: null })
    })
    return () => { alive = false; loader.release() }
  }, [key, modelJsonUrl, scale, offsetX, offsetY])

  return { stage, status, retry }
}
