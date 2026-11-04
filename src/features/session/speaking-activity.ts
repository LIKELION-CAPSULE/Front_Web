export type SpeakingMessages = Readonly<Record<string, string>>

/** Key by message so one completed message cannot clear another message's indicator. */
export function updateSpeakingMessages(current: SpeakingMessages, characterId: string, messageId: string, speaking: boolean): SpeakingMessages {
  if (speaking) return current[messageId] === characterId ? current : { ...current, [messageId]: characterId }
  if (current[messageId] !== characterId) return current
  const next = { ...current }
  delete next[messageId]
  return next
}
