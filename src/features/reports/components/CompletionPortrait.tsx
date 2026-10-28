import { CharacterFigure } from '@/features/session/components/CharacterFigure'
import { completionArtwork } from '../completion-artwork'

export function CompletionPortrait({ characterId, name, variant }: { characterId: string; name: string; variant: 'report' | 'share' }) {
  const art = completionArtwork[characterId]
  return art
    ? <img className="completion-portrait" src={art.src} alt={`${name}의 밝게 웃는 공부 완료 모습`} width={1024} height={1536} decoding="async" />
    : <CharacterFigure characterId={characterId} variant={variant} pose="affection" />
}
