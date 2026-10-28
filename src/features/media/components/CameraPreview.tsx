import { useEffect, useRef, useState } from 'react'
import { useMedia } from '../media-context'
import { AvatarIllustration } from '@/shared/ui/AvatarIllustration'
import { useDemo } from '@/features/demo/demo-context'
import { cn } from '@/shared/lib/cn'

export function CameraPreview({ className }: { className?: string }) {
  const { devices, observation } = useMedia()
  const { state } = useDemo()
  const ref = useRef<HTMLVideoElement>(null)
  const [dimensions, setDimensions] = useState<{ stream: MediaStream; width: number; height: number } | null>(null)
  const stream = devices.camera.stream
  const frameSize = stream && dimensions?.stream === stream ? dimensions : null
  useEffect(() => {
    const video = ref.current
    if (!video || !stream) return
    let active = true
    video.srcObject = stream
    const updateSize = () => {
      if (!active || !video.videoWidth || !video.videoHeight) return
      setDimensions((previous) => previous?.stream === stream &&
        previous.width === video.videoWidth && previous.height === video.videoHeight
        ? previous : { stream, width: video.videoWidth, height: video.videoHeight })
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
    }
  }, [stream])
  return (
    <div
      className={cn('device-camera-preview', className)}
      style={frameSize ? { aspectRatio: `${frameSize.width} / ${frameSize.height}`, maxHeight: 'none' } : undefined}
    >
      {stream ? (
        <div className="device-camera-frame">
          <video ref={ref} autoPlay muted playsInline aria-label="내 카메라 미리보기" />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="device-detection-overlay">
            {observation?.faceBox && <rect className="face-detection-box" x={observation.faceBox.x * 100} y={observation.faceBox.y * 100} width={observation.faceBox.width * 100} height={observation.faceBox.height * 100} rx="2" />}
          </svg>
        </div>
      ) : <AvatarIllustration settings={state.profile.avatar} />}
    </div>
  )
}
