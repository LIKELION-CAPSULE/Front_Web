import type { CSSProperties } from 'react'
import type { Character } from '@/features/characters/types'
import type { SessionModelStage } from '@/features/live2d/session-model'
import { Live2DFigure } from '@/features/live2d/components/Live2DFigure'
import desk from '@/assets/study/desk.webp'
import '../study-character-scene.css'

// Backend IDs are numeric; recognize the frontend artwork key and the character's name.
const seatedCharacters = new Set(['malfoy-ts', '말포이', '말포이ts', '드레이코말포이', 'malfoy', 'dracomalfoy'])

/** One composition keeps the upper-body model behind the desk at every tile size. */
export function StudyCharacterFigure({ character, stage, background }: { character: Character; stage: SessionModelStage; background?: string }) {
  const seated = seatedCharacters.has(character.artworkId ?? character.id) || seatedCharacters.has(character.name.replace(/\s+/g, '').toLowerCase())
  if (!seated) return <Live2DFigure stage={stage} background={background} />
  return <div className="study-character-scene" aria-hidden="true"
    style={background ? { '--live2d-background': `url(${JSON.stringify(background)})` } as CSSProperties : undefined}>
    <div className="study-character-seated-model"><Live2DFigure stage={stage} /></div>
    <img className="study-character-desk" src={desk} width={1672} height={941} alt="" draggable={false} />
  </div>
}
