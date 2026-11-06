import { clamp01, ease, DOT_FORM_START_MS, DOT_FORM_END_MS } from './prepare-capsule-motion.ts'

export const HALFTONE_FEATHER = .16

/** Fit the entire poster inside the physical form bounds, without changing its aspect ratio. */
export function preparePosterBounds(sourceWidth: number, sourceHeight: number, width: number, height: number) {
  const scale = Math.min(width / sourceWidth, height / sourceHeight)
  const fittedWidth = sourceWidth * scale, fittedHeight = sourceHeight * scale
  return { x: (width - fittedWidth) / 2, y: (height - fittedHeight) / 2, width: fittedWidth, height: fittedHeight }
}

export function prepareHalftoneProgress(elapsed: number) {
  return clamp01((elapsed - DOT_FORM_START_MS) / (DOT_FORM_END_MS - DOT_FORM_START_MS))
}

/** x/y run from the form's top-left (0,0) to its bottom-right (1,1). */
export function prepareHalftoneReveal(progress: number, x: number, y: number) {
  return ease((clamp01(progress) * (1 + HALFTONE_FEATHER) - (x + y) / 2) / HALFTONE_FEATHER)
}

/** The snapshot and particle grid use the same diagonal wave and feather. */
export const prepareHalftoneFragment = `
  float prepareDiagonal = (vMapUv.x + 1.0 - vMapUv.y) * 0.5;
  float prepareReveal = smoothstep(prepareDiagonal, prepareDiagonal + ${HALFTONE_FEATHER.toFixed(4)}, uPrepareHalftoneProgress * ${(1 + HALFTONE_FEATHER).toFixed(4)});
  diffuseColor.a *= 1.0 - prepareReveal;
  // Keep the UI snapshot behind the solid capsule, including the back of its open cavity.
  gl_FragDepth = 1.0;
`
