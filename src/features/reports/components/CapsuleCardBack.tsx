import type { CSSProperties } from 'react'
import { designColors, designPalette } from '@/shared/design/tokens'
import { capsuleCardColors } from '../capsule-card-layout'

/** The card's back, shown only while the opening intro flips the card over. */
export function CapsuleCardBack() {
  return (
    <div
      className="capsule-card-back"
      aria-hidden="true"
      style={{
        '--capsule-back-color': capsuleCardColors[0],
        '--capsule-back-cap': designPalette.violet['300'],
        '--capsule-back-body': designColors.primary,
      } as CSSProperties}
    >
      <div className="capsule-card-back-face">
        <span className="capsule-card-back-pill"><span /><span /></span>
        <span className="capsule-card-back-word">CAPSULE</span>
      </div>
    </div>
  )
}
