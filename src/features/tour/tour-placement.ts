/**
 * Where 채린's line goes so it does not cover the page's own controls (service tour). Dependency-free: the controller
 * measures the screen and asks here. A candidate box costs the area it shares with each control near the target, with
 * the tour panel, and what falls off screen (weighted); the cheapest wins. Among the equally cheap, the one covering
 * the least of the screen's subjects (the target itself, the step's other targets, headings — UX review 9-1) wins, then
 * the step's preferred side.
 */

export type Box = { left: number; top: number; right: number; bottom: number }
export type Size = { width: number; height: number }
export type Point = { x: number; y: number }

/** The cursor label's four places around the arrow tip (showcase-pointer anchor: 19px right / 27px down by default). */
export type LabelSide = 'right-down' | 'left-down' | 'right-up' | 'left-up'
export const LABEL_SIDES: readonly LabelSide[] = ['right-down', 'left-down', 'right-up', 'left-up']

/** How far inside the screen's sides the line stays. */
export const LABEL_EDGE = 16

/**
 * How far the label slides sideways to stay on screen (`screenWidth` given; service-tour.css
 * `--service-tour-label-shift`): it sits above or below the arrow's row, so sliding never puts it over the arrow.
 */
export function labelShift(side: LabelSide, tip: Point, size: Size, screenWidth?: number): number {
  if (!screenWidth) return 0
  const left = side.startsWith('right') ? tip.x + 19 : tip.x - 8 - size.width
  if (left + size.width > screenWidth - LABEL_EDGE) return Math.max(LABEL_EDGE - left, screenWidth - LABEL_EDGE - size.width - left)
  if (left < LABEL_EDGE) return LABEL_EDGE - left
  return 0
}

/**
 * Mirrors service-tour.css: right of the tip at +19px, left ending 8px before it; below at +27px; above ending 6px over
 * the target's top edge (`lift` = how far the tip sits below that edge), so a label above never covers the target's row.
 * With `screenWidth`, slid sideways to stay on screen (labelShift).
 */
export function labelBox(side: LabelSide, tip: Point, size: Size, lift = 0, screenWidth?: number): Box {
  const left = (side.startsWith('right') ? tip.x + 19 : tip.x - 8 - size.width) + labelShift(side, tip, size, screenWidth)
  const top = side.endsWith('down') ? tip.y + 27 : tip.y - lift - 6 - size.height
  return { left, top, right: left + size.width, bottom: top + size.height }
}

export function overlap(a: Box, b: Box): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  return width > 0 && height > 0 ? width * height : 0
}

export type Avoid = {
  controls: readonly Box[]
  panel?: Box | null
  viewport: Size
  margin?: number
  /**
   * What the line is explained over and should leave readable (the target, the step's other targets, headings). Only a
   * tie-break: covering a control, the panel or the screen edge still costs first.
   */
  subjects?: readonly Box[]
}

export function cost(box: Box, avoid: Avoid): number {
  const margin = avoid.margin ?? 8
  // Controls get a small margin so the line does not sit flush against them either.
  const grown = (control: Box) => ({ left: control.left - margin, top: control.top - margin, right: control.right + margin, bottom: control.bottom + margin })
  let total = 0
  for (const control of avoid.controls) total += overlap(box, grown(control))
  if (avoid.panel) total += overlap(box, grown(avoid.panel)) * 2
  const area = (box.right - box.left) * (box.bottom - box.top)
  const inside = overlap(box, { left: margin, top: margin, right: avoid.viewport.width - margin, bottom: avoid.viewport.height - margin })
  total += (area - inside) * 3
  return total
}

/** The area of the box over the subjects (see Avoid). */
export function subjectCost(box: Box, avoid: Avoid): number {
  let total = 0
  for (const subject of avoid.subjects ?? []) total += overlap(box, subject)
  return total
}

/**
 * The cheapest of the boxes; among the equally cheap, the one over the least of the subjects; the first one (the
 * preferred place) wins a tie.
 */
export function cheapest<T extends { box: Box }>(candidates: readonly T[], avoid: Avoid): T {
  let best = candidates[0]!
  let bestCost = cost(best.box, avoid)
  let bestCover = subjectCost(best.box, avoid)
  for (const candidate of candidates.slice(1)) {
    const value = cost(candidate.box, avoid)
    const cover = subjectCost(candidate.box, avoid)
    if (value < bestCost - 0.5 || (Math.abs(value - bestCost) <= 0.5 && cover < bestCover - 0.5)) {
      best = candidate
      bestCost = value
      bestCover = cover
    }
  }
  return best
}

/**
 * A line with no target (the outro): where the arrow rests and the side of its line. The points are tried in order
 * (viewport px, preferred first), each with every side; the cheapest place wins (see `cheapest`).
 */
export function chooseRestingPlace(points: readonly Point[], size: Size, avoid: Avoid, preferred: LabelSide = 'right-down'): { tip: Point; side: LabelSide } {
  const sides = [preferred, ...LABEL_SIDES.filter((side) => side !== preferred)]
  const candidates = points.flatMap((tip) => sides.map((side) => ({ tip, side, box: labelBox(side, tip, size, 0, avoid.viewport.width) })))
  const { tip, side } = cheapest(candidates, avoid)
  return { tip, side }
}

/** The cursor label's side for an arrow tip, preferred side first. */
export function chooseLabelSide(tip: Point, size: Size, avoid: Avoid, preferred: LabelSide = 'right-down', lift = 0): LabelSide {
  const order = [preferred, ...LABEL_SIDES.filter((side) => side !== preferred)]
  return cheapest(order.map((side) => ({ side, box: labelBox(side, tip, size, lift, avoid.viewport.width) })), avoid).side
}

/**
 * Reduced motion: the line beside the lit target (spot = the target with its padding): below, above (left-aligned, then
 * right-aligned), right, left, then centred and end-aligned variants — and,
 * for a target too large to leave room around it, just inside its top edge (last, so only when the rest cost more).
 */
export function chooseLineBox(spot: Box, size: Size, avoid: Avoid, gap = 12): Box {
  const viewportWidth = avoid.viewport.width
  const alignedLeft = Math.max(16, Math.min(spot.left, viewportWidth - size.width - 16))
  // Ending at the target's right edge: for a small target at the right of its card (the home card's arrow).
  const alignedRight = Math.max(16, Math.min(spot.right - size.width, viewportWidth - size.width - 16))
  const middle = Math.max(16, (spot.top + spot.bottom) / 2 - size.height / 2)
  const at = (left: number, top: number): Box => ({ left, top, right: left + size.width, bottom: top + size.height })
  const centred = Math.max(16, Math.min((spot.left + spot.right) / 2 - size.width / 2, viewportWidth - size.width - 16))
  const topAligned = Math.max(16, spot.top)
  const bottomAligned = Math.max(16, spot.bottom - size.height)
  const candidates = [
    at(alignedLeft, spot.bottom + gap),
    at(alignedLeft, spot.top - gap - size.height),
    at(alignedRight, spot.bottom + gap),
    at(alignedRight, spot.top - gap - size.height),
    at(spot.right + gap, middle),
    at(spot.left - gap - size.width, middle),
    // Larger lit areas (a step's marks together) leave fewer free sides: centred, and beside them at either end.
    at(centred, spot.bottom + gap),
    at(centred, spot.top - gap - size.height),
    at(spot.right + gap, topAligned),
    at(spot.right + gap, bottomAligned),
    at(spot.left - gap - size.width, topAligned),
    at(spot.left - gap - size.width, bottomAligned),
    at(alignedLeft + gap, spot.top + gap),
  ].map((box) => ({ box }))
  return cheapest(candidates, avoid).box
}
