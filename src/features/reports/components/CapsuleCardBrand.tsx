import logo from '@/assets/brand/logo.webp'
import { Brand } from '@/shared/ui/Brand'

export function CapsuleCardBrand() {
  return (
    <span className="capsule-card-brand">
      <Brand />
      <span className="capsule-card-wordmark" aria-hidden="true" style={{ maskImage: `url("${logo}")` }} />
    </span>
  )
}
