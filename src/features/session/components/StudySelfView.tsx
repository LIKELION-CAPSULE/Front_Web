import { AvatarIllustration } from '@/shared/ui/AvatarIllustration'
import { Avatar } from '@/shared/ui/Avatar'
import type { AvatarSettings } from '@/features/demo/types'
import { VirtualBackgroundVideo } from '@/features/media/components/VirtualBackgroundVideo'
import { getCameraBackground, type CameraBackgroundId } from '@/features/media/camera-backgrounds'
import { cn } from '@/shared/lib/cn'

export function StudySelfView({ stream, showCamera, avatar, background, small = false, expanded = false }: {
  stream: MediaStream | null
  showCamera: boolean
  avatar: AvatarSettings
  background: CameraBackgroundId
  small?: boolean
  expanded?: boolean
}) {
  const cameraVisible = showCamera && !!stream
  const portrait = !stream
  const backdrop = getCameraBackground(background)
  return (
    <div className={cn('study-self-view', small && 'is-small')} data-view={cameraVisible ? 'camera' : 'avatar'} data-avatar-style={cameraVisible ? undefined : portrait ? 'portrait' : 'figure'}>
      {cameraVisible
        ? <VirtualBackgroundVideo stream={stream} label="내 카메라 미리보기" />
        : portrait
          ? <Avatar settings={avatar} className={expanded ? 'size-36 sm:size-44' : small ? 'size-12' : 'size-24 sm:size-28'} />
          : <>
            {/* Avatar mode never mounts a live camera preview behind the illustration. */}
            {backdrop.kind !== 'none' && <div className="study-avatar-background" data-kind={backdrop.kind}
              style={backdrop.kind === 'image' ? { backgroundImage: `url("${backdrop.src}")` } : undefined} aria-hidden="true" />}
            <AvatarIllustration settings={avatar} />
          </>}
    </div>
  )
}
