import { Avatar } from '@/shared/ui/Avatar'
import type { AvatarSettings } from '@/features/demo/types'
import { VirtualBackgroundVideo } from '@/features/media/components/VirtualBackgroundVideo'
import { Live2DFigure } from '@/features/live2d/components/Live2DFigure'
import type { SessionModelStage } from '@/features/live2d/session-model'
import type { AvatarModelStatus } from '@/features/live2d/use-avatar-model'
import { QuarterRingSpinner } from '@/shared/ui/QuarterRingSpinner'
import { cn } from '@/shared/lib/cn'

export function StudySelfView({ stream, showCamera, avatar, image, roomBackground, model, modelStatus, onRetryModel, small = false, expanded = false }: {
  stream: MediaStream | null
  showCamera: boolean
  avatar: AvatarSettings
  image?: string
  roomBackground?: string
  model: SessionModelStage | null
  modelStatus: AvatarModelStatus
  onRetryModel: () => void
  small?: boolean
  expanded?: boolean
}) {
  const cameraVisible = showCamera && !!stream
  const modelVisible = !!stream && !cameraVisible && !!model
  const waitingForModel = !!stream && !cameraVisible && modelStatus === 'loading'
  const modelFailed = !!stream && !cameraVisible && modelStatus === 'error'
  return (
    <div className={cn('study-self-view', small && 'is-small')} data-view={cameraVisible ? 'camera' : stream ? 'avatar' : 'portrait'} data-avatar-style={cameraVisible ? undefined : modelVisible ? 'model' : 'portrait'}>
      {cameraVisible
        ? <VirtualBackgroundVideo stream={stream} label="내 카메라 미리보기" />
        : <>
            {modelVisible && roomBackground && <div className="study-avatar-background" style={{ backgroundImage: `url(${JSON.stringify(roomBackground)})` }} aria-hidden="true" />}
            {modelVisible ? <div className="study-avatar-model"><Live2DFigure stage={model} /></div>
              : <Avatar src={image} settings={avatar} className={cn('study-self-portrait', expanded ? 'size-36 sm:size-44' : small ? 'size-12' : 'size-24 sm:size-28')} />}
            {(waitingForModel || modelFailed) && <div className="study-avatar-status" role="status">
              {waitingForModel ? <><QuarterRingSpinner /><span>아바타를 불러오고 있어요.</span></>
                : <><span>아바타를 불러오지 못했어요.</span><button type="button" onClick={onRetryModel} aria-label="내 아바타 모델 다시 불러오기">다시 시도</button></>}
            </div>}
          </>}
    </div>
  )
}
