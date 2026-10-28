export type StudyInteractionMode = 'focus' | 'talk'

export function activateStudyFriend(
  current: URLSearchParams,
  mode: StudyInteractionMode,
  characterId: string,
) {
  const next = new URLSearchParams(current)
  if (mode === 'focus') {
    if (next.get('focus') === characterId) next.delete('focus')
    else next.set('focus', characterId)
  } else {
    next.set('chat', '1')
    next.set('friend', characterId)
  }
  return next
}
