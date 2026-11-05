import '../character-speech-bubble.css'

/** The character's on-screen dialogue uses the home banner's glass material. */
export function CharacterSpeechBubble({ name, text, expanded = false, onDismiss }: {
  name: string
  text: string
  expanded?: boolean
  onDismiss?: () => void
}) {
  return <blockquote className="character-speech-bubble" aria-label={`${name}의 한마디`} data-expanded={expanded || undefined}>
    <p className="character-speech-bubble-text">{text}</p>
    {onDismiss && <button type="button" className="character-speech-bubble-dismiss" onClick={onDismiss}>아니야</button>}
  </blockquote>
}
