import type { ReactNode } from 'react'
import type { Character } from '@/features/characters/types'
import { cn } from '@/shared/lib/cn'
import { CharacterFigure } from './CharacterFigure'
import type { FigureVariant } from './CharacterFigure'
import type { SessionModelStage } from '@/features/live2d/session-model'
import { StudyCharacterFigure } from './StudyCharacterFigure'
import { CharacterSpeechBubble } from './CharacterSpeechBubble'

export function CharacterTile({
  character,
  variant = 'quiet',
  focus,
  active,
  speaking,
  status = '공부 중',
  speech,
  speechKey,
  onActivate,
  onDismiss,
  live2d,
  background,
  children,
}: {
  character: Character
  variant?: FigureVariant
  focus?: boolean
  active?: boolean
  speaking?: boolean
  status?: string
  speech?: string
  /** Changes for every new line, so the bubble restarts typing even when the text repeats. */
  speechKey?: number
  onActivate?: () => void
  onDismiss?: () => void
  /** The server character's model is fully prepared before this screen opens. */
  live2d?: SessionModelStage | null
  /** Room background drawn behind the Live2D model. */
  background?: string
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
      {character.serverCharacter ? live2d && <StudyCharacterFigure character={character} stage={live2d} background={background} /> : <CharacterFigure
        variant={variant}
        characterId={character.artworkId ?? character.id}
        pose={variant === 'rest' ? 'affection' : active ? 'reaction' : 'study'}
      />}
      <div className="tile-image-shade" />
      {onActivate && (
        <button
          type="button"
          onClick={onActivate}
          className="tile-interaction"
          aria-label={focus ? `${character.name} 확대 닫기` : `${character.name} 크게 보기`}
          aria-expanded={!!focus}
        />
      )}
      {speech && <CharacterSpeechBubble key={speechKey} name={character.name} text={speech} expanded={variant === 'focus' || variant === 'rest'} onDismiss={onDismiss} />}
      {children}
    </article>
  )
}
