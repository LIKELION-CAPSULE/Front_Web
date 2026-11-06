import { createCapsuleShell } from '../reports/capsule-shell.ts'
import { PREPARE_SHAPE } from './prepare-capsule-motion.ts'

/** Short, flush halves with a narrow butt joint instead of a long telescoping sleeve. */
export function createPrepareCapsuleHalves(bodyColor: string, capColor: string) {
  const { radius, center, bodyRim, capRim } = PREPARE_SHAPE
  return {
    body: createCapsuleShell(bodyColor, radius, -center, bodyRim, false),
    cap: createCapsuleShell(capColor, radius, center, capRim, true),
  }
}
