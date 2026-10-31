import { AvatarIllustration } from '@/shared/ui/AvatarIllustration'
import type { AvatarSettings } from '@/features/demo/types'
import { VirtualBackgroundVideo } from '@/features/media/components/VirtualBackgroundVideo'
import { cn } from '@/shared/lib/cn'

export function StudySelfView({ stream, showCamera, avatar, small = false }: {
  stream: MediaStream | null
  showCamera: boolean
  avatar: AvatarSettings
  small?: boolean
}) {
  const cameraVisible = showCamera && !!stream
  return (
    <div className={cn('study-self-view', small && 'is-small')} data-view={cameraVisible ? 'camera' : 'avatar'}>
      {cameraVisible
        ? <VirtualBackgroundVideo stream={stream} label="내 카메라 미리보기" />
        : <AvatarIllustration settings={avatar} />}
    </div>
  )
}
