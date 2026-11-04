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
  speaking,
  status = '공부 중',
  speech,
  onActivate,
  onDismiss,
  children,
}: {
  character: Character
  variant?: FigureVariant
  focus?: boolean
  active?: boolean
  speaking?: boolean
  status?: string
  speech?: string
  onActivate?: () => void
  onDismiss?: () => void
  children?: ReactNode
}) {
  return (
    <article
      aria-label={`${character.name}의 자리`}
      className={cn('character-tile', speaking && 'is-speaking', focus && 'focus-tile')}
      data-speaking={speaking || undefined}
    >
      <div className={cn('pointer-events-none absolute z-10 flex items-center gap-2', variant === 'small' ? 'inset-x-2 bottom-2' : 'top-3 left-3')}>
        <span className="tile-label">
          {character.name}{variant !== 'small' && ` · ${status}`}
        </span>
      </div>
      <CharacterFigure
        variant={variant}
        characterId={character.id}
        pose={variant === 'rest' ? 'affection' : active ? 'reaction' : 'study'}
      />
      <div className="tile-image-shade" />
      {onActivate && (
        <button
          type="button"
          onClick={onActivate}
          className="tile-interaction"
          aria-label={focus ? `${character.name} 확대 닫기` : `${character.name} 크게 보기`}
          aria-expanded={!!focus}
        >
          <span className="tile-action-symbol" aria-hidden="true">
            <Icon name={focus ? 'shrink' : 'zoomIn'} size={28} motion="pulse" />
          </span>
        </button>
      )}
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
              className="button-subtle shrink-0 rounded-full border border-transparent px-2.5 py-1 text-caption text-muted"
            >
              아니야
            </button>
          )}
        </div>
      )}
      {children}
    </article>
  )
}
