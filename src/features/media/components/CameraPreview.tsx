import { useCallback, useState } from 'react'
import { useMedia } from '../media-context'
import { VirtualBackgroundVideo } from './VirtualBackgroundVideo'
import { AvatarIllustration } from '@/shared/ui/AvatarIllustration'
import { useDemo } from '@/features/demo/demo-context'
import { cn } from '@/shared/lib/cn'

export function CameraPreview({ className }: { className?: string }) {
  const { devices, observation } = useMedia()
  const { state } = useDemo()
  const [dimensions, setDimensions] = useState<{ stream: MediaStream; width: number; height: number } | null>(null)
  const stream = devices.camera.stream
  const frameSize = stream && dimensions?.stream === stream ? dimensions : null
  const updateSize = useCallback((width: number, height: number) => {
    if (!stream) return
    setDimensions((previous) => previous?.stream === stream && previous.width === width && previous.height === height
      ? previous : { stream, width, height })
  }, [stream])
  return (
    <div
      className={cn('device-camera-preview', className)}
      style={frameSize ? { aspectRatio: `${frameSize.width} / ${frameSize.height}`, maxHeight: 'none' } : undefined}
    >
      {stream ? (
        <div className="device-camera-frame">
          <VirtualBackgroundVideo stream={stream} label="내 카메라 미리보기" onFrameSize={updateSize} />
          <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true" className="device-detection-overlay">
            {observation?.faceBox && <rect className="face-detection-box" x={observation.faceBox.x * 100} y={observation.faceBox.y * 100} width={observation.faceBox.width * 100} height={observation.faceBox.height * 100} rx="2" />}
          </svg>
        </div>
      ) : <AvatarIllustration settings={state.profile.avatar} />}
    </div>
  )
}
