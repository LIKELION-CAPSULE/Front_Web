import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useDemo } from '@/features/demo/demo-context'
import { relationship } from '@/features/demo/selectors'
import { getStudyRooms } from '@/features/rooms/services/room-service'
import { dateLabel, dayKey } from '@/shared/lib/format'
import { ButtonLink } from '@/shared/ui/Button'
import { Panel } from '@/shared/ui/Panel'
import { cn } from '@/shared/lib/cn'
import NotFoundPage from './NotFoundPage'
import { CharacterAvatar } from '@/features/characters/components/CharacterAvatar'
import { CharacterArtwork } from '@/features/characters/components/CharacterArtwork'
import { RelationshipProgress } from '@/features/characters/components/RelationshipProgress'
import { PageHeading } from '@/shared/ui/PageHeading'
import { characterTags } from '@/features/characters/character-tags'
import { SearchField } from '@/shared/ui/SearchField'

export default function CharactersPage() {
  const { characterId = 'chaerin' } = useParams()
  const { state } = useDemo()
  const [now] = useState(Date.now)
  const [query, setQuery] = useState('')
  const rooms = getStudyRooms()
  const search = query.trim().replace(/\s+/g, '').toLocaleLowerCase('ko-KR')
  const characters = rooms.flatMap((item) => item.characters)
  const filteredCharacters = characters.filter((item) =>
    item.name.replace(/\s+/g, '').toLocaleLowerCase('ko-KR').includes(search),
  )
  const room = rooms.find((item) =>
    item.characters.some((character) => character.id === characterId),
  )
  const character = room?.characters.find((item) => item.id === characterId)
  if (!room || !character) return <NotFoundPage />
  const relation = relationship(state, character.id)
  const allRecords = state.records.filter((record) => record.characterIds.includes(character.id))
  const recent = allRecords.slice(0, 3)
  const firstMet = allRecords.at(-1)?.startedAt ?? now
  const hashtags = characterTags(`${room.name} · ${character.description}`)
  return (
    <div className="characters-page">
      <PageHeading title="함께한 만큼, 가까이." eyebrow={null} />
      <section className="character-browser" aria-label="캐릭터 찾기">
        <div className="character-browser-header">
          <h2 className="text-sm font-semibold">캐릭터</h2>
          <SearchField label="캐릭터 이름 검색" placeholder="캐릭터 이름 검색" value={query} onChange={setQuery} clearLabel="캐릭터 검색어 지우기" />
        </div>
        <div
          aria-label="캐릭터 고르기"
          className="character-picker flex flex-wrap gap-2"
        >
          {filteredCharacters.map((item) => (
            <Link
              key={item.id}
              to={`/characters/${item.id}`}
              className={cn(
                'character-picker-item inline-flex items-center gap-2 rounded-full py-1.5 pr-4 pl-1.5 text-xs',
                item.id === character.id && 'is-selected',
              )}
              aria-current={item.id === character.id ? 'page' : undefined}
            >
              <CharacterAvatar characterId={item.id} />
              {item.name}
            </Link>
          ))}
        </div>
        {search && (
          <p className="mt-3 text-xs text-subtle" role="status">
            {filteredCharacters.length
              ? `${filteredCharacters.length}명의 캐릭터를 찾았어요.`
              : '검색한 이름의 캐릭터가 없어요.'}
          </p>
        )}
      </section>
      <div className="grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Panel bordered={false} className="character-profile flex min-h-[640px] flex-col rounded-panel">
          <div className="character-profile-portrait">
            <CharacterArtwork characterId={character.id} pose="affection" variant="portrait" />
          </div>
          <div className="mt-4 flex items-center justify-between gap-3">
            <h2 className="text-[26px] font-bold">{character.name}</h2>
            <p className="shrink-0 text-right text-[10px] text-subtle">
              처음 만난 날
              <time dateTime={dayKey(firstMet)} className="mt-1 block text-xs text-muted">
                {dayKey(firstMet).replaceAll('-', '.')}
              </time>
            </p>
          </div>
          <ul aria-label="캐릭터 소개" className="character-profile-tags">
            {hashtags.map((tag) => <li key={tag}>{tag}</li>)}
          </ul>
          <RelationshipProgress key={character.id} level={relation.level} next={relation.next} />
          <p className="mt-2 text-[17px] font-bold">Lv.{relation.level} 친구</p>
          <div className="character-profile-actions mt-auto pt-8">
            <ButtonLink
              to={
                state.activeSession
                  ? `/study/${state.activeSession.id}`
                  : `/rooms/${room.id}/prepare${state.cameraChecked ? '?step=set' : ''}`
              }
              className="w-full border-0"
            >
              {character.name}이랑 공부하기
            </ButtonLink>
            <Link
              to={`/characters/${character.id}/shop`}
              className="mx-auto mt-4 block w-fit py-1 text-sm text-brand-strong underline underline-offset-4 hover:text-ink"
            >
              선물 · 보이스 보내기
            </Link>
          </div>
        </Panel>
        <div className="space-y-content">
          <Panel title="관계가 바뀐 이유" bordered={false} className="character-reasons-panel">
            {recent.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
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
          <section className="character-unlocks">
            <h2 className="mb-4 text-card-title font-semibold">
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
                <article
                  key={item.kind}
                  className={cn(
                    'character-unlock-card min-h-24 rounded-[14px] p-3 text-left',
                    item.unlocked ? 'bg-panel' : 'bg-surface',
                  )}
                  data-kind={item.kind}
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
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
