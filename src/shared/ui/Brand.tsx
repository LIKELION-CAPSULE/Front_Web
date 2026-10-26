import logo from '@/assets/brand/logo.webp'
import { cn } from '@/shared/lib/cn'

export function Brand({ className }: { className?: string }) {
  return (
    <img
      src={logo}
      alt="CAPSULE"
      width="480"
      height="161"
      className={cn('brand-wordmark', className)}
    />
  )
}
