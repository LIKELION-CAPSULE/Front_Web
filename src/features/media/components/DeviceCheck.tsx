import { useState } from 'react'
import { useMedia } from '../media-context'
import { CameraPreview } from './CameraPreview'
import { MicrophoneMeter } from './MicrophoneMeter'
import { DeviceCheckItem } from './DeviceCheckItem'
import type { DeviceCheckState } from './DeviceCheckStatus'
import { Button } from '@/shared/ui/Button'

export function DeviceCheck() {
  const { devices, controller, vision, observation, retryVision } = useMedia()
  const [hasRequestedDevices, setHasRequestedDevices] = useState(false)
  const requesting = Object.values(devices).some((device) => device.status === 'requesting')
  const showControls = hasRequestedDevices ||
    devices.camera.status !== 'idle' || devices.microphone.status !== 'idle'
  const cameraState: DeviceCheckState = devices.camera.status === 'error' ? 'error'
    : devices.camera.status === 'requesting' ? 'pending'
      : devices.camera.stream
        ? vision?.status === 'error' || observation?.faceCount ? 'success' : 'pending'
        : showControls ? 'off' : 'idle'
  const connectionLabel = {
    idle: '연결 대기', pending: '확인 중', success: '연결됨', error: '연결 실패', off: '꺼짐',
  }[cameraState]
  const cameraLabel = !devices.camera.stream || vision?.status === 'error'
    ? connectionLabel
    : observation?.faceCount ? '얼굴 확인됨'
      : vision?.status === 'ready' ? '얼굴 미감지' : '감지 준비 중'

  function requestDevices() {
    setHasRequestedDevices(true)
    void controller.requestBoth()
  }

  return (
    <div className="device-check my-8">
      <div className="device-check-preview">
        <CameraPreview />
        {!showControls && (
          <Button size="md" className="device-check-start" onClick={requestDevices}>
            카메라·마이크 켜기
          </Button>
        )}
      </div>
      {showControls && (
        <div className="device-check-controls">
          <DeviceCheckItem
            title="카메라"
            state={cameraState}
            statusLabel={cameraLabel}
            details={devices.camera.error ? (
              <p role="alert" className="device-check-error">{devices.camera.error}</p>
            ) : vision?.status === 'error' ? (
              <div className="flex flex-wrap items-center gap-2">
                <p role="alert" className="device-check-error">얼굴 감지 실패 · {vision.error}</p>
                <Button size="xs" variant="secondary" onClick={retryVision}>감지 다시 시작</Button>
              </div>
            ) : undefined}
            action={(
              <Button
                size="sm"
                variant="secondary"
                aria-label={`카메라 ${devices.camera.stream ? '끄기' : '켜기'}`}
                disabled={requesting}
                onClick={() => devices.camera.stream ? controller.stop('camera') : void controller.request('camera')}
              >
                {devices.camera.stream ? '끄기' : '켜기'}
              </Button>
            )}
          />
          <MicrophoneMeter
            pending={requesting && devices.microphone.status === 'idle'}
            action={(
              <Button
                size="sm"
                variant="secondary"
                aria-label={`마이크 ${devices.microphone.stream ? '끄기' : '켜기'}`}
                disabled={requesting}
                onClick={() => devices.microphone.stream ? controller.stop('microphone') : void controller.request('microphone')}
              >
                {devices.microphone.stream ? '끄기' : '켜기'}
              </Button>
            )}
          />
        </div>
      )}
    </div>
  )
}
