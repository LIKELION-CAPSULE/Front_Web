import { useMemo, useState } from 'react'
import { findReviewScenario } from './catalog'
import { messagePreview, reviewMessageScenarios, reviewMessageTones } from './messages'
import type { ReviewLiveMessage, ReviewMessageEntry, ReviewMessageTone } from './messages'

export function ReviewMessagesPanel({ entries, messages, error, selected, onSelect, onReload, onCopy }: {
  entries: ReviewMessageEntry[] | null
  messages: ReviewLiveMessage[]
  error: string
  selected: string
  onSelect: (id: string) => void
  onReload: () => void
  onCopy: (text: string) => void
}) {
  const [filter, setFilter] = useState<ReviewMessageTone | 'all'>('all')
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(50)
  const query = search.trim().toLocaleLowerCase('ko-KR')
  const source = useMemo(() => (entries ?? []).filter(entry => entry.statusTone
    && (filter === 'all' || entry.statusTone === filter)
    && `${entry.text} ${entry.file}`.toLocaleLowerCase('ko-KR').includes(query)), [entries, filter, query])
  const scenarios = reviewMessageScenarios.filter(item => {
    const scenario = findReviewScenario(item.id)
    return (filter === 'all' || item.tone === filter) && `${scenario.title} ${scenario.note} ${scenario.group}`.toLocaleLowerCase('ko-KR').includes(query)
  })
  return <section className="review-inspector" role="tabpanel" id="review-panel-messages" aria-labelledby="review-tab-messages">
    <div className="review-inspector-heading"><div><h3>상황별 상태 문구</h3><p>오류·완료·로딩·빈 상태에 표시되는 문구를 확인합니다. 실제 소스의 문구와 현재 화면의 표시 결과를 구분해 볼 수 있어요.</p></div><button className="review-button" onClick={onReload}>소스 다시 읽기</button></div>
    <section className="review-live-messages" aria-labelledby="review-live-messages-title">
      <div><h4 id="review-live-messages-title">현재 화면에 표시된 상태 문구</h4><span>{findReviewScenario(selected).title}</span></div>
      {messages.length ? messages.map((message, index) => <article className="review-message-card" data-tone={message.tone} key={`${index}:${message.text}`}>
        <span className="review-message-tone">{reviewMessageTones[message.tone].icon} {reviewMessageTones[message.tone].label}</span><p>{message.text}</p><button className="review-button" onClick={() => onCopy(message.text)}>문구 복사</button>
      </article>) : <p className="review-muted">아직 감지된 상태 문구가 없어요. 아래에서 상황을 열거나 미리보기에서 버튼을 눌러 확인해 주세요.</p>}
    </section>
    <div className="review-message-filters" role="group" aria-label="상태 문구 종류">
      <button className="review-button" aria-pressed={filter === 'all'} onClick={() => { setFilter('all'); setLimit(50) }}>전체</button>
      {Object.entries(reviewMessageTones).map(([tone, item]) => <button key={tone} className="review-button" aria-pressed={filter === tone} onClick={() => { setFilter(tone as ReviewMessageTone); setLimit(50) }}>{item.label}</button>)}
    </div>
    <label className="review-search"><span className="sr-only">상태 문구 검색어</span><input type="search" value={search} onChange={event => { setSearch(event.target.value); setLimit(50) }} placeholder="예: 저장, 로그인, 만료, 권한" /></label>
    <section className="review-message-scenarios" aria-label="상태 문구 상황 바로가기">
      <h4>상황을 열어 실제 위치에서 확인</h4>
      <div>{scenarios.map(item => {
        const scenario = findReviewScenario(item.id)
        return <button className="review-message-scenario" key={item.id} onClick={() => onSelect(item.id)}><span>{reviewMessageTones[item.tone].label}</span><strong>{scenario.title}</strong><small>{scenario.note}</small><span aria-hidden="true">↗</span></button>
      })}</div>
    </section>
    <div className="review-inspector-heading"><div><h4>소스에 정의된 상태 문구 · {source.length}개</h4><p>표시하지 않은 분기도 포함합니다. ‘이 상황 보기’는 준비된 상황을, ‘관련 화면’은 문구가 사용되는 흐름을 엽니다.</p></div></div>
    {error && <p role="alert">{error}</p>}
    {entries === null && !error && <p role="status">상태 문구를 읽고 있어요…</p>}
    <ol className="review-message-list">{source.slice(0, limit).map(entry => {
      const tone = entry.statusTone!, preview = messagePreview(entry)
      return <li key={entry.id} className="review-message-card" data-tone={tone}>
        <div className="review-message-meta"><span className="review-message-tone">{reviewMessageTones[tone].icon} {reviewMessageTones[tone].label}</span><button className="review-text-button" title="파일 위치 복사" onClick={() => onCopy(`${entry.file}:${entry.line}`)}>{entry.file}:{entry.line}</button></div>
        <p>{entry.text}</p><div className="review-message-actions"><button className="review-button" onClick={() => onCopy(entry.text)}>문구 복사</button>{preview && <button className="review-button" onClick={() => onSelect(preview.id)}>{preview.exact ? '이 상황 보기' : '관련 화면'} ↗</button>}</div>
      </li>
    })}</ol>
    {entries !== null && !source.length && <p className="review-empty">일치하는 상태 문구가 없어요.</p>}
    {source.length > limit && <button className="review-button review-message-more" onClick={() => setLimit(value => value + 50)}>50개 더 보기 · {limit} / {source.length}</button>}
  </section>
}
