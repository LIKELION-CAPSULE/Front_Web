export type ChatDrafts = Record<string, string>

/** Clear only the submitted draft, so writing the next message never waits for a reply. */
export async function sendChatDraft({ characterId, text, inputType, onSend, updateDrafts }: {
  characterId: string
  text: string
  inputType: 'TEXT' | 'QUICK'
  onSend: () => Promise<boolean>
  updateDrafts: (update: (drafts: ChatDrafts) => ChatDrafts) => void
}) {
  if (inputType === 'TEXT') updateDrafts(current => current[characterId] === text ? { ...current, [characterId]: '' } : current)
  let sent = false
  try {
    sent = await onSend()
    return sent
  } finally {
    // Restore a failed message only when no replacement draft is being written.
    if (!sent && inputType === 'TEXT') updateDrafts(current => current[characterId] ? current : { ...current, [characterId]: text })
  }
}
