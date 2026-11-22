import { useEffect, useReducer, useState } from 'react'
import { useNavigate } from 'react-router'
import { useBackend } from '../backend/backend-context'
import type { SessionModelStage } from '../live2d/session-model'
import { Icon } from '@/shared/ui/Icon'
import { LOCAL_PANEL_OPEN_KEY } from './storage'
import { localScenarios, type LocalBetaStore, type LocalScenario } from './store'
import './local-demo.css'

const PANEL_OPEN_STORAGE_KEY = LOCAL_PANEL_OPEN_KEY
const labels: Record<LocalScenario, string> = { normal: '일반', empty: '기록 없음', loading: '느린 응답', failure: '실패 후 재시도', exhausted: '크레딧 소진', guest: '로그인 전' }

function readInitialOpen(): boolean {
  try {
    return window.localStorage.getItem(PANEL_OPEN_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function LocalControls({ store, stages }: { store: LocalBetaStore; stages: Set<SessionModelStage> }) {
  const [open, setOpen] = useState(readInitialOpen)
  const [expression, setExpression] = useState('')
  const [, render] = useReducer(value => value + 1, 0)
  const { authenticate } = useBackend()
  const navigate = useNavigate()
  useEffect(() => store.subscribe(render), [store])
  useEffect(() => {
    try {
      window.localStorage.setItem(PANEL_OPEN_STORAGE_KEY, open ? '1' : '0')
    } catch {
      // Ignore storage errors
    }
  }, [open])
  useEffect(() => {
    const openReview = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.code === 'KeyD') {
        event.preventDefault(); window.open('/__review', '_blank', 'noopener,noreferrer')
      }
    }
    window.addEventListener('keydown', openReview)
    return () => window.removeEventListener('keydown', openReview)
  }, [])
  useEffect(() => {
    const timer = setInterval(() => store.expireAttendance(), 15_000)
    return () => clearInterval(timer)
  }, [store])
  useEffect(() => {
    const kakao = () => {
      void authenticate(store.beginOnboarding()).then(() => navigate('/onboarding')).catch(() => {})
    }
    window.addEventListener('capsule-local:kakao', kakao)
    return () => window.removeEventListener('capsule-local:kakao', kakao)
  }, [store, authenticate, navigate])
  const { wallet, settings } = store.data
  return <aside className="local-demo-controls" data-open={open || undefined} aria-label="로컬 더미 도구">
    <button
      className={open ? 'local-demo-toggle' : 'local-demo-icon-toggle'}
      type="button"
      onClick={() => setOpen(value => !value)}
      aria-expanded={open}
      aria-label={open ? '로컬 더미 도구 접기' : `로컬 더미 도구 열기 (${labels[store.data.scenario]})`}
      title={`로컬 더미 · ${labels[store.data.scenario]}`}
    >
      {open ? (
        <>로컬 더미 · {labels[store.data.scenario]} <span>접기</span></>
      ) : (
        <Icon name="sliders" size={16} />
      )}
    </button>
    {open && <div className="local-demo-body">
      <p>이 브라우저에만 저장돼요. 실제 API·메일·결제는 실행하지 않아요.</p>
      <label>상태 초기화<select aria-label="더미 시나리오" value={store.data.scenario} onChange={event => { const scenario = event.target.value as LocalScenario; store.reset(scenario); location.assign(scenario === 'guest' ? '/login' : '/') }}>{localScenarios.map(value => <option key={value} value={value}>{labels[value]}</option>)}</select></label>
      <div className="local-demo-links">{[['/', '홈'], ['/mates/me', '내 메이트'], ['/records', '내 기록'], ['/credits', '크레딧'], ['/credits/charge', '친구 초대']].map(([path, label]) => <button type="button" key={path} onClick={() => navigate(path!)}>{label}</button>)}</div>
      <p>출석 {wallet.attendance.toLocaleString()} · 초대 {wallet.invitation.toLocaleString()} · 사용 {wallet.usedToday.toLocaleString()}</p>
      <button type="button" disabled={store.data.invitation.invitedCount >= 10} onClick={() => store.completeInvitedFriend(`fixture-${store.data.invitation.invitedCount + 1}`)}>초대한 친구 첫 연결 완료 · {store.data.invitation.invitedCount}/10명</button>
      <label><input type="checkbox" checked={settings.voice} onChange={event => store.setSettings({ voice: event.target.checked })} />음성 차감 시뮬레이션 · 20/턴</label>
      <label><input type="checkbox" checked={settings.advanced} onChange={event => store.setSettings({ advanced: event.target.checked })} />고급 모드 시뮬레이션 · 30/턴</label>
      <p>실제 STT/TTS·목소리·립싱크는 미연동입니다. 친밀도·해금 정책은 아직 확정 전이에요.</p>
      <label>모델 표정 파일<select aria-label="채린 표정 파일" value={expression} onChange={event => { setExpression(event.target.value); store.setPreviewExpression(event.target.value || null); for (const stage of stages) stage.setExpression(event.target.value || null) }}><option value="">기본</option>{Array.from({ length: 8 }, (_, i) => <option key={i} value={`files/${String(i + 4).padStart(3, '0')}.exp3.json`}>expression{i + 1}</option>)}</select></label>
      <p>표정 번호는 원본 파일명이며 감정·해금 단계에 임의 배정하지 않았어요.</p>
      <p>이메일 로그인: 형식에 맞는 임의 입력 · 인증번호: 123456</p>
      <a href="/__review" target="_blank" rel="noopener noreferrer">UI 검토 패널 열기</a>
      {!store.storageAvailable && <p role="alert">저장 공간을 사용할 수 없어 이번 실행에서만 유지돼요.</p>}
      <button type="button" onClick={() => { store.reset('normal'); location.assign('/') }}>일반 상태로 초기화</button>
    </div>}
  </aside>
}
