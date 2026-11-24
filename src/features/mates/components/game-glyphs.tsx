import { useId } from 'react'
import type { CapsuleJarTheme } from '@/features/mates/capsule-jar/capsule-jar-types'

/**
 * Small game-like pictures of the my-mates 「함께한 시간」 column, drawn as SVG (no image assets):
 * the glass capsule of the scene in the mate's colours, the stage crest and the sparkle.
 * All decorative: the text next to them carries the meaning.
 */

/**
 * The scene's two-tone glass capsule (frosted half, tinted half, the seam and a glowing core), lying at an angle.
 * Same colours as the 3D capsules (capsule-jar-theme.ts).
 */
export function CapsuleGlyph({ theme, size = 40, className }: { theme: CapsuleJarTheme; size?: number; className?: string }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 48 48" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-light`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.55" stopColor={theme.lightHalf} />
          <stop offset="1" stopColor={theme.lightHalfShade} />
        </linearGradient>
        <linearGradient id={`${id}-tint`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={theme.tintHalf} />
          <stop offset="1" stopColor={theme.tintHalfShade} />
        </linearGradient>
        <radialGradient id={`${id}-core`}>
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.35" stopColor={theme.glow} stopOpacity="0.9" />
          <stop offset="1" stopColor={theme.glow} stopOpacity="0" />
        </radialGradient>
        <clipPath id={`${id}-body`}>
          <rect x="6" y="17" width="36" height="15" rx="7.5" />
        </clipPath>
      </defs>
      <g transform="rotate(-28 24 24)">
        <ellipse cx="24" cy="35.5" rx="15" ry="2.4" fill="#000" opacity="0.35" />
        <g clipPath={`url(#${id}-body)`}>
          <rect x="6" y="17" width="20" height="15" fill={`url(#${id}-light)`} opacity="0.92" />
          <rect x="26" y="17" width="16" height="15" fill={`url(#${id}-tint)`} />
          <rect x="25.2" y="17" width="1.6" height="15" fill="#FFFFFF" opacity="0.55" />
          <circle cx="24" cy="24.5" r="9" fill={`url(#${id}-core)`} />
          <rect x="9" y="19" width="28" height="3" rx="1.5" fill="#FFFFFF" opacity="0.55" />
        </g>
        <rect x="6.5" y="17.5" width="35" height="14" rx="7" fill="none" stroke="#FFFFFF" strokeOpacity="0.45" />
      </g>
    </svg>
  )
}

/** Stage crest: a violet gem shield with a pearl-white rim, small wings and the stage number (a level badge). */
export function StageCrest({ stage, size = 58 }: { stage: number; size?: number }) {
  const id = useId().replace(/:/g, '')
  return (
    <svg className="mate-crest" width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="0.5" stopColor="#D9CFFF" />
          <stop offset="1" stopColor="#9B84F0" />
        </linearGradient>
        <linearGradient id={`${id}-gem`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B49CFF" />
          <stop offset="0.55" stopColor="#7E54F6" />
          <stop offset="1" stopColor="#3F2A8C" />
        </linearGradient>
      </defs>
      {/* wings */}
      <path d="M14 26 C6 24 3 30 4 36 C9 33 12 34 15 36 Z" fill={`url(#${id}-rim)`} opacity="0.75" />
      <path d="M50 26 C58 24 61 30 60 36 C55 33 52 34 49 36 Z" fill={`url(#${id}-rim)`} opacity="0.75" />
      {/* shield */}
      <path d="M32 6 L51 13 L49 36 C47 46 40 53 32 58 C24 53 17 46 15 36 L13 13 Z" fill={`url(#${id}-rim)`} />
      <path d="M32 10.5 L47 16 L45.4 35.4 C43.8 43.6 38.6 49.4 32 53.4 C25.4 49.4 20.2 43.6 18.6 35.4 L17 16 Z" fill={`url(#${id}-gem)`} />
      <path d="M32 10.5 L47 16 L46.4 23 C40 20 26 19 17.6 23 L17 16 Z" fill="#FFFFFF" opacity="0.18" />
      <text x="32" y="40" textAnchor="middle" fontSize="22" fontWeight="900" fill="#FFFFFF" style={{ paintOrder: 'stroke' }} stroke="#2A1A66" strokeWidth="1.2">
        {stage}
      </text>
      {/* top star */}
      <path d="M32 0.8 L33.6 4.6 L37.6 5.4 L33.6 6.4 L32 10 L30.4 6.4 L26.4 5.4 L30.4 4.6 Z" fill="#FFFFFF" />
    </svg>
  )
}

/** Four-point sparkle in the current text colour (twinkles via CSS). */
export function Sparkle({ className }: { className?: string }) {
  return <span className={className ? `mate-sparkle ${className}` : 'mate-sparkle'} aria-hidden="true" />
}
