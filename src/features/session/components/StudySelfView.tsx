import { useEffect, useRef } from 'react'
import { AvatarIllustration } from '@/shared/ui/AvatarIllustration'
import type { AvatarSettings } from '@/features/demo/types'
import { cn } from '@/shared/lib/cn'

export function StudySelfView({ stream, showCamera, avatar, small = false }: {
  stream: MediaStream | null
  showCamera: boolean
  avatar: AvatarSettings
  small?: boolean
}) {
  const ref = useRef<HTMLVideoElement>(null)
  const cameraVisible = showCamera && !!stream
  useEffect(() => {
    const video = ref.current
    if (!video || !stream || !cameraVisible) return
    video.srcObject = stream
    void video.play().catch(() => { /* Muted inline video can resume after the next device action. */ })
    return () => {
      video.pause()
      video.srcObject = null
      // The shared stream also feeds focus detection; changing the view never stops its tracks.
    }
  }, [stream, cameraVisible])
  return (
    <div className={cn('study-self-view', small && 'is-small')} data-view={cameraVisible ? 'camera' : 'avatar'}>
      {cameraVisible
        ? <video ref={ref} autoPlay muted playsInline disablePictureInPicture aria-label="내 카메라 미리보기" />
        : <AvatarIllustration settings={avatar} />}
    </div>
  )
}
