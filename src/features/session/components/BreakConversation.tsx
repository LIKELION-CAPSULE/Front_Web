import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import type { Character } from '@/features/characters/types'
import { useDemo } from '@/features/demo/demo-context'
import { tierById } from '@/features/demo/catalog'
import { number } from '@/shared/lib/format'
import { Badge } from '@/shared/ui/Badge'
import { Tabs } from '@/shared/ui/Tabs'
import { cn } from '@/shared/lib/cn'
import { ChatComposer } from './ChatComposer'
import { UpgradePanel } from './UpgradePanel'
import { sessionAssets } from '../assets'

export function BreakConversation({
  characters,
  selected,
  onSelect,
  onSend,
  used,
  upgradeOpen,
  setUpgradeOpen,
  now,
}: {
  characters: readonly Character[]
  selected: Character
  onSelect: (id: string) => void
  onSend: (text: string, voice?: boolean) => void
  used: number
  upgradeOpen: boolean
  setUpgradeOpen: (value: boolean) => void
  now: number
}) {
  const { state } = useDemo()
  const active = state.activeSession!
  const messages = state.messages.filter(
    (message) => message.sessionId === active.id && message.characterId === selected.id,
  )
  const list = useRef<HTMLDivElement>(null)
  const exhausted = active.tier === 'basic' && used >= 3
  useEffect(() => {
    list.current?.scrollTo({ top: list.current.scrollHeight })
  }, [state.messages.length, selected.id])
  return (
    <aside className="break-conversation">
      <div className="p-5 pb-0">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-[17px] font-bold">쉬는 시간 대화</h1>
          <Link to="/credits">
            <Badge className="bg-brand-soft">
              크레딧 <strong className="ml-1 font-mono text-ink">{number(state.credits)}</strong>
            </Badge>
          </Link>
        </div>
        {characters.length > 1 && (
          <div className="mt-3">
            <Tabs
              label="대화 상대"
              options={characters.map((character) => ({ id: character.id, label: character.name }))}
              value={selected.id}
              onChange={onSelect}
            />
          </div>
        )}
        <div className="mt-3 rounded-[14px] bg-brand-soft p-3.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-bold">
              {tierById(active.tier).name} ·{' '}
              {active.tier === 'basic' ? `오늘 무료 대화 ${used}/3턴` : '이번 공부 자유 대화'}
            </p>
            {exhausted ? (
              <span className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <img key={i} src={sessionAssets.turnDot} alt="" />
                ))}
              </span>
            ) : (
              active.tier !== 'special' && (
                <button
                  onClick={() => setUpgradeOpen(!upgradeOpen)}
                  className="button-subtle rounded-full border border-transparent px-2.5 py-0.5 text-[11px] text-brand-strong"
                >
                  올리기
                </button>
              )
            )}
          </div>
          <p className="mt-2 text-[11px] leading-4 text-muted">
            {active.tier === 'basic'
              ? '새벽 5시에 다시 3턴 · 올리면 이번 공부 자유 대화'
              : '오늘 공부 내용 반영 · 쉬는 시간 끝까지'}
          </p>
        </div>
      </div>
      <div
        ref={list}
        role="log"
        aria-label={`${selected.name}과의 대화`}
        className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4"
      >
        <div className="message-bubble">
          <p className="text-[11px] font-bold text-brand">{selected.name}</p>
          <p className="mt-1 text-sm">목표까지 잘 왔네. 잠깐 쉬었다 가자.</p>
        </div>
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn('message-bubble', message.sender === 'user' && 'message-user')}
          >
            <p
              className={cn(
                'text-[11px] font-bold',
                message.sender === 'character' ? 'text-brand' : 'text-white/70',
              )}
            >
              {message.sender === 'character' ? selected.name : state.profile.name}
            </p>
            {message.voice && (
              <span className="mt-1 flex items-center gap-1.5 text-[11px]">
                <img src={sessionAssets.voiceMessage} alt="" />
                샘플 음성 메시지 0:04
              </span>
            )}
            <p className="mt-1 text-sm leading-6">{message.text}</p>
          </div>
        ))}
      </div>
      {exhausted && (
        <button
          onClick={() => setUpgradeOpen(true)}
          className="mx-5 mb-3 rounded-control bg-surface px-4 py-3 text-sm font-bold text-brand-strong"
        >
          무료 대화를 모두 사용했어요 · 등급 올리기
        </button>
      )}
      <ChatComposer name={selected.name} onSend={onSend} disabled={exhausted} />
      {upgradeOpen && <UpgradePanel onClose={() => setUpgradeOpen(false)} now={now} />}
    </aside>
  )
}
