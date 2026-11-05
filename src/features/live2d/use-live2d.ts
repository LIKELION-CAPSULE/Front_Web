import { useEffect, useState, useSyncExternalStore } from 'react'
import type { Figure } from '@/shared/api/types'
import { ExpressionDirector } from './expression-director'
import { Live2DStage, type Live2DLayout } from './live2d-stage'

/** Holds the page's single stage as an external store so effects never set React state directly. */
class StageSlot {
  private stage: Live2DStage | null = null
  private readonly listeners = new Set<() => void>()
  subscribe = (listener: () => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }
  getSnapshot = () => this.stage
  open(url: string, layout: Live2DLayout) {
    const stage = new Live2DStage(url, layout, new URL(import.meta.env.BASE_URL, location.href).href)
    this.set(stage)
    return () => {
      stage.destroy()
      if (this.stage === stage) this.set(null)
    }
  }
  private set(stage: Live2DStage | null) {
    this.stage = stage
    for (const listener of this.listeners) listener()
  }
}

const finite = (value: number | undefined, fallback: number) => typeof value === 'number' && Number.isFinite(value) ? value : fallback

/** Loads the server character's model3.json; without a URL there is no stage and tiles keep their images. */
export function useLive2DStage(figure: Figure | null | undefined) {
  const [slot] = useState(() => new StageSlot())
  const url = figure?.modelJsonUrl
  const scale = finite(figure?.scale, 1)
  const offsetX = finite(figure?.offsetX, 0)
  const offsetY = finite(figure?.offsetY, 0)
  useEffect(() => url ? slot.open(url, { scale: scale > 0 ? scale : 1, offsetX, offsetY }) : undefined, [slot, url, scale, offsetX, offsetY])
  return useSyncExternalStore(slot.subscribe, slot.getSnapshot, () => null)
}

const idle = () => () => {}
export function useLive2DStatus(stage: Live2DStage | null) {
  return useSyncExternalStore(stage?.subscribe ?? idle, () => stage?.getStatus() ?? null, () => null)
}

/** One director per study page; it follows whichever stage is current. */
export function useExpressionDirector(stage: Live2DStage | null) {
  const [director] = useState(() => new ExpressionDirector())
  useEffect(() => { director.setStage(stage) }, [director, stage])
  useEffect(() => () => director.dispose(), [director])
  return director
}
