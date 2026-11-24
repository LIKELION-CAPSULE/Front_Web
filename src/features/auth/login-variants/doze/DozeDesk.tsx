import { Suspense, lazy, useId, useState } from 'react'
import { capsuleLogo } from '@/shared/design/brand-logo'
import type { DozeSceneLayout } from './doze-view'
// The capsule alone (no tile), dark on transparent: the heatmap's input and the mask that keeps its light inside the
// capsule. Imported directly because brand-logo.ts only exposes the colour glyph and this draft is DEV-only.
import capsuleGlyphUrl from '../../../../../design/brand/capsule-logo-2026-11-22-v2/capsule-glyph-black.svg'

/** Heatmap shader logo (WebGL): its own lazy chunk, fetched only on the live path. */
const LidHeatmapLogo = lazy(() => import('./LidHeatmapLogo'))

/**
 * With `fit: contain` and `scale: 1` the Heatmap shader fills its box with the silhouette's own bounds (it crops the
 * padding its preprocessing adds). The box is made HEATMAP_BOX × the capsule and the picture scaled back by
 * 1/HEATMAP_BOX, so the heat lands exactly on the capsule of the static logo.
 */
const HEATMAP_BOX = 1.35
/** Lid symbol size relative to the first draft (2026-11-25: three quarters). */
const LOGO_SCALE = 0.75
/** Where the capsule glyph (viewBox 335×266) sits inside the symbol (viewBox 472×456): the glyph's translate(-75 -104). */
const GLYPH_IN_SYMBOL = { x: 75, y: 104, w: 335, h: 266, symbolW: 472, symbolH: 456 } as const

/**
 * The desk and laptop in front of the dozing mate (DEV-only login draft), drawn with inline SVG in stage px so it
 * scales with the framing (`k` = CSS px per model px).
 *
 * We sit across the desk from her: the laptop screen faces her, so we see the back of the lid (CAPSULE logo, a
 * post-it), its rim catching the screen light, the hinge and the near edge of the keyboard deck. The desk lamp of the
 * room (left of the background) pools warm light on the left of the desk top. A mug, an open workbook with a pencil and
 * a small capsule trinket sit quietly on the desk.
 */
export function DozeDesk({
  scene,
  width,
  height,
  screenOn,
  heatmap,
}: {
  scene: DozeSceneLayout
  width: number
  height: number
  /** The laptop wakes with her: rim light, logo glow and the light on her get a little brighter. */
  screenOn: boolean
  /** Live path only (not reduced motion, no-WebGL or the still path): the logo glows with the heatmap shader. */
  heatmap: boolean
}) {
  const [heatActive, setHeatActive] = useState(false)
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
  const id = (name: string) => `doze-${uid}-${name}`
  const url = (name: string) => `url(#${id(name)})`

  const { k, lid, deskTop } = scene
  const u = (v: number) => v * k

  // Desk: back edge of the visible top (behind the laptop, against her body), front edge, lip thickness.
  const surfaceTop = deskTop - u(20)
  const frontEdge = deskTop + u(34)
  const lipBottom = frontEdge + u(15)

  // Laptop: the base rests on the desk a little in front of `deskTop`.
  const baseBottom = deskTop + u(9)
  const baseTop = baseBottom - u(9)
  const lidBottom = baseTop - u(5)
  const cx = lid.left + lid.width / 2
  // The lid is one flat panel tipped toward us around its bottom edge (CSS perspective + rotateX, see `lid3d`), so its
  // outline, rim, highlights, logo, logo glow and post-it all share one projection: top edge LID_TOP_SCALE × wider than
  // the bottom edge. The bottom edge stays put, so hinge, deck and shadow below keep lining up with it.
  const lidBottomW = lid.width * 0.95
  const lidH = lidBottom - lid.top
  const tilt = (LID_TILT_DEG * Math.PI) / 180
  // Flat panel height whose projection is exactly `lidH` tall, and the perspective that widens its top by the scale.
  const flatH = lidH / (Math.cos(tilt) * LID_TOP_SCALE)
  const perspective = (lidH * Math.tan(tilt)) / (LID_TOP_SCALE - 1)
  const flatPath = roundedTrapezoid(0, lidBottomW, 0, 0, lidBottomW, flatH, u(15), u(6))
  // The symbol is LOGO_SCALE of its first size, shrunk toward its bottom edge (bottom and horizontal centre stay put).
  // The static logo, its glow, the heatmap box and its capsule mask all derive from these four numbers.
  const baseLogoW = Math.min(lidBottomW * 0.16, 72)
  const baseLogoH = baseLogoW * (456 / 472)
  const logoBottom = flatH * 0.46 + baseLogoH / 2
  const logoW = baseLogoW * LOGO_SCALE
  const logoH = baseLogoH * LOGO_SCALE
  const logoCx = lidBottomW / 2
  const logoCy = logoBottom - logoH / 2
  // The capsule's box inside the logo, and the shader box around it.
  const glyph = {
    cx: logoCx - logoW / 2 + ((GLYPH_IN_SYMBOL.x + GLYPH_IN_SYMBOL.w / 2) / GLYPH_IN_SYMBOL.symbolW) * logoW,
    cy: logoCy - logoH / 2 + ((GLYPH_IN_SYMBOL.y + GLYPH_IN_SYMBOL.h / 2) / GLYPH_IN_SYMBOL.symbolH) * logoH,
    w: (GLYPH_IN_SYMBOL.w / GLYPH_IN_SYMBOL.symbolW) * logoW,
    h: (GLYPH_IN_SYMBOL.h / GLYPH_IN_SYMBOL.symbolH) * logoH,
  }
  const heatW = glyph.w * HEATMAP_BOX
  const heatH = glyph.h * HEATMAP_BOX
  const note = { x: lidBottomW * 0.74, y: flatH * 0.14, w: lidBottomW * 0.145, h: lidBottomW * 0.135 }

  // Props, placed around the laptop in model px so they keep their size relation to her at every framing.
  const lidRight = lid.left + lid.width
  const mug = { x: lidRight + u(78), bottom: deskTop + u(22), w: u(48), h: u(56) }
  const pill = { x: lidRight + u(30), y: deskTop + u(27) }
  const book = { x: lid.left - u(118), top: deskTop + u(1), bottom: deskTop + u(25), wTop: u(132), wBottom: u(158) }
  const pool = { x: Math.min(lid.left - u(120), width * 0.2), y: deskTop + u(12) }

  return (
    <>
      <svg
        className="doze-desk-svg"
        width={width}
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        aria-hidden="true"
        focusable="false"
      >
        <defs>
          {/* Desk top: dark walnut, a touch lighter toward the front edge. */}
          <linearGradient id={id('top')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#1f1815" />
            <stop offset="1" stopColor="#32261f" />
          </linearGradient>
          <linearGradient id={id('lip')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a2d25" />
            <stop offset="0.35" stopColor="#261d18" />
            <stop offset="1" stopColor="#130f0d" />
          </linearGradient>
          <linearGradient id={id('under')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0f0d10" stopOpacity="0.96" />
            <stop offset="1" stopColor="#0f0e17" stopOpacity="0.98" />
          </linearGradient>
          {/* Front edge highlight: warm where the lamp light lands (left), cooler toward the right. */}
          <linearGradient id={id('edge')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#ffd9b8" stopOpacity="0.42" />
            <stop offset="0.35" stopColor="#f3dccb" stopOpacity="0.22" />
            <stop offset="1" stopColor="#d9d5f1" stopOpacity="0.1" />
          </linearGradient>
          {/* Her body meets the desk: a soft contact shadow along the back edge. */}
          <linearGradient id={id('contact')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.55" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </linearGradient>
          <radialGradient id={id('pool')} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffc996" stopOpacity="0.62" />
            <stop offset="0.45" stopColor="#ffb87a" stopOpacity="0.18" />
            <stop offset="1" stopColor="#ffb87a" stopOpacity="0" />
          </radialGradient>
          {/* Wood grain: stretched fractal noise, tinted warm, used as a faint overlay. */}
          <filter id={id('grain')} x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.0035 0.16" numOctaves="3" seed="7" />
            <feColorMatrix
              type="matrix"
              values="0 0 0 0 0.62  0 0 0 0 0.47  0 0 0 0 0.36  1.6 0 0 0 -0.62"
            />
          </filter>
          <clipPath id={id('surface')}>
            <rect x="0" y={surfaceTop} width={width} height={lipBottom - surfaceTop} />
          </clipPath>

          <linearGradient id={id('hinge')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#14131a" />
            <stop offset="0.45" stopColor="#4a4855" />
            <stop offset="1" stopColor="#121118" />
          </linearGradient>
          <linearGradient id={id('base')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#55535f" />
            <stop offset="0.3" stopColor="#34323d" />
            <stop offset="1" stopColor="#1a1922" />
          </linearGradient>
          <filter id={id('soft')} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={Math.max(2, u(6))} />
          </filter>
          <filter id={id('glow')} x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation={Math.max(2, u(5))} />
          </filter>
          {/* Mug: matte ceramic in a muted lavender grey. */}
          <linearGradient id={id('mug')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#403e4b" />
            <stop offset="0.38" stopColor="#8f8d9c" />
            <stop offset="0.55" stopColor="#a4a3b0" />
            <stop offset="1" stopColor="#2f2d38" />
          </linearGradient>
          <linearGradient id={id('page')} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#e6ddd2" />
            <stop offset="0.48" stopColor="#c9c0b5" />
            <stop offset="0.52" stopColor="#b7aea4" />
            <stop offset="1" stopColor="#d4cbc0" />
          </linearGradient>
        </defs>

        {/* ---------- Desk ---------- */}
        <rect x="0" y={surfaceTop} width={width} height={frontEdge - surfaceTop} fill={url('top')} />
        <g clipPath={url('surface')}>
          <rect x="0" y={surfaceTop} width={width} height={lipBottom - surfaceTop} filter={url('grain')} opacity="0.22" />
        </g>
        <rect x="0" y={surfaceTop} width={width} height={u(16)} fill={url('contact')} />
        <ellipse className="doze-desk-pool" cx={pool.x} cy={pool.y} rx={u(320)} ry={u(40)} fill={url('pool')} style={{ mixBlendMode: 'screen' }} />
        {/* The same lamp light on the front edge of the desk. */}
        <ellipse cx={pool.x} cy={frontEdge + u(4)} rx={u(260)} ry={u(10)} fill={url('pool')} style={{ mixBlendMode: 'screen' }} />
        <rect x="0" y={frontEdge} width={width} height={lipBottom - frontEdge} fill={url('lip')} />
        <rect x="0" y={lipBottom} width={width} height={Math.max(0, height - lipBottom)} fill={url('under')} />
        <rect x="0" y={frontEdge - 0.5} width={width} height="1.5" fill={url('edge')} />
        <rect x="0" y={lipBottom - 1} width={width} height="1" fill="#000" opacity="0.5" />

        {/* ---------- Workbook and pencil (in the lamp light) ---------- */}
        <ellipse cx={book.x} cy={book.bottom + u(2)} rx={book.wBottom * 0.55} ry={u(5)} fill="#000" opacity="0.45" filter={url('soft')} />
        <g className="doze-desk-prop">
          <path
            d={`M${book.x - book.wTop / 2} ${book.top} L${book.x + book.wTop / 2} ${book.top} L${book.x + book.wBottom / 2} ${book.bottom} L${book.x - book.wBottom / 2} ${book.bottom} Z`}
            fill={url('page')}
          />
          {/* Ruled lines on both pages, following the perspective. */}
          {[0.3, 0.52, 0.74].map((t) => {
            const y = book.top + (book.bottom - book.top) * t
            const half = (book.wTop + (book.wBottom - book.wTop) * t) / 2
            return (
              <g key={t} stroke="#8f8a9c" strokeOpacity="0.45" strokeWidth={Math.max(0.6, u(0.9))}>
                <line x1={book.x - half * 0.9} y1={y} x2={book.x - half * 0.08} y2={y} />
                <line x1={book.x + half * 0.08} y1={y} x2={book.x + half * 0.9} y2={y} />
              </g>
            )
          })}
          <line x1={book.x} y1={book.top} x2={book.x} y2={book.bottom} stroke="#6f6875" strokeOpacity="0.5" strokeWidth={Math.max(0.8, u(1.2))} />
          {/* Pencil lying across the right page. */}
          <g transform={`rotate(-7 ${book.x + u(30)} ${book.bottom - u(9)})`}>
            <rect x={book.x - u(8)} y={book.bottom - u(12)} width={u(78)} height={u(5)} rx={u(1.5)} fill="#7a6a8e" />
            <rect x={book.x - u(8)} y={book.bottom - u(12)} width={u(78)} height={u(1.6)} rx={u(0.8)} fill="#fff" opacity="0.25" />
            <path
              d={`M${book.x + u(70)} ${book.bottom - u(12)} L${book.x + u(82)} ${book.bottom - u(9.5)} L${book.x + u(70)} ${book.bottom - u(7)} Z`}
              fill="#d8c3a6"
            />
            <rect x={book.x - u(14)} y={book.bottom - u(12)} width={u(6)} height={u(5)} rx={u(1.5)} fill="#c4b9f3" opacity="0.8" />
          </g>
        </g>

        {/* ---------- Laptop ---------- */}
        <ellipse cx={cx} cy={baseBottom + u(1)} rx={lid.width * 0.6} ry={u(7)} fill="#000" opacity="0.6" filter={url('soft')} />
        {/* Keyboard deck: its near edge shows below the hinge, a little wider than the lid. */}
        <rect x={cx - lidBottomW * 0.53} y={baseTop} width={lidBottomW * 1.06} height={baseBottom - baseTop} rx={u(4)} fill={url('base')} />
        <rect x={cx - lidBottomW * 0.51} y={baseTop} width={lidBottomW * 1.02} height="1" fill="#fff" opacity="0.28" />
        {/* Hinge barrel. */}
        <rect x={cx - lidBottomW * 0.37} y={lidBottom - u(3)} width={lidBottomW * 0.74} height={baseTop - lidBottom + u(5)} rx={u(4)} fill={url('hinge')} />
        {/* ---------- Capsule trinket ---------- */}
        <ellipse cx={pill.x} cy={pill.y + u(5)} rx={u(15)} ry={u(3)} fill="#000" opacity="0.5" filter={url('soft')} />
        <g className="doze-desk-prop" transform={`rotate(-14 ${pill.x} ${pill.y})`}>
          <rect x={pill.x - u(14)} y={pill.y - u(5.5)} width={u(28)} height={u(11)} rx={u(5.5)} fill="#e1e0e8" />
          <path d={`M${pill.x - u(14) + u(5.5)} ${pill.y - u(5.5)} H${pill.x} V${pill.y + u(5.5)} H${pill.x - u(14) + u(5.5)} A${u(5.5)} ${u(5.5)} 0 0 1 ${pill.x - u(14) + u(5.5)} ${pill.y - u(5.5)} Z`} fill="#7e54f6" />
          <rect x={pill.x - u(11)} y={pill.y - u(4)} width={u(20)} height={u(2)} rx={u(1)} fill="#fff" opacity="0.45" />
        </g>

        {/* ---------- Mug with a faint curl of steam ---------- */}
        <ellipse cx={mug.x} cy={mug.bottom + u(2)} rx={mug.w * 0.75} ry={u(5)} fill="#000" opacity="0.5" filter={url('soft')} />
        <g className="doze-desk-prop">
          <path
            d={`M${mug.x + mug.w * 0.42} ${mug.bottom - mug.h * 0.78} c${u(18)} 0 ${u(18)} ${mug.h * 0.5} 0 ${mug.h * 0.52}`}
            fill="none"
            stroke="#6c6a78"
            strokeWidth={u(6)}
            strokeLinecap="round"
          />
          <path
            d={`M${mug.x - mug.w / 2} ${mug.bottom - mug.h} V${mug.bottom - u(6)} q0 ${u(6)} ${u(6)} ${u(6)} H${mug.x + mug.w / 2 - u(6)} q${u(6)} 0 ${u(6)} ${-u(6)} V${mug.bottom - mug.h} Z`}
            fill={url('mug')}
          />
          <ellipse cx={mug.x} cy={mug.bottom - mug.h} rx={mug.w / 2} ry={u(5)} fill="#b9b7c4" />
          <ellipse cx={mug.x} cy={mug.bottom - mug.h + u(0.6)} rx={mug.w / 2 - u(3)} ry={u(3.6)} fill="#2a1c16" />
        </g>
        <g className="doze-desk-steam" fill="none" stroke="#fff" strokeLinecap="round" strokeWidth={Math.max(1, u(2.2))}>
          <path d={`M${mug.x - u(6)} ${mug.bottom - mug.h - u(6)} c${-u(8)} ${-u(10)} ${u(8)} ${-u(18)} 0 ${-u(30)}`} />
          <path d={`M${mug.x + u(7)} ${mug.bottom - mug.h - u(8)} c${u(8)} ${-u(10)} ${-u(8)} ${-u(18)} 0 ${-u(28)}`} />
        </g>
      </svg>

      {/* ---------- Laptop lid: flat panel, tipped toward us (one projection for everything on it) ---------- */}
      <div
        className="doze-lid3d"
        data-screen={screenOn ? 'on' : undefined}
        data-heat={(heatmap && heatActive) || undefined}
        style={{
          left: `${cx - lidBottomW / 2}px`,
          top: `${lidBottom - flatH}px`,
          width: `${lidBottomW}px`,
          height: `${flatH}px`,
          transform: `perspective(${perspective}px) rotateX(${-LID_TILT_DEG}deg)`,
        }}
      >
        <svg width={lidBottomW} height={flatH} viewBox={`0 0 ${lidBottomW} ${flatH}`} overflow="visible" aria-hidden="true" focusable="false">
          <defs>
            {/* Lid back: anodized dark aluminium with a diagonal sheen. */}
            <linearGradient id={id('lid')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#3d3b48" />
              <stop offset="0.55" stopColor="#2a2833" />
              <stop offset="1" stopColor="#1c1b24" />
            </linearGradient>
            <linearGradient id={id('sheen')} x1="0" y1="0" x2="1" y2="0.55">
              <stop offset="0" stopColor="#fff" stopOpacity="0" />
              <stop offset="0.3" stopColor="#fff" stopOpacity="0.09" />
              <stop offset="0.42" stopColor="#fff" stopOpacity="0.02" />
              <stop offset="0.6" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={id('rim')} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#f0efff" stopOpacity="0.5" />
              <stop offset="0.25" stopColor="#d9d5f1" stopOpacity="0.16" />
              <stop offset="1" stopColor="#d9d5f1" stopOpacity="0.05" />
            </linearGradient>
            <linearGradient id={id('lampSide')} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stopColor="#ffcfa3" stopOpacity="0.16" />
              <stop offset="0.12" stopColor="#ffcfa3" stopOpacity="0.04" />
              <stop offset="0.3" stopColor="#ffcfa3" stopOpacity="0" />
            </linearGradient>
            <clipPath id={id('lidClip')}>
              <path d={flatPath} />
            </clipPath>
            <filter id={id('lidGlow')} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation={Math.max(2, u(5))} />
            </filter>
            <filter id={id('logoGlow')} x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation={Math.max(3, logoW * 0.16)} />
              <feColorMatrix type="matrix" values="0 0 0 0 0.75  0 0 0 0 0.7  0 0 0 0 1  0 0 0 1 0" />
            </filter>

          </defs>
          {/* Screen light leaking around the rim (the screen faces her). */}
          <path className="doze-desk-rimlight" d={flatPath} fill="none" stroke="#c9c4ff" strokeWidth={u(5)} filter={url('lidGlow')} />
          <path d={flatPath} fill={url('lid')} />
          <g clipPath={url('lidClip')}>
            <rect x="0" y="0" width={lidBottomW} height={flatH} fill={url('sheen')} />
            {/* Lamp light from the left grazing the lid's left side; a soft inner bevel all round. */}
            <rect x="0" y="0" width={lidBottomW} height={flatH} fill={url('lampSide')} />
            <path d={flatPath} fill="none" stroke="#000" strokeOpacity="0.35" strokeWidth={Math.max(2, u(7))} filter={url('lidGlow')} />
            {/* Post-it on the upper right. */}
            <g transform={`rotate(7 ${note.x + note.w / 2} ${note.y + note.h / 2})`}>
              <rect x={note.x + u(2)} y={note.y + u(3)} width={note.w} height={note.h} rx={u(1.5)} fill="#000" opacity="0.3" />
              <rect x={note.x} y={note.y} width={note.w} height={note.h} rx={u(1.5)} fill="#d9d5f1" opacity="0.82" />
              <path
                d={`M${note.x + note.w * 0.18} ${note.y + note.h * 0.4} q${note.w * 0.2} ${-u(3)} ${note.w * 0.42} 0 t${note.w * 0.22} 0`}
                fill="none"
                stroke="#6b5f8f"
                strokeOpacity="0.6"
                strokeWidth={Math.max(0.8, u(1.4))}
                strokeLinecap="round"
              />
              <circle cx={note.x + note.w * 0.78} cy={note.y + note.h * 0.72} r={Math.max(1, u(2.4))} fill="#e24c9a" opacity="0.55" />
            </g>
          </g>
          {/* Rim: the lid's thickness catching light, brightest on the top edge. */}
          <path d={flatPath} fill="none" stroke={url('rim')} strokeWidth={Math.max(1, u(2))} />
          <path d={`M${u(14)} ${u(1.2)} L${lidBottomW - u(14)} ${u(1.2)}`} stroke="#fff" strokeOpacity="0.35" strokeWidth="1" />
          {/* CAPSULE logo glowing through the lid. */}
          <image
            className="doze-desk-logoglow"
            href={capsuleLogo.symbol.white}
            x={logoCx - logoW / 2}
            y={logoCy - logoH / 2}
            width={logoW}
            height={logoH}
            filter={url('logoGlow')}
          />
          <image
            className="doze-desk-logo"
            href={capsuleLogo.symbol.white}
            x={logoCx - logoW / 2}
            y={logoCy - logoH / 2}
            width={logoW}
            height={logoH}
          />
        </svg>
        {/* On the same plane as the lid, so it takes the same perspective. */}
        {heatmap && (
          <div
            className="doze-heatmap"
            data-awake={screenOn || undefined}
            data-active={heatActive || undefined}
            style={{
              left: `${glyph.cx - heatW / 2}px`,
              top: `${glyph.cy - heatH / 2}px`,
              width: `${heatW}px`,
              height: `${heatH}px`,
              // Light only inside the capsule: the glyph itself is the mask, sized to the capsule inside the box.
              WebkitMaskImage: `url(${capsuleGlyphUrl})`,
              maskImage: `url(${capsuleGlyphUrl})`,
              WebkitMaskSize: `${100 / HEATMAP_BOX}% ${100 / HEATMAP_BOX}%`,
              maskSize: `${100 / HEATMAP_BOX}% ${100 / HEATMAP_BOX}%`,
            }}
          >
            <Suspense fallback={null}>
              <LidHeatmapLogo
                awake={screenOn}
                silhouette={capsuleGlyphUrl}
                width={heatW}
                height={heatH}
                scale={1 / HEATMAP_BOX}
                onActiveChange={setHeatActive}
              />
            </Suspense>
          </div>
        )}
      </div>
    </>
  )
}

/** Lid tilt toward the viewer and how much wider its top edge looks than its bottom edge (~12 %). */
const LID_TILT_DEG = 20
const LID_TOP_SCALE = 1.12

/** Closed path of a trapezoid with rounded corners (top corners `rt`, bottom corners `rb`). */
function roundedTrapezoid(
  x0t: number,
  x1t: number,
  yt: number,
  x0b: number,
  x1b: number,
  yb: number,
  rt: number,
  rb: number,
): string {
  return [
    `M${x0t + rt} ${yt}`,
    `L${x1t - rt} ${yt}`,
    `Q${x1t} ${yt} ${x1t} ${yt + rt}`,
    `L${x1b} ${yb - rb}`,
    `Q${x1b} ${yb} ${x1b - rb} ${yb}`,
    `L${x0b + rb} ${yb}`,
    `Q${x0b} ${yb} ${x0b} ${yb - rb}`,
    `L${x0t} ${yt + rt}`,
    `Q${x0t} ${yt} ${x0t + rt} ${yt}`,
    'Z',
  ].join(' ')
}
