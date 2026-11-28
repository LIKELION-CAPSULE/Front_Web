export const capsuleFoil = {
  angle: 118,
  scale: 2.6,
  stops: [[0, '#82f5d8'], [.12, '#96c9ff'], [.25, '#d5abff'], [.37, '#ffb7da'], [.5, '#ffe1a2'], [.62, '#9aead3'], [.75, '#9bc7ff'], [.88, '#eab6f7'], [1, '#82f5d8']],
  darkOpacity: .42,
  lightOpacity: .16,
  glitterOpacity: .2,
  glareOpacity: .4,
} as const

/**
 * The same foil within the design palette (violet and white only, no rainbow) for the record card of a capsule
 * (docs/DESIGN_SYSTEM.md: 캡슐 카드는 팔레트 범위의 효과). Same angle and scale as `capsuleFoil`.
 */
export const capsulePaletteFoil = {
  stops: [[0, '#ffffff'], [0.16, '#d9ccff'], [0.32, '#a98bff'], [0.5, '#f4efff'], [0.66, '#c4b4ff'], [0.84, '#ffffff'], [1, '#ffffff']],
  darkOpacity: 0.34,
  glitterOpacity: 0.22,
  glareOpacity: 0.4,
} as const

export const capsulePaletteFoilGradient = `repeating-linear-gradient(${capsuleFoil.angle}deg, ${capsulePaletteFoil.stops.map(([offset, color]) => `${color} ${offset * 100}%`).join(', ')})`
