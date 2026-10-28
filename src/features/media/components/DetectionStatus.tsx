import { useMedia } from '../media-context'
import { Button } from '@/shared/ui/Button'

export function DetectionStatus() {
  const { devices, vision, observation, retryVision } = useMedia()
  if (!devices.camera.stream) return null
  const text = vision?.status === 'error' ? vision.error : !vision ? '감지 일시정지' : vision.status === 'loading' ? '감지를 준비하고 있어요' : !observation ? '얼굴을 카메라에 비춰 주세요' : observation.faceCount ? '얼굴 확인됨' : '얼굴 미감지 · 집중률에 반영 중'
  return (
    <div className="detection-status is-compact">
      <p role="status" className="flex items-center gap-2"><span className="device-status-dot" data-ready={vision?.status === 'ready' && !!observation?.faceCount} />{text}</p>
      {vision?.status === 'error' && <Button size="xs" variant="secondary" onClick={retryVision} className="mt-2">감지 다시 시작</Button>}
    </div>
  )
}
