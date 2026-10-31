import { useEffect } from 'react'
import { useDemo } from '@/features/demo/demo-context'
import { cn } from '@/shared/lib/cn'
import { getCameraBackground, normalizeCameraBackground } from '../camera-backgrounds'
import { useMedia } from '../media-context'
import { useVirtualBackground } from '../use-virtual-background'

/** The user's camera with their chosen background. Mirroring is display-only and left to the parent's CSS. */
export function VirtualBackgroundVideo({ stream, label, className, onFrameSize }: {
  stream: MediaStream
  label: string
  className?: string
  onFrameSize?: (width: number, height: number) => void
}) {
  const { state } = useDemo()
  const { backgroundNotice } = useMedia()
  const background = getCameraBackground(normalizeCameraBackground(state.cameraBackground))
  const { videoRef, canvasRef, enabled, loading } = useVirtualBackground(stream, background)
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let active = true
    video.srcObject = stream
    const updateSize = () => {
      if (active && video.videoWidth && video.videoHeight) onFrameSize?.(video.videoWidth, video.videoHeight)
    }
    video.addEventListener('loadedmetadata', updateSize)
    video.addEventListener('resize', updateSize)
    void video.play().then(updateSize).catch(() => { /* The muted inline preview can be retried with the device control. */ })
    return () => {
      active = false
      video.removeEventListener('loadedmetadata', updateSize)
      video.removeEventListener('resize', updateSize)
      video.pause()
      video.srcObject = null
      // The shared stream also feeds focus detection; changing the view never stops its tracks.
    }
  }, [stream, videoRef, onFrameSize])
  const notice = loading ? '배경을 준비하고 있어요' : backgroundNotice
  return (
    <div className={cn('virtual-background', className)}>
      <div className="virtual-background-media">
        <video ref={videoRef} autoPlay muted playsInline disablePictureInPicture aria-label={label} />
        {enabled && <canvas ref={canvasRef} aria-hidden="true" />}
      </div>
      {notice && <p role="status" className="virtual-background-notice">{notice}</p>}
    </div>
  )
}
