import { CAPSULE_HORIZONTAL_VIEWBOX, capsuleLogo } from '@/shared/design/brand-logo'
import { cn } from '@/shared/lib/cn'

/** Official horizontal lockup (logo v2, color). Width comes from CSS (`.brand-wordmark`); height follows the ratio. */
export function Brand({ className }: { className?: string }) {
  return (
    <img
      src={capsuleLogo.horizontal.color}
      alt="CAPSULE"
      width={CAPSULE_HORIZONTAL_VIEWBOX.width}
      height={CAPSULE_HORIZONTAL_VIEWBOX.height}
      className={cn('brand-wordmark', className)}
    />
  )
}
