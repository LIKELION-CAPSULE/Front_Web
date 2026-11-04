export const SELF_STUDY_TILE_ID = 'self'

export function toggleStudyFocus(
  current: URLSearchParams,
  tileId: string,
) {
  const next = new URLSearchParams(current)
  if (next.get('focus') === tileId) next.delete('focus')
  else next.set('focus', tileId)
  return next
}

export function selectStudyChatFriend(current: URLSearchParams, characterId: string) {
  const next = new URLSearchParams(current)
  next.set('chat', '1')
  next.set('friend', characterId)
  return next
}

export function toggleBreakSelfFocus(current: URLSearchParams, characterId: string) {
  const next = toggleStudyFocus(current, SELF_STUDY_TILE_ID)
  // Preserve the main friend even if the previous selection came from the study focus.
  next.set('friend', characterId)
  return next
}

export function selectBreakFriend(current: URLSearchParams, characterId: string) {
  const next = selectStudyChatFriend(current, characterId)
  next.delete('focus')
  return next
}

export function isStudyChatOpen(current: URLSearchParams, resting = false) {
  return current.get('chat') === '1' || (resting && !current.has('chat'))
}

export function toggleStudyChat(current: URLSearchParams, characterId: string, resting = false) {
  const next = new URLSearchParams(current)
  const closing = isStudyChatOpen(current, resting)
  next.set('chat', closing ? '0' : '1')
  if (!closing) next.set('friend', characterId)
  return next
}
