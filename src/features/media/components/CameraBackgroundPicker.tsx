import { useId } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { cn } from '@/shared/lib/cn'
import { cameraBackgrounds, type CameraBackgroundId } from '../camera-backgrounds'

/** Native radios give arrow-key selection for free; each change applies to the preview immediately. */
export function CameraBackgroundPicker({ value, onChange, legend = '배경', className }: {
  value: CameraBackgroundId
  onChange: (id: CameraBackgroundId) => void
  legend?: string
  className?: string
}) {
  const name = useId()
  return (
    <fieldset className={cn('camera-background-picker', className)}>
      <legend>{legend}</legend>
      {cameraBackgrounds.map((option) => (
        <label key={option.id} className="camera-background-option">
          <input
            type="radio"
            name={name}
            value={option.id}
            checked={value === option.id}
            onChange={() => onChange(option.id)}
            className="sr-only"
          />
          <span className="camera-background-thumb" data-kind={option.kind}>
            {option.kind === 'image'
              ? <img src={option.src} alt="" loading="lazy" decoding="async" />
              : <Icon name={option.kind === 'none' ? 'ban' : 'droplet'} size={20} />}
          </span>
          <span className="camera-background-label">{option.label}</span>
        </label>
      ))}
    </fieldset>
  )
}
