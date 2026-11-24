/**
 * Where 채린's line goes so it does not cover the page's own controls (service tour). Dependency-free: the controller
 * measures the screen and asks here. A candidate box costs the area it shares with each control near the target, with
 * the tour panel, and what falls off screen (weighted); the cheapest wins, the step's preferred side on a tie.
 */

export type Box = { left: number; top: number; right: number; bottom: number }
export type Size = { width: number; height: number }
export type Point = { x: number; y: number }

/** The cursor label's four places around the arrow tip (showcase-pointer anchor: 19px right / 27px down by default). */
export type LabelSide = 'right-down' | 'left-down' | 'right-up' | 'left-up'
export const LABEL_SIDES: readonly LabelSide[] = ['right-down', 'left-down', 'right-up', 'left-up']

/**
 * Mirrors service-tour.css: right of the tip at +19px, left ending 8px before it; below at +27px; above ending 6px over
 * the target's top edge (`lift` = how far the tip sits below that edge), so a label above never covers the target's row.
 */
export function labelBox(side: LabelSide, tip: Point, size: Size, lift = 0): Box {
  const left = side.startsWith('right') ? tip.x + 19 : tip.x - 8 - size.width
  const top = side.endsWith('down') ? tip.y + 27 : tip.y - lift - 6 - size.height
  return { left, top, right: left + size.width, bottom: top + size.height }
}

export function overlap(a: Box, b: Box): number {
  const width = Math.min(a.right, b.right) - Math.max(a.left, b.left)
  const height = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top)
  return width > 0 && height > 0 ? width * height : 0
}

export type Avoid = { controls: readonly Box[]; panel?: Box | null; viewport: Size; margin?: number }

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

/** The cheapest of the boxes; the first one (the preferred place) wins a tie. */
export function cheapest<T extends { box: Box }>(candidates: readonly T[], avoid: Avoid): T {
  let best = candidates[0]!
  let bestCost = cost(best.box, avoid)
  for (const candidate of candidates.slice(1)) {
    const value = cost(candidate.box, avoid)
    if (value < bestCost - 0.5) {
      best = candidate
      bestCost = value
    }
  }
  return best
}

/** The cursor label's side for an arrow tip, preferred side first. */
export function chooseLabelSide(tip: Point, size: Size, avoid: Avoid, preferred: LabelSide = 'right-down', lift = 0): LabelSide {
  const order = [preferred, ...LABEL_SIDES.filter((side) => side !== preferred)]
  return cheapest(order.map((side) => ({ side, box: labelBox(side, tip, size, lift) })), avoid).side
}

/**
 * Reduced motion: the line beside the lit target (spot = the target with its padding): below, above, right, left — and,
 * for a target too large to leave room around it, just inside its top edge (last, so only when the rest cost more).
 */
export function chooseLineBox(spot: Box, size: Size, avoid: Avoid, gap = 12): Box {
  const viewportWidth = avoid.viewport.width
  const alignedLeft = Math.max(16, Math.min(spot.left, viewportWidth - size.width - 16))
  const middle = Math.max(16, (spot.top + spot.bottom) / 2 - size.height / 2)
  const at = (left: number, top: number): Box => ({ left, top, right: left + size.width, bottom: top + size.height })
  const candidates = [
    at(alignedLeft, spot.bottom + gap),
    at(alignedLeft, spot.top - gap - size.height),
    at(spot.right + gap, middle),
    at(spot.left - gap - size.width, middle),
    at(alignedLeft + gap, spot.top + gap),
  ].map((box) => ({ box }))
  return cheapest(candidates, avoid).box
}
