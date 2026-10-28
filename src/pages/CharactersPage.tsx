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
import { withParticle } from '@/shared/lib/korean'
import { characterUnlocks } from '@/features/characters/unlocks'

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
  const unlocks = characterUnlocks(allRecords, character.id)
  return (
    <div className="characters-page">
      <section className="character-browser" aria-label="친구 찾기">
        <div className="character-browser-header [&_.page-heading]:mb-0">
          <PageHeading title="공부로 가까워진 사이" eyebrow={null} />
          <SearchField
            label="친구 이름 검색"
            placeholder="친구 이름 검색"
            value={query}
            onChange={setQuery}
            clearLabel="친구 검색어 지우기"
            className="[--search-width:100%] sm:[--search-width:280px]"
          />
        </div>
        <div
          aria-label="친구 고르기"
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
              ? `${filteredCharacters.length}명의 친구를 찾았어요.`
              : '검색 결과가 없어요. 이름을 다시 확인해 주세요.'}
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
          <ul aria-label="친구 소개" className="character-profile-tags">
            {hashtags.map((tag) => <li key={tag}>{tag}</li>)}
          </ul>
          <RelationshipProgress key={character.id} level={relation.level} next={relation.next} progress={relation.progress} />
          <div className="character-profile-actions mt-auto pt-8">
            <ButtonLink
              to={
                state.activeSession
                  ? `/study/${state.activeSession.id}`
                  : `/rooms/${room.id}/prepare`
              }
              className="w-full border-0"
            >
              {state.activeSession
                ? '진행 중인 공부로 돌아가기'
                : `${withParticle(character.name, '이랑', '랑')} 공부하기`}
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
          <Panel title="함께한 공부" bordered={false} className="character-reasons-panel">
            {recent.map((record) => (
              <div
                key={record.id}
                className="flex items-center justify-between gap-3 py-3 text-sm"
              >
                <span className="text-xs text-subtle">{dateLabel(record.endedAt)}</span>
                <span className="flex-1">
                  함께 {Math.floor(record.studySeconds / 60 / record.characterIds.length)}분 공부
                </span>
                <strong>
                  +{Math.floor(record.studySeconds / 60 / record.characterIds.length)}
                </strong>
              </div>
            ))}
          </Panel>
          <section className="character-unlocks">
            <h2 className="mb-4 text-card-title font-semibold">
              함께 여는 콘텐츠 <span className="font-normal text-subtle">{unlocks.filter((item) => item.unlockedAt !== null).length} / {unlocks.length}</span>
            </h2>
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              {unlocks.map((item) => (
                <article
                  key={item.kind}
                  className={cn(
                    'character-unlock-card min-h-24 rounded-[14px] p-3 text-left',
                    item.unlockedAt !== null ? 'bg-panel' : 'bg-surface',
                  )}
                  data-kind={item.kind}
                >
                  <span className="block text-xs text-muted">{item.kind}</span>
                  <strong className="mt-2 block text-sm">{item.name}</strong>
                  <span
                    className={cn(
                      'mt-2 block text-[11px]',
                      item.unlockedAt !== null ? 'text-emerald-300' : 'text-muted',
                    )}
                  >
                    {item.unlockedAt !== null && (
                      <><time dateTime={dayKey(item.unlockedAt)}>{dayKey(item.unlockedAt).slice(2).replaceAll('-', '.')}</time> 열림 · </>
                    )}
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
