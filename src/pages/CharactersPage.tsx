import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { relationship } from '@/features/demo/selectors'
import { getStudyRooms } from '@/features/rooms/services/room-service'
import { MemoryEditor } from '@/features/characters/components/MemoryEditor'
import type { Memory } from '@/features/demo/types'
import { dateLabel } from '@/shared/lib/format'
import { Badge } from '@/shared/ui/Badge'
import { ButtonLink } from '@/shared/ui/Button'
import { Panel } from '@/shared/ui/Panel'
import { cn } from '@/shared/lib/cn'
import NotFoundPage from './NotFoundPage'
import { getCharacterArtwork } from '@/features/characters/artwork'
import { Avatar } from '@/shared/ui/Avatar'
import { Icon } from '@/shared/ui/Icon'
import { RoomArtwork } from '@/features/rooms/components/RoomArtwork'

export default function CharactersPage() {
  const { characterId = 'chaerin' } = useParams()
  const { state } = useDemo()
  const [now] = useState(Date.now)
  const [editor, setEditor] = useState<Memory | 'new' | null>(null)
  const [content, setContent] = useState('')
  const rooms = getStudyRooms()
  const room = rooms.find((item) =>
    item.characters.some((character) => character.id === characterId),
  )
  const character = room?.characters.find((item) => item.id === characterId)
  if (!room || !character) return <NotFoundPage />
  const relation = relationship(state, character.id)
  const memories = state.memories.filter((memory) => memory.characterId === character.id)
  const allRecords = state.records.filter((record) => record.characterIds.includes(character.id))
  const recent = allRecords.slice(0, 3)
  return (
    <>
      <div className="mb-7">
        <p className="eyebrow mb-3">OUR LITTLE STORY</p>
        <h1 className="text-[30px] font-bold">함께한 만큼, 가까이.</h1>
        <p className="mt-2 text-sm text-muted">조금씩 쌓인 공부 시간이 우리만의 이야기가 돼요.</p>
      </div>
      <div aria-label="캐릭터 고르기" className="character-picker mb-6 flex flex-wrap gap-2">
        {rooms
          .flatMap((item) => item.characters)
          .map((item) => (
            <Link
              key={item.id}
              to={`/characters/${item.id}`}
              className={cn(
                'inline-flex items-center gap-2 rounded-full border py-1.5 pr-4 pl-1.5 text-xs',
                item.id === character.id
                  ? 'border-brand bg-brand-solid text-white'
                  : 'border-line text-muted',
              )}
            >
              <Avatar src={item.avatarUrl} />
              {item.name}
            </Link>
          ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <section className="character-profile flex min-h-[640px] flex-col rounded-panel border border-line bg-panel p-[22px]">
          <div className="character-profile-portrait">
            {character.id === 'doyun' || character.id === 'moru' ? (
              <RoomArtwork roomId={room.id} variant="portrait" />
            ) : (
              <img
                src={getCharacterArtwork(character.id).affection}
                alt={`${character.name}의 모습`}
                style={{ objectPosition: getCharacterArtwork(character.id).position }}
              />
            )}
            <span className="scene-chip">
              <Icon name="heart" size={13} /> 우리의 이야기
            </span>
          </div>
          <h2 className="mt-4 text-[26px] font-bold">{character.name}</h2>
          <p className="mt-2 text-sm text-muted">
            {room.name} · {character.description}
          </p>
          <div className="mt-4 flex gap-1">
            {[1, 2, 3, 4, 5].map((level) => (
              <span
                key={level}
                className={cn(
                  'h-3 flex-1 rounded-full',
                  relation.level >= level ? 'bg-brand-solid' : 'bg-line',
                )}
              />
            ))}
          </div>
          <p className="mt-2 text-[17px] font-bold">Lv.{relation.level} 친구</p>
          <p className="mt-3 text-sm leading-6 text-muted">
            다음 단계까지 함께 {relation.next}분<br />
            처음 만난 날 {dateLabel(allRecords.at(-1)?.startedAt ?? now)}
          </p>
          <div className="mt-auto space-y-3 pt-12">
            <ButtonLink
              to={`/characters/${character.id}/shop`}
              variant="secondary"
              className="min-h-12 w-full border-brand-line py-3 text-sm text-brand-strong"
            >
              선물 · 보이스 보내기
            </ButtonLink>
            <ButtonLink
              to={
                state.activeSession
                  ? `/study/${state.activeSession.id}`
                  : `/rooms/${room.id}/prepare${state.cameraChecked ? '?step=set' : ''}`
              }
              className="min-h-12 w-full py-3 text-sm"
            >
              {character.name}이랑 공부하기
            </ButtonLink>
          </div>
        </section>
        <div className="space-y-5">
          <Panel title="관계가 바뀐 이유">
            {recent.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between gap-3 border-t border-divider py-3 text-sm"
              >
                <span className="text-xs text-subtle">{dateLabel(record.endedAt)}</span>
                <span className="flex-1">
                  함께 공부 {Math.floor(record.studySeconds / 60 / record.characterIds.length)}분
                </span>
                <strong>
                  +{Math.floor(record.studySeconds / 60 / record.characterIds.length)}
                </strong>
              </div>
            ))}
          </Panel>
          <section>
            <h2 className="mb-3 font-bold">
              해금 콘텐츠 <span className="font-normal text-subtle">2 / 6</span>
            </h2>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {[
                {
                  kind: '대사',
                  name: '“내일도 와라”',
                  unlocked: true,
                  description: '열림 · 함께한 공부 시간',
                },
                {
                  kind: '모션',
                  name: '손 흔들기',
                  unlocked: true,
                  description: '열림 · 첫 공부 완료',
                },
                {
                  kind: '스토리',
                  name: '1화 · 창가 자리',
                  unlocked: false,
                  description: '다음 관계 단계에서 열림',
                },
                {
                  kind: '음성',
                  name: '특별 응원 음성',
                  unlocked: false,
                  description: 'Lv.4에서 열림',
                },
                { kind: '배경', name: '밤 교실', unlocked: false, description: '추후 공개' },
                {
                  kind: '이벤트',
                  name: '시험기간 응원',
                  unlocked: false,
                  description: '이벤트 기간에만',
                },
              ].map((item) => (
                <button
                  key={item.kind}
                  type="button"
                  onClick={() =>
                    setContent(
                      item.unlocked
                        ? item.kind === '대사'
                          ? '“내일도 와라. 네 자리 비워 둘게.”'
                          : '손을 흔들며 인사해요. 모션은 데모 안내로 보여 드려요.'
                        : item.description,
                    )
                  }
                  className={cn(
                    'min-h-24 rounded-[14px] border p-3 text-left',
                    item.unlocked
                      ? 'border-line bg-panel'
                      : 'border-dashed border-subtle/50 bg-surface',
                  )}
                >
                  <span className="block text-xs text-muted">{item.kind}</span>
                  <strong className="mt-2 block text-sm">{item.name}</strong>
                  <span
                    className={cn(
                      'mt-2 block text-[11px]',
                      item.unlocked ? 'text-emerald-300' : 'text-muted',
                    )}
                  >
                    {item.description}
                  </span>
                </button>
              ))}
            </div>
            {content && (
              <p role="status" className="mt-3 rounded-control bg-surface p-3 text-sm">
                {content}
              </p>
            )}
          </section>
          <Panel className="border-brand-line bg-brand-soft">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="font-bold">{character.name}이 기억하는 것</h2>
                <p className="mt-1 text-xs leading-5 text-muted">
                  시험 · 목표 · 약속을 기억해서 인사와 대화에 써요
                </p>
              </div>
              <button
                onClick={() => setEditor('new')}
                className="shrink-0 rounded-full bg-brand-solid px-3 py-2 text-xs font-bold text-white"
              >
                + 시험 추가
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {memories.length ? (
                memories.map((memory) => (
                  <div
                    key={memory.id}
                    className="flex flex-wrap items-center gap-3 rounded-[10px] bg-panel px-3 py-2 text-sm"
                  >
                    <Badge>{memory.kind}</Badge>
                    <span className="min-w-24 flex-1">{memory.title}</span>
                    <span className="text-xs text-muted">
                      {memory.date.slice(5)} {memory.time}
                    </span>
                    <button
                      onClick={() => setEditor(memory)}
                      className="text-xs text-brand underline"
                    >
                      고치기
                    </button>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted">함께 기억할 첫 약속을 추가해 보세요.</p>
              )}
            </div>
          </Panel>
        </div>
      </div>
      {editor && (
        <MemoryEditor
          key={editor === 'new' ? 'new' : editor.id}
          characterId={character.id}
          initial={editor === 'new' ? undefined : editor}
          onClose={() => setEditor(null)}
        />
      )}
    </>
  )
}
