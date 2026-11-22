import { Icon } from '@/shared/ui/Icon'

interface MotionToggleButtonProps {
  paused: boolean
  onToggle: () => void
  label?: string
}

/** Matches PosterMosaic's motion pause toggle pattern so reduced/paused controls stay consistent. */
export function MotionToggleButton({
  paused,
  onToggle,
  label = '배경 애니메이션',
}: MotionToggleButtonProps) {
  return (
    <button
      type="button"
      className="poster-mosaic-motion-toggle"
      aria-label={paused ? `${label} 재생` : `${label} 일시정지`}
      aria-pressed={paused}
      onClick={onToggle}
    >
      <Icon name={paused ? 'play' : 'pause'} size={12} />
      <span>{paused ? '재생' : '일시정지'}</span>
    </button>
  )
}
