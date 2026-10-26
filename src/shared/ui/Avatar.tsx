import { cn } from '@/shared/lib/cn'

type AvatarProps = {
  src?: string
  size?: 'sm' | 'md' | 'lg'
}

const sizes = { sm: 'size-7', md: 'size-9', lg: 'size-[68px]' }

/** Decorative: the adjacent text supplies the person's name. */
export function Avatar({ src, size = 'sm' }: AvatarProps) {
  return (
    <span aria-hidden="true" className={cn('inline-block shrink-0 overflow-hidden rounded-full bg-placeholder', sizes[size])}>
      {src && <img src={src} alt="" className="size-full object-cover" />}
    </span>
  )
}
