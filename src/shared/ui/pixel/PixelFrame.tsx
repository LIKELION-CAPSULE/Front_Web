import type { CSSProperties } from 'react'
import { cn } from '@/shared/lib/cn'
import { PIXEL_ART, pixelArtSize, pixelArtUrl, type PixelArtName } from './pixel-art'
import './pixel-frame.css'

/**
 * The pixel frame of modals and notifications (design B2 「픽셀 프레임」, user decision 2026-11-26): stepped pixel
 * corners, a dithered night roof with the 8-bit CAPSULE capsule, and pixel snow that falls from the roof over the body
 * and fades out around the middle. Decoration only: everything here is aria-hidden and ignores the pointer.
 */

/** Icon in front of a dialog title. `credit` keeps the credit gold (credit display exception). */
export type PixelTone = 'danger' | 'info' | 'celebrate' | 'credit'

const TONE_ART: Record<PixelTone, PixelArtName> = { danger: 'warning', info: 'info', celebrate: 'star', credit: 'coin' }

/** One pixel picture, drawn at `scale` CSS px per art pixel from a single data URL. */
export function PixelImage({ name, scale = 2, className, style }: { name: PixelArtName; scale?: number; className?: string; style?: CSSProperties }) {
  const art = PIXEL_ART[name]
  return <span className={cn('px-image', className)} style={{ ...pixelArtSize(art, scale), backgroundImage: pixelArtUrl(art), ...style }} aria-hidden="true" />
}

export function PixelToneIcon({ tone, className }: { tone: PixelTone; className?: string }) {
  return <PixelImage name={TONE_ART[tone]} className={cn('px-tone-icon', className)} />
}

type Flake = { art: PixelArtName; x: number; s: number; at: number; rest: number }
/**
 * x: % across; s: seconds for one fall over the snow layer; at: start offset (negative = already falling, so the first
 * frame is not empty); rest: where it stays (% of the fall) when motion is reduced.
 */
const SNOW: readonly Flake[] = [
  { art: 'snowDot', x: 9, s: 13, at: -3, rest: 30 },
  { art: 'snowFlakeLilac', x: 22, s: 17, at: -11, rest: 62 },
  { art: 'snowDotLilac', x: 37, s: 15, at: -7, rest: 18 },
  { art: 'snowFlake', x: 63, s: 18, at: -14, rest: 48 },
  { art: 'snowDot', x: 78, s: 14, at: -5, rest: 74 },
  { art: 'snowDotLilac', x: 91, s: 16, at: -9, rest: 36 },
]
/** Celebration (a world opened, …): denser and a little livelier snow. */
const CELEBRATION_SNOW: readonly Flake[] = [
  ...SNOW,
  { art: 'snowFlake', x: 15, s: 11, at: -6, rest: 52 },
  { art: 'snowDot', x: 30, s: 12, at: -1, rest: 80 },
  { art: 'snowDotLilac', x: 45, s: 10, at: -8, rest: 40 },
  { art: 'snowFlakeLilac', x: 55, s: 13, at: -4, rest: 22 },
  { art: 'snowDot', x: 70, s: 11, at: -9, rest: 66 },
  { art: 'snowFlake', x: 85, s: 12, at: -2, rest: 12 },
  { art: 'snowDotLilac', x: 96, s: 10, at: -5, rest: 58 },
]

/**
 * Snow and the capsule of a dialog's roof. The snow layer spans the top ~60% of the dialog under the text (z-index -1)
 * and is masked to fade out from below the roof; each flake rides a full-height track moved with transform only.
 */
export function PixelSnowfall({ celebrate = false, capsule = true }: { celebrate?: boolean; capsule?: boolean }) {
  return <>
    <span className="px-snow" aria-hidden="true">
      {(celebrate ? CELEBRATION_SNOW : SNOW).map((flake, index) => <span
        key={index}
        className="px-snow-track"
        style={{ left: `${flake.x}%`, '--px-fall': `${flake.s}s`, '--px-at': `${flake.at}s`, '--px-rest': `${flake.rest - 100}%` } as CSSProperties}
      ><PixelImage name={flake.art} /></span>)}
    </span>
    {capsule && <span className="px-roof-capsule" aria-hidden="true">
      <PixelImage name="capsule" />
      {celebrate && <>
        <PixelImage name="spark" className="px-roof-spark px-roof-spark--a" />
        <PixelImage name="spark" className="px-roof-spark px-roof-spark--b" />
        <PixelImage name="spark" scale={1} className="px-roof-spark px-roof-spark--c" />
      </>}
    </span>}
  </>
}

/** The thin roof of a dialog that draws its own layout (계정 설정): dithered night strip and the capsule. */
export function PixelRoofStrip() {
  return <span className="px-roof-strip" aria-hidden="true"><PixelImage name="capsule" /></span>
}
