import type { ReactNode } from 'react'
import type { Character } from '@/features/characters/types'
import { cn } from '@/shared/lib/cn'
import { Icon } from '@/shared/ui/Icon'
import { CharacterFigure } from './CharacterFigure'
import type { FigureVariant } from './CharacterFigure'
import type { StudyInteractionMode } from '../study-interaction'

export function CharacterTile({
  character,
  variant = 'quiet',
  focus,
  active,
  status = '공부 중',
  speech,
  interactionMode = 'focus',
  chatting = false,
  onActivate,
  onDismiss,
  children,
}: {
  character: Character
  variant?: FigureVariant
  focus?: boolean
  active?: boolean
  status?: string
  speech?: string
  interactionMode?: StudyInteractionMode
  chatting?: boolean
  onActivate?: () => void
  onDismiss?: () => void
  children?: ReactNode
}) {
  return (
    <article
      aria-label={`${character.name}의 자리`}
      className={cn('character-tile', active && 'is-reacting', focus && 'focus-tile')}
    >
      <div className="pointer-events-none absolute top-3 left-3 z-10 flex items-center gap-2">
        <span className="tile-label">
          {character.name} · {status}
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
          aria-label={interactionMode === 'talk'
            ? `${character.name}에게 말 걸기`
            : focus ? `${character.name} 확대 닫기` : `${character.name} 크게 보기`}
          aria-expanded={interactionMode === 'talk' ? chatting : !!focus}
        >
          <span className="tile-action-symbol" aria-hidden="true">
            <Icon name={interactionMode === 'talk' ? 'chat' : focus ? 'shrink' : 'zoomIn'} size={28} motion="pulse" />
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
              className="button-subtle shrink-0 rounded-full border border-transparent px-2.5 py-1 text-xs text-muted"
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
