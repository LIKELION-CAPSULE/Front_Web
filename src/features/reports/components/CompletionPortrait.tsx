import { CharacterFigure } from '@/features/session/components/CharacterFigure'
import { getCompletionArtwork } from '../completion-artwork'

export function CompletionPortrait({ characterId, name, variant }: { characterId: string; name: string; variant: 'report' | 'share' }) {
  const art = getCompletionArtwork(characterId, name)
  const framing = variant === 'share' ? art?.cardFraming : undefined
  return art
    ? <img className="completion-portrait" src={art.src} alt={`${name}의 밝게 웃는 공부 완료 모습`} width={1024} height={1536} decoding="async"
        style={framing ? { width: `${framing.scale * 100}%`, maxWidth: 'none', marginLeft: `${(1 - framing.scale) * framing.x * 100}%`, objectPosition: `50% ${framing.y * 100}%` } : undefined} />
    : <CharacterFigure characterId={characterId} variant={variant} pose="affection" />
}
