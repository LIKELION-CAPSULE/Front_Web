import { useState } from 'react'
import type { AvatarSettings } from '@/features/demo/types'
import { cn } from '@/shared/lib/cn'
import { Tabs, type TabSize } from '@/shared/ui/Tabs'
import { avatarCategories, avatarShades, figureColors } from '../avatar-options'

export function AvatarCustomizer({
  value,
  onChange,
  size = 'md',
}: {
  value: AvatarSettings
  onChange: (value: AvatarSettings) => void
  size?: TabSize
}) {
  const [category, setCategory] = useState<keyof AvatarSettings>('hair')
  const label = avatarCategories.find((item) => item.id === category)!.label
  return (
    <div className="avatar-customizer">
      <Tabs
        size={size}
        label="아바타 꾸미기"
        options={avatarCategories}
        value={category}
        onChange={(value) => setCategory(value as keyof AvatarSettings)}
      />
      <div className="mt-4 grid grid-cols-4 gap-3" role="group" aria-label={`${label} 선택`}>
        {avatarShades.map((shade, index) => (
          <button
            type="button"
            key={shade}
            aria-label={`${label} ${index + 1}`}
            aria-pressed={value[category] === index}
            onClick={() => onChange({ ...value, [category]: index })}
            className={cn(
              'avatar-part aspect-square rounded-[14px] border',
              value[category] === index ? 'border-2 border-brand' : 'border-transparent',
            )}
            style={{ background: category === 'background' ? shade : '#202433' }}
          >
            {category !== 'background' && (
              <span aria-hidden="true" className="flex h-full items-center justify-center">
                <span
                  className="size-8 border-4 border-transparent"
                  style={{
                    background: figureColors[index],
                    borderRadius: category === 'outfit' ? '8px' : '50%',
                  }}
                />
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
