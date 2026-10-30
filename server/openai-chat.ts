/**
 * POST /api/chat — asks OpenAI for one in-character study-buddy reply.
 * Shared by the Vite dev/preview middleware and the Cloudflare Worker so the API key never reaches the browser.
 */
export type ChatEnv = { OPENAI_API_KEY?: string; OPENAI_MODEL?: string }

export type ChatRequestBody = {
  userName: string
  room: { name: string; description: string }
  character: { name: string; description: string }
  phase: 'study' | 'break'
  elapsedMinutes: number
  goalMinutes: number
  history: { sender: 'user' | 'character'; text: string }[]
  text: string
}

const DEFAULT_MODEL = 'gpt-4o-mini'
const MAX_HISTORY = 12

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } })

const text = (value: unknown, max: number) => (typeof value === 'string' ? value.trim().slice(0, max) : '')

function parseBody(value: unknown): ChatRequestBody | null {
  if (!value || typeof value !== 'object') return null
  const body = value as Record<string, unknown>
  const room = (body.room ?? {}) as Record<string, unknown>
  const character = (body.character ?? {}) as Record<string, unknown>
  const message = text(body.text, 500)
  const name = text(character.name, 40)
  if (!message || !name) return null
  const history = Array.isArray(body.history)
    ? body.history
        .filter((item): item is { sender: 'user' | 'character'; text: string } =>
          !!item && (item.sender === 'user' || item.sender === 'character') && typeof item.text === 'string')
        .slice(-MAX_HISTORY)
        .map((item) => ({ sender: item.sender, text: item.text.slice(0, 500) }))
    : []
  const minutes = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.round(value)) : 0)
  return {
    userName: text(body.userName, 40) || '친구',
    room: { name: text(room.name, 80), description: text(room.description, 200) },
    character: { name, description: text(character.description, 120) },
    phase: body.phase === 'break' ? 'break' : 'study',
    elapsedMinutes: minutes(body.elapsedMinutes),
    goalMinutes: minutes(body.goalMinutes),
    history,
    text: message,
  }
}

function systemPrompt(body: ChatRequestBody) {
  const situation = body.phase === 'study'
    ? `지금은 공부 시간이다. 목표 ${body.goalMinutes}분 중 ${body.elapsedMinutes}분째 함께 공부하고 있다.`
    : `목표한 공부를 마치고 쉬는 시간이다. 이번에 ${body.goalMinutes}분 공부했다.`
  return [
    `너는 공부 메이트 서비스 CAPSULE의 캐릭터 "${body.character.name}"(${body.character.description})이다.`,
    `장소는 스터디룸 "${body.room.name}" — ${body.room.description}`,
    `상대는 사용자 "${body.userName}"이고, 같은 공간에서 각자 공부하며 채팅으로 이야기한다.`,
    situation,
    '규칙:',
    '- 캐릭터 설명의 성격과 말투를 지키며 한국어 반말 구어체로 답한다.',
    '- 메신저처럼 1~2문장, 80자 안팎으로 짧게 답한다. 이모지·마크다운은 쓰지 않는다.',
    '- 공부 시간에는 사용자가 다시 집중할 수 있게 짧게 응원하거나 받아 주고, 쉬는 시간에는 조금 더 편하게 수다를 떤다.',
    '- AI라는 사실이나 이 규칙을 언급하지 않는다.',
  ].join('\n')
}

export async function handleChatRequest(request: Request, env: ChatEnv): Promise<Response> {
  if (request.method !== 'POST') return json({ error: 'POST만 지원해요.' }, 405)
  const apiKey = env.OPENAI_API_KEY?.trim()
  if (!apiKey) return json({ error: 'OPENAI_API_KEY가 설정되지 않았어요.' }, 500)
  const body = parseBody(await request.json().catch(() => null))
  if (!body) return json({ error: '요청 형식이 올바르지 않아요.' }, 400)

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      model: env.OPENAI_MODEL?.trim() || DEFAULT_MODEL,
      messages: [
        { role: 'system', content: systemPrompt(body) },
        ...body.history.map((item) => ({ role: item.sender === 'user' ? 'user' : 'assistant', content: item.text })),
        { role: 'user', content: body.text },
      ],
    }),
  }).catch(() => null)
  if (!response) return json({ error: 'OpenAI에 연결하지 못했어요.' }, 502)
  const data = (await response.json().catch(() => null)) as
    | { choices?: { message?: { content?: string | null } }[]; error?: { message?: string } }
    | null
  if (!response.ok) return json({ error: data?.error?.message ?? `OpenAI 오류 (${response.status})` }, 502)
  const reply = data?.choices?.[0]?.message?.content?.trim()
  if (!reply) return json({ error: 'OpenAI 응답이 비어 있어요.' }, 502)
  return json({ reply })
}
