import { useEffect, useMemo, useRef, useState } from 'react'
import { findReviewScenario, reviewGroups, reviewPreviewUrl, reviewScenarios } from './catalog'
import './workbench.css'
import { ReviewMessagesPanel } from './ReviewMessagesPanel'
import { reviewMessageTones } from './messages'
import type { ReviewLiveMessage, ReviewMessageEntry } from './messages'
import { captureReviewMessages } from './capture-messages'

type CopyEntry = ReviewMessageEntry
type RequestEntry = { method: string; path: string; status: number }
type Tab = 'preview' | 'messages' | 'visible' | 'source' | 'requests'
const sizes = [360, 390, 768, 1280, 1440]
const progressKey = 'capsule-ui-review:checked:v1'
const params = () => new URLSearchParams(location.search)
function savedChecks(): Set<string> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(progressKey) ?? '[]')
    return new Set(Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string' && reviewScenarios.some(scenario => scenario.id === id)) : [])
  } catch { return new Set() }
}

export function ReviewWorkbench() {
  const [selected, setSelected] = useState(() => findReviewScenario(params().get('case')).id)
  const [width, setWidth] = useState(() => sizes.find(size => size === Number(params().get('width'))) ?? 1280)
  const [tab, setTab] = useState<Tab>('preview')
  const [search, setSearch] = useState('')
  const [copySearch, setCopySearch] = useState('')
  const [checked, setChecked] = useState(savedChecks)
  const [revision, setRevision] = useState(0)
  const [ready, setReady] = useState(false)
  const [notice, setNotice] = useState('')
  const [texts, setTexts] = useState<string[]>([])
  const [messages, setMessages] = useState<ReviewLiveMessage[]>([])
  const [path, setPath] = useState('')
  const [requests, setRequests] = useState<RequestEntry[]>([])
  const [entries, setEntries] = useState<CopyEntry[] | null>(null)
  const [copyError, setCopyError] = useState('')
  const [page, setPage] = useState(0)
  const [available, setAvailable] = useState(1000)
  const frame = useRef<HTMLIFrameElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  const scenario = findReviewScenario(selected)
  const index = reviewScenarios.findIndex(item => item.id === selected)
  const scale = Math.min(1, Math.max(0.15, (available - 48) / width))
  const height = width < 768 ? 844 : 900
  const filtered = reviewScenarios.filter(item => `${item.title} ${item.group} ${item.note} ${item.path}`.toLowerCase().includes(search.toLowerCase().trim()))
  const matches = useMemo(() => (entries ?? []).filter(entry => `${entry.text} ${entry.file} ${entry.kind}`.toLowerCase().includes(copySearch.toLowerCase().trim())), [entries, copySearch])
  const pageCount = Math.max(1, Math.ceil(matches.length / 60))
  const currentPage = Math.min(page, pageCount - 1)

  function select(id: string) {
    setSelected(id); setRevision(value => value + 1); setReady(false); setNotice(''); setTexts([]); setMessages([]); setRequests([]); setPath(''); setTab('preview')
    const url = new URL(location.href)
    url.searchParams.set('case', id); url.searchParams.set('width', String(width))
    history.replaceState(null, '', url)
  }
  function resize(value: number) {
    setWidth(value)
    const url = new URL(location.href); url.searchParams.set('width', String(value)); history.replaceState(null, '', url)
  }
  function reload() { setReady(false); setNotice(''); setMessages([]); setRequests([]); setRevision(value => value + 1) }
  function toggleCheck() {
    const next = new Set(checked)
    if (next.has(selected)) next.delete(selected)
    else next.add(selected)
    setChecked(next)
    try { localStorage.setItem(progressKey, JSON.stringify([...next])) } catch { /* Review still works without saved progress. */ }
  }
  async function copy(text: string) {
    try { await navigator.clipboard.writeText(text); setNotice('클립보드에 복사했어요.') }
    catch { setNotice('클립보드에 접근하지 못했어요. 문구를 선택해 직접 복사해 주세요.') }
  }
  async function loadCopy() {
    try {
      const response = await fetch('/__review/copy', { cache: 'no-store' })
      if (!response.ok) throw new Error()
      const result = await response.json() as { entries: CopyEntry[] }
      setEntries(result.entries); setCopyError('')
    } catch { setCopyError('문구 목록을 불러오지 못했어요. 개발 서버가 실행 중인지 확인해 주세요.') }
  }
  function changeTab(value: Tab) {
    const document = frame.current?.contentDocument
    if (document) setMessages(captureReviewMessages(document))
    setTab(value)
    if ((value === 'source' || value === 'messages') && entries === null) void loadCopy()
  }

  useEffect(() => {
    document.title = 'CAPSULE · UI/UX 검토'
    const container = stage.current
    if (!container) return
    const observer = new ResizeObserver(([entry]) => { if (entry) setAvailable(entry.contentRect.width) })
    observer.observe(container)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin || event.source !== frame.current?.contentWindow || !event.data || typeof event.data !== 'object') return
      const data = event.data as Record<string, unknown>
      if (data.type === 'capsule-review:ready') setReady(true)
      if (data.type === 'capsule-review:notice' && typeof data.text === 'string') setNotice(data.text)
      if (data.type === 'capsule-review:copy' && Array.isArray(data.texts)) {
        setTexts(data.texts.filter((text): text is string => typeof text === 'string'))
        if (Array.isArray(data.messages)) setMessages(data.messages.filter((message): message is ReviewLiveMessage =>
          !!message && typeof message === 'object' && typeof message.text === 'string' && typeof message.tone === 'string' && Object.hasOwn(reviewMessageTones, message.tone)))
        if (typeof data.path === 'string') setPath(data.path)
      }
      if (data.type === 'capsule-review:request' && typeof data.method === 'string' && typeof data.path === 'string' && typeof data.status === 'number') {
        const request = { method: data.method, path: data.path, status: data.status }
        setRequests(previous => [...previous.slice(-99), request])
      }
    }
    window.addEventListener('message', receive)
    return () => window.removeEventListener('message', receive)
  }, [])

  return <main className="review-workbench">
    <header className="review-header">
      <a href="/__review" className="review-brand"><span aria-hidden="true">◫</span> CAPSULE <span>UI/UX 검토</span></a>
      <span className="review-safe">가상 데이터 · 실제 API 호출 없음</span>
      <a href="/" target="_blank" rel="noopener noreferrer" className="review-button">앱 열기 ↗</a>
    </header>
    <div className="review-layout">
      <aside className="review-sidebar" aria-label="검토할 화면">
        <div className="review-sidebar-top">
          <div className="review-sidebar-title"><h1>화면과 상태</h1><span>{reviewScenarios.length}개</span></div>
          <label className="review-search"><span className="sr-only">화면 검색</span><input type="search" placeholder="화면·문구·경로 검색" value={search} onChange={event => setSearch(event.target.value)} /></label>
          <div className="review-progress"><span>검토 완료 {checked.size} / {reviewScenarios.length}</span><progress value={checked.size} max={reviewScenarios.length} aria-label="화면 검토 진행률" /></div>
        </div>
        <nav className="review-scenarios">
          {reviewGroups.map(group => {
            const items = filtered.filter(item => item.group === group)
            return items.length ? <section key={group}>
              <h2>{group}</h2>
              {items.map(item => <button key={item.id} type="button" className={`review-scenario${selected === item.id ? ' is-selected' : ''}`} aria-current={selected === item.id ? 'true' : undefined} onClick={() => select(item.id)}>
                <span className="review-check" aria-label={checked.has(item.id) ? '검토 완료' : '미검토'}>{checked.has(item.id) ? '✓' : '○'}</span>
                <span>{item.title}</span>{item.draft && <small>보관</small>}
              </button>)}
            </section> : null
          })}
          {!filtered.length && <p className="review-muted review-empty">검색한 화면이 없어요.</p>}
        </nav>
      </aside>
      <section className="review-content" aria-label="선택한 화면 검토">
        <div className="review-heading">
          <div><p>{scenario.group}</p><h2>{scenario.title}</h2><span>{scenario.note}</span></div>
          <div className="review-heading-actions">
            <button className="review-button" onClick={() => select(reviewScenarios[index - 1]!.id)} disabled={index === 0} aria-label="이전 화면">←</button>
            <span className="review-muted">{index + 1} / {reviewScenarios.length}</span>
            <button className="review-button" onClick={() => select(reviewScenarios[index + 1]!.id)} disabled={index === reviewScenarios.length - 1} aria-label="다음 화면">→</button>
            <button className={`review-button${checked.has(selected) ? ' is-checked' : ''}`} aria-pressed={checked.has(selected)} onClick={toggleCheck}>✓ 검토 완료</button>
          </div>
        </div>
        <div className="review-toolbar">
          <div className="review-tabs" role="tablist" aria-label="검토 도구" onKeyDown={event => {
            const tabs: Tab[] = ['preview', 'messages', 'visible', 'source', 'requests']
            const current = tabs.indexOf(tab)
            const next = event.key === 'ArrowRight' ? (current + 1) % tabs.length : event.key === 'ArrowLeft' ? (current + tabs.length - 1) % tabs.length : event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : -1
            if (next < 0) return
            event.preventDefault(); changeTab(tabs[next]!)
            event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[next]?.focus()
          }}>
            {([['preview', '화면'], ['messages', `상태 문구${messages.length ? ` ${messages.length}` : ''}`], ['visible', `현재 문구 ${texts.length}`], ['source', '전체 문구 검색'], ['requests', `가상 요청 ${requests.length}`]] as const).map(([id, title]) => <button key={id} role="tab" tabIndex={tab === id ? 0 : -1} aria-selected={tab === id} aria-controls={`review-panel-${id}`} id={`review-tab-${id}`} onClick={() => changeTab(id)}>{title}</button>)}
          </div>
          <div className="review-size-controls">
            <label><span className="sr-only">미리보기 너비</span><select value={width} onChange={event => resize(Number(event.target.value))}>{sizes.map(size => <option value={size} key={size}>{size}px{size === 390 ? ' · 모바일' : size === 768 ? ' · 태블릿' : size === 1280 ? ' · 데스크톱' : ''}</option>)}</select></label>
            <button className="review-button" onClick={reload}>상태 초기화</button>
            <button className="review-button" onClick={() => { void copy(location.href) }}>링크 복사</button>
          </div>
        </div>
        {notice && <div role="status" className="review-notice"><span>{notice}</span><button aria-label="안내 닫기" onClick={() => setNotice('')}>×</button></div>}
        <div className="review-preview" ref={stage} hidden={tab !== 'preview'} role="tabpanel" id="review-panel-preview" aria-labelledby="review-tab-preview">
          <div className="review-preview-meta"><code>{path || scenario.path}</code><span>{width} × {height} · {Math.round(scale * 100)}%{ready ? ' · 준비 완료' : ' · 상태 준비 중'}</span></div>
          <div className="review-frame-area"><div className="review-frame-shell" style={{ width: width * scale, height: height * scale }}>
            <iframe ref={frame} key={`${selected}:${revision}`} name={`capsule-ui-review:${selected}`} title={`${scenario.title} 미리보기`} src={reviewPreviewUrl(scenario)} width={width} height={height}
              style={{ transform: `scale(${scale})` }} sandbox="allow-scripts allow-same-origin allow-forms allow-downloads" allow="camera 'none'; microphone 'none'" />
          </div></div>
          <p className="review-preview-tip">미리보기 안에서 버튼·입력·스크롤을 직접 확인할 수 있어요. 초기 상태로 돌아가려면 ‘상태 초기화’를 눌러 주세요.{scenario.draft && ' 보관 화면은 현재 서비스에 공개되지 않은 원본 UI예요.'}</p>
        </div>
        {tab === 'messages' && <ReviewMessagesPanel entries={entries} messages={messages} selected={selected} error={copyError} onSelect={select} onReload={() => { void loadCopy() }} onCopy={text => { void copy(text) }} />}
        {tab === 'visible' && <section className="review-inspector" role="tabpanel" id="review-panel-visible" aria-labelledby="review-tab-visible">
          <div className="review-inspector-heading"><div><h3>현재 화면에서 보이는 문구</h3><p>본문·버튼·접근성 이름·입력 안내를 포함합니다. 창을 열거나 화면을 조작하면 갱신돼요.</p></div><button className="review-button" onClick={() => { void copy(texts.join('\n')) }}>모두 복사</button></div>
          <textarea aria-label="현재 화면 문구" className="review-copy-text" readOnly value={texts.join('\n')} />
        </section>}
        {tab === 'source' && <section className="review-inspector" role="tabpanel" id="review-panel-source" aria-labelledby="review-tab-source">
          <div className="review-inspector-heading"><div><h3>소스 전체 문구</h3><p>상태·오류·접근성 문구와 약관 전문까지, 숨겨진 분기도 검색합니다. 동적 문구는 변수 표기를 유지해요.</p></div><button className="review-button" onClick={() => { void loadCopy() }}>소스 다시 읽기</button></div>
          <label className="review-search review-copy-search"><span className="sr-only">전체 문구 검색어</span><input type="search" placeholder="문구 또는 파일명 검색 · 예: 탈퇴, 공부, LoginPage" value={copySearch} onChange={event => { setCopySearch(event.target.value); setPage(0) }} /></label>
          {copyError && <p role="alert">{copyError}</p>}
          {entries === null && !copyError ? <p role="status">문구를 읽고 있어요…</p> : <>
            <div className="review-copy-count"><span>{matches.length.toLocaleString()}개 문구 · {new Set(matches.map(entry => entry.file)).size}개 파일</span><div><button className="review-button" disabled={currentPage === 0} onClick={() => setPage(value => value - 1)}>이전</button><span>{currentPage + 1} / {pageCount}</span><button className="review-button" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(value => value + 1)}>다음</button></div></div>
            <ol className="review-copy-list">{matches.slice(currentPage * 60, currentPage * 60 + 60).map(entry => <li key={entry.id}>
              <div><span className="review-copy-kind">{entry.kind}</span><button className="review-text-button" onClick={() => { void copy(`${entry.file}:${entry.line}`) }} title="파일 위치 복사">{entry.file}:{entry.line}</button></div>
              <p>{entry.text}</p><button className="review-button" onClick={() => { void copy(entry.text) }}>문구 복사</button>
            </li>)}</ol>
            {!matches.length && <p className="review-empty">일치하는 문구가 없어요.</p>}
          </>}
        </section>}
        {tab === 'requests' && <section className="review-inspector" role="tabpanel" id="review-panel-requests" aria-labelledby="review-tab-requests">
          <div className="review-inspector-heading"><div><h3>가상 API 요청</h3><p>미리보기 안에서만 처리한 최근 100건입니다. 실제 백엔드로 전송되지 않아요. ‘대기’는 로딩 상태 검토용입니다.</p></div></div>
          <table className="review-request-table"><thead><tr><th>메서드</th><th>경로</th><th>모의 상태</th></tr></thead><tbody>{requests.map((request, i) => <tr key={i}><td>{request.method}</td><td><code>{request.path}</code></td><td>{request.status || '대기'}</td></tr>)}</tbody></table>
        </section>}
      </section>
    </div>
  </main>
}
