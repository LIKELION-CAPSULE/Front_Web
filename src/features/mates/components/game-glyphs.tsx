import { useId } from 'react'
import type { CapsuleJarTheme } from '@/features/mates/capsule-jar/capsule-jar-types'

/**
 * The small capsule picture of the my-mates column's recent list, drawn as SVG (no image assets): the scene's glass
 * capsule in the mate's colours. Decorative: the text next to it carries the meaning.
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
