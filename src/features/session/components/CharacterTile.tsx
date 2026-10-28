import type { ReactNode } from 'react'
import type { Character } from '@/features/characters/types'
import { cn } from '@/shared/lib/cn'
import { Icon } from '@/shared/ui/Icon'
import { CharacterFigure } from './CharacterFigure'
import type { FigureVariant } from './CharacterFigure'

export function CharacterTile({
  character,
  variant = 'quiet',
  focus,
  active,
  status = '공부 중',
  speech,
  onFocus,
  onReact,
  onDismiss,
  children,
}: {
  character: Character
  variant?: FigureVariant
  focus?: boolean
  active?: boolean
  status?: string
  speech?: string
  onFocus?: () => void
  onReact?: () => void
  onDismiss?: () => void
  children?: ReactNode
}) {
  return (
    <article
      aria-label={`${character.name}의 칸`}
      className={cn('character-tile', active && 'is-reacting', focus && 'focus-tile')}
    >
      <div className="absolute top-3 left-3 z-10 flex items-center gap-2">
        <span className="tile-label">
          {character.name} · {status}
        </span>
        {focus && <span className="text-xs font-bold text-brand">포커스</span>}
      </div>
      {onFocus && (
        <button
          type="button"
          onClick={onFocus}
          aria-label={focus ? '그리드로 돌아가기' : `${character.name} 크게 보기`}
          className="tile-focus"
        >
          <Icon name={focus ? 'shrink' : 'expand'} size={17} />
        </button>
      )}
      <CharacterFigure
        variant={variant}
        characterId={character.id}
        pose={variant === 'rest' ? 'affection' : active ? 'reaction' : 'study'}
      />
      <div className="tile-image-shade" />
      {speech && (
        <div
          className={cn(
            'tile-speech',
            variant === 'focus' && 'focus-speech',
            variant === 'rest' && 'rest-speech',
          )}
        >
          <p>{speech}</p>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="button-subtle shrink-0 rounded-full border border-transparent px-2.5 py-1 text-xs text-muted"
            >
              아니야
            </button>
          )}
        </div>
      )}
      {onReact && (
        <button type="button" onClick={onReact} className="tile-react-button">
          말 걸기 · 반응 보기
        </button>
      )}
      {children}
    </article>
  )
}
