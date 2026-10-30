import type { ChatRequestBody } from '../../../server/openai-chat'

/** Test toggle in the chat panel: 'scripted' keeps the keyword replies, 'llm' asks /api/chat. */
export type ChatReplyMode = 'scripted' | 'llm'

export async function requestCharacterReply(body: ChatRequestBody): Promise<string> {
  const response = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = (await response.json().catch(() => null)) as { reply?: string; error?: string } | null
  if (!response.ok || !data?.reply) throw new Error(data?.error ?? `응답을 받지 못했어요 (${response.status})`)
  return data.reply
}
