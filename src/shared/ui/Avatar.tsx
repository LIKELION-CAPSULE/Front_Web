import { cn } from '@/shared/lib/cn'
import { useDemo } from '@/features/demo/demo-context'
import { AvatarIllustration } from './AvatarIllustration'
import type { AvatarSettings } from '@/features/demo/types'

type AvatarProps = {
  src?: string
  size?: 'sm' | 'md' | 'lg'
  settings?: AvatarSettings
}

const sizes = { sm: 'size-7', md: 'size-9', lg: 'size-[68px]' }

/** Decorative: the adjacent text supplies the person's name. */
export function Avatar({ src, size = 'sm', settings }: AvatarProps) {
  const { state } = useDemo()
  return (
    <span
      aria-hidden="true"
      className={cn(
        'profile-avatar inline-block shrink-0 overflow-hidden rounded-full bg-placeholder ring-2 ring-panel',
        sizes[size],
      )}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover object-[50%_35%]" />
      ) : (
        <AvatarIllustration settings={settings ?? state.profile.avatar} />
      )}
    </span>
  )
}
