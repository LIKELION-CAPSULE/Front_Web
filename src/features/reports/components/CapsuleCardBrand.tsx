import { capsuleLogo } from '@/shared/design/brand-logo'
import { Brand } from '@/shared/ui/Brand'

/**
 * Color lockup; on dark cards the wordmark half is overlaid in ink (mask of the single-color lockup, clipped to the
 * wordmark in CSS) so the symbol keeps its color and the letters read on the card color.
 */
export function CapsuleCardBrand() {
  return (
    <span className="capsule-card-brand">
      <Brand />
      <span className="capsule-card-wordmark" aria-hidden="true" style={{ maskImage: `url("${capsuleLogo.horizontal.white}")` }} />
    </span>
  )
}
