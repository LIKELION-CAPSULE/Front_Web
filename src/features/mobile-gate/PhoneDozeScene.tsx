import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { chaerinArtwork } from '@/features/mates/artwork'
import { ALIVING_MODEL_SIZE, CHAERIN_V2_LANDMARKS } from '@/features/mate-render/aliving-view'
import { DOZE_FRAMING, computeDozeScene, type DozeCamera, type DozeSceneLayout } from '@/features/auth/login-variants/doze/doze-view'
import { DozeDesk } from '@/features/auth/login-variants/doze/DozeDesk'
import dozeStillUrl from '@/assets/characters/chaerin-v2/chaerin-v2-doze.webp'
import '@/features/auth/login-variants/doze/doze.css'

/**
 * The login screen's 「노트북 앞에서 조는 채린」 (same still, desk and laptop, z z Z and nod; doze-view geometry), framed for
 * a portrait phone box. Decoration only: the words of the screen say what it is.
 */

/**
 * doze-view.ts `computeDozeCamera` with phone numbers: the desk front sits `deskFront` px above the box's bottom and
 * she may be zoomed in further (`minModelWidth`; a little hair at the sides may leave the frame, never the face).
 */
function phoneDozeCamera(cw: number, ch: number, deskFront: number, minModelWidth: number, headMargin: number): DozeCamera {
  const { headTopY, centerX } = CHAERIN_V2_LANDMARKS
  const { deskTopModelY } = DOZE_FRAMING
  const kHeight = (ch - deskFront - headMargin * ch) / (deskTopModelY - headTopY)
  const k = Math.max(0.0001, Math.min(kHeight, cw / minModelWidth))
  const cy = deskTopModelY - (ch / 2 - deskFront) / k
  return { view: { zoom: (k * ALIVING_MODEL_SIZE) / Math.max(1, Math.min(cw, ch)), cx: centerX, cy }, k }
}

function useBoxSize<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [size, setSize] = useState<{ w: number; h: number } | null>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => setSize(prev => {
      const w = Math.round(el.clientWidth), h = Math.round(el.clientHeight)
      return prev && prev.w === w && prev.h === h ? prev : { w, h }
    })
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, size] as const
}

export function PhoneDozeScene({ deskFront, minModelWidth, headMargin, className }: {
  /** Desk front above the box's bottom: a share of the box height. */
  deskFront: number
  minModelWidth: number
  headMargin: number
  className: string
}) {
  const reduced = useReducedMotion()
  const [ref, size] = useBoxSize<HTMLDivElement>()
  let scene: DozeSceneLayout | null = null
  if (size && size.w > 0 && size.h > 0) {
    scene = computeDozeScene(size.w, size.h, phoneDozeCamera(size.w, size.h, size.h * deskFront, minModelWidth, headMargin))
  }
  const box = (b: { left: number; top: number; width: number; height: number }): CSSProperties =>
    ({ left: `${b.left}px`, top: `${b.top}px`, width: `${b.width}px`, height: `${b.height}px` })

  return (
    <div ref={ref} className={`mg-scene ${className}`} aria-hidden="true">
      <img src={chaerinArtwork.callBackground.portrait} alt="" className="mg-room" draggable={false} />
      {scene && size && <>
        <i className="doze-face-light" style={{ left: `${scene.face.x}px`, top: `${scene.face.y + 70 * scene.k}px`, width: `${520 * scene.k}px`, height: `${460 * scene.k}px` }} />
        <img
          src={dozeStillUrl}
          alt=""
          className="doze-still mg-still"
          data-visible="true"
          data-nodding={!reduced || undefined}
          draggable={false}
          decoding="async"
          style={box(scene.still)}
        />
        <i className="doze-screen-light" style={{ ...box(scene.still), WebkitMaskImage: `url(${dozeStillUrl})`, maskImage: `url(${dozeStillUrl})` }} />
        <DozeDesk scene={scene} width={size.w} height={size.h} screenOn={false} heatmap={false} />
        <div className="doze-zz" style={{ left: `${scene.zz.x}px`, top: `${scene.zz.y}px`, '--k': scene.k } as CSSProperties}>
          <span>z</span>
          <span>z</span>
          <span>Z</span>
        </div>
      </>}
    </div>
  )
}
