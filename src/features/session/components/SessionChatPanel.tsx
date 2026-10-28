import { useCallback, useId, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Link } from 'react-router'
import type { Character } from '@/features/characters/types'
import { getCharacterArtwork } from '@/features/characters/artwork'
import { useDemo } from '@/features/demo/demo-context'
import { tierById } from '@/features/demo/catalog'
import { number } from '@/shared/lib/format'
import { withParticle } from '@/shared/lib/korean'
import { Icon } from '@/shared/ui/Icon'
import { Tabs } from '@/shared/ui/Tabs'
import { ChatComposer } from './ChatComposer'
import { UpgradePanel } from './UpgradePanel'
import { TypingMessage } from './TypingMessage'
import '../session-chat.css'

const mobileQuery = '(max-width: 1023px)'
const subscribe = (notify: () => void) => {
  const media = window.matchMedia(mobileQuery)
  media.addEventListener('change', notify)
  return () => media.removeEventListener('change', notify)
}
const messageTime = new Intl.DateTimeFormat('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false })

export function SessionChatPanel({ open, onClose, characters, selected, onSelect, onSend, used, now }: {
  open: boolean
  onClose: () => void
  characters: readonly Character[]
  selected: Character
  onSelect: (id: string) => void
  onSend: (text: string, voice?: boolean) => void
  used: number
  now: number
}) {
  const { state } = useDemo()
  const active = state.activeSession!
  const mobile = useSyncExternalStore(subscribe, () => window.matchMedia(mobileQuery).matches, () => false)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [upgradeOpen, setUpgradeOpen] = useState(false)
  const ref = useRef<HTMLDialogElement>(null)
  const list = useRef<HTMLDivElement>(null)
  const closeButton = useRef<HTMLButtonElement>(null)
  const opener = useRef<HTMLElement | null>(null)
  const wasOpen = useRef(false)
  const follow = useRef(true)
  const backdropStart = useRef(false)
  const seen = useRef(new Set(state.messages.map(message => message.id)))
  const titleId = useId()
  const messages = state.messages.filter(message => message.sessionId === active.id && message.characterId === selected.id)
  const exhausted = active.tier === 'basic' && used >= 3
  const scrollLatest = useCallback(() => {
    if (follow.current && list.current) list.current.scrollTop = list.current.scrollHeight
  }, [])
  useLayoutEffect(() => {
    const panel = ref.current
    if (!panel) return
    if (open) {
      if (!wasOpen.current) opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
      if (panel.open && panel.matches(':modal') !== mobile) panel.close()
      if (!panel.open) { if (mobile) panel.showModal(); else panel.show() }
      if (!wasOpen.current) closeButton.current?.focus({ preventScroll: true })
    } else if (panel.open) {
      panel.close()
      if (opener.current?.isConnected) opener.current.focus({ preventScroll: true })
    }
    wasOpen.current = open
  }, [open, mobile])
  useLayoutEffect(() => { follow.current = true; scrollLatest() }, [selected.id, open, scrollLatest])
  useLayoutEffect(scrollLatest, [messages.length, scrollLatest])
  function dismiss() { setUpgradeOpen(false); onClose() }
  function isBackdrop(event: { target: EventTarget | null; currentTarget: HTMLDialogElement; clientX: number; clientY: number }) {
    if (event.target !== event.currentTarget || !mobile) return false
    const bounds = event.currentTarget.getBoundingClientRect()
    return event.clientX < bounds.left || event.clientX >= bounds.right || event.clientY < bounds.top || event.clientY >= bounds.bottom
  }
  function send(text: string, voice = false) { follow.current = true; onSend(text, voice) }
  const introId = `${active.id}:${selected.id}:${active.phase}`
  return (
    <div className="session-chat-slot">
      <dialog
        id="session-chat"
        ref={ref}
        role={mobile ? 'dialog' : 'complementary'}
        aria-modal={mobile && open ? true : undefined}
        aria-labelledby={titleId}
        className="session-chat-panel"
        onCancel={event => { if (event.target === event.currentTarget) { event.preventDefault(); dismiss() } }}
        onClose={() => { if (open && !ref.current?.open) dismiss() }}
        onKeyDown={event => { if (event.key === 'Escape' && !upgradeOpen) { event.preventDefault(); event.stopPropagation(); dismiss() } }}
        onPointerDown={event => { backdropStart.current = event.button === 0 && event.isPrimary && isBackdrop(event) }}
        onPointerCancel={() => { backdropStart.current = false }}
        onClick={event => { const close = backdropStart.current && isBackdrop(event); backdropStart.current = false; if (close) dismiss() }}
      >
        {open && <>
          <header className="session-chat-header">
            <div><h2 id={titleId}>친구와 대화</h2><Link to="/credits" className="session-chat-balance">{number(state.credits)} 크레딧</Link></div>
            <button ref={closeButton} type="button" onClick={dismiss} aria-label="대화창 닫기"><Icon name="close" size={19} /></button>
          </header>
          <div className="session-chat-friends">
            <Tabs label="대화 상대" options={characters.map(character => ({ id: character.id, label: character.name }))} value={selected.id} onChange={onSelect} size="sm" />
          </div>
          <div className="session-chat-plan">
            <span>{tierById(active.tier).name} · {active.tier === 'basic' ? `무료 대화 ${used}/3회` : '자유 대화'}</span>
            {active.tier !== 'special' && <button type="button" onClick={() => setUpgradeOpen(true)}>옵션 올리기</button>}
          </div>
          <div
            ref={list}
            className="session-chat-messages"
            role="log"
            aria-label={`${withParticle(selected.name, '과의', '와의')} 대화`}
            aria-live="polite"
            aria-relevant="additions"
            onScroll={() => { const node = list.current; if (node) follow.current = node.scrollHeight - node.scrollTop - node.clientHeight < 64 }}
          >
            <article className="chat-message" data-sender="character">
              <div className="chat-message-meta"><img src={getCharacterArtwork(selected.id).affection} alt="" /><span>{selected.name}</span></div>
              <p className="chat-message-bubble"><TypingMessage key={introId} id={introId} text={active.phase === 'break' ? '목표까지 잘 왔네. 잠깐 쉬었다 가자.' : '응, 무슨 일이야?'} seen={seen} onProgress={scrollLatest} /></p>
            </article>
            {messages.map(message => (
              <article key={message.id} className="chat-message" data-sender={message.sender}>
                {message.sender === 'character' && <div className="chat-message-meta"><img src={getCharacterArtwork(selected.id).affection} alt="" /><span>{selected.name}</span>{message.createdAt && <time dateTime={new Date(message.createdAt).toISOString()}>{messageTime.format(message.createdAt)}</time>}</div>}
                <p className="chat-message-bubble">
                  {message.voice && <span className="chat-message-voice"><Icon name="microphone" size={14} />음성 메시지 체험 · 0:04</span>}
                  {message.sender === 'character'
                    ? <TypingMessage id={message.id} text={message.text} seen={seen} onProgress={scrollLatest} />
                    : message.text}
                </p>
                {message.sender === 'user' && <div className="chat-message-delivery"><Icon name="check" size={12} />보냄{message.createdAt && <time dateTime={new Date(message.createdAt).toISOString()}>{messageTime.format(message.createdAt)}</time>}</div>}
              </article>
            ))}
          </div>
          <footer className="session-chat-footer">
            {exhausted ? <button type="button" className="session-chat-limit" onPointerDown={event => event.preventDefault()} onClick={() => setUpgradeOpen(true)}>무료 대화를 모두 사용했어요 · 옵션 올리기</button> : <div className="session-chat-suggestions" aria-label="빠른 메시지">{['파이팅', '졸려', '이거 어려워'].map(text => <button key={text} type="button" onPointerDown={event => event.preventDefault()} onClick={() => send(text)}>{text}</button>)}</div>}
            <ChatComposer name={selected.name} text={drafts[selected.id] ?? ''} onChange={text => setDrafts(previous => ({ ...previous, [selected.id]: text }))} onSend={send} disabled={exhausted} />
          </footer>
          {upgradeOpen && <UpgradePanel onClose={() => setUpgradeOpen(false)} now={now} />}
        </>}
      </dialog>
    </div>
  )
}
