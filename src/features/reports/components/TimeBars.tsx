import { duration } from '@/shared/lib/format'
import { CharacterAvatar } from '@/features/characters/components/CharacterAvatar'

export function TimeBars({ values }: { values: { id: string; name: string; seconds: number }[] }) {
  const max = Math.max(1, ...values.map((value) => value.seconds))
  return (
    <div className="space-y-3">
      {values.map((value, index) => (
        <div key={value.id} className="flex items-center gap-3 text-sm">
          <span className="hidden sm:block">
            <CharacterAvatar characterId={value.id} />
          </span>
          <strong className="w-12 shrink-0">{value.name}</strong>
          <span
            role="meter"
            aria-label={`${value.name}과 공부한 시간`}
            aria-valuenow={Math.round(value.seconds / 60)}
            aria-valuemin={0}
            aria-valuemax={Math.ceil(max / 60)}
            className="h-3.5 min-w-8 flex-1 overflow-hidden rounded-full bg-line"
          >
            <span
              className="block h-full rounded-full"
              style={{
                width: `${(value.seconds / max) * 100}%`,
                background: ['#9971db', '#7c83bd', '#b39cbd'][index % 3],
              }}
            />
          </span>
          <span className="w-24 shrink-0 text-right text-xs">{duration(value.seconds)}</span>
        </div>
      ))}
    </div>
  )
}
