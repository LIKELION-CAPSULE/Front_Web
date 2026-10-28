import { WheelColumn } from './WheelColumn'
import { WheelField } from './WheelField'

export function WheelSelectField<T extends string>({
  label,
  options,
  value,
  open,
  onOpenChange,
  onChange,
}: {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  open: boolean
  onOpenChange: (open: boolean) => void
  onChange: (value: T) => void
}) {
  const selectedLabel = options.find((option) => option.value === value)?.label ?? value
  return (
    <WheelField label={label} displayValue={selectedLabel} icon="chevronsVertical" open={open} onOpenChange={onOpenChange} compact>
      <WheelColumn label={label} hideLabel options={options} value={value} onChange={(next) => {
        const option = options.find((item) => item.value === next)
        if (option) onChange(option.value)
      }} />
    </WheelField>
  )
}
