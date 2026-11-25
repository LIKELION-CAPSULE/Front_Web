import { createPortal } from 'react-dom'
import { NotificationStack } from '@/shared/ui/NotificationStack'
import type { NotificationItem } from '@/shared/ui/notification-queue'
import './dialog-design.css'

/**
 * Toast candidates for the pixel frame (review only, 2026-11-26): the real NotificationStack three times, side by side.
 * T1 is the product style (top roof line); T2 and T3 are overrides in dialog-design.css for comparison.
 */
const ITEMS: NotificationItem[] = [
  { id: 'cand-success', tone: 'success', title: '초대 링크를 복사했어요', text: '친구에게 바로 붙여 넣어 보낼 수 있어요.' },
  { id: 'cand-info', tone: 'info', title: '대화를 불러오고 있어요', text: '잠시만 기다려 주세요.' },
  { id: 'cand-warning', tone: 'warning', title: '카메라를 찾지 못했어요', text: '카메라 없이도 연결은 그대로 이어져요.' },
  { id: 'cand-error', tone: 'error', title: '답장을 보내지 못했어요', text: '입력한 내용은 그대로 있어요. 다시 보내 주세요.' },
]

const CANDIDATES = [
  { id: 't1', name: 'T1 · 위쪽 디더링 줄 (선택)', note: '모달 머리 띠를 축소: 2px 밤색 줄 + 2px 체커 한 줄. 상태는 픽셀 아이콘으로.' },
  { id: 't2', name: 'T2 · 왼쪽 세로 픽셀 띠', note: '상태색 6px 세로 띠가 오른쪽으로 디더링되며 사라짐.' },
  { id: 't3', name: 'T3 · 아이콘 밤하늘 타일', note: '카드는 단색, 아이콘 칸만 작은 밤하늘(머리 띠+디더링) 타일.' },
] as const

export function ToastCandidates() {
  return createPortal(<div className="dd-toast-compare">
    {CANDIDATES.map(candidate => <section key={candidate.id} className="dd-toast-candidate" data-toast-candidate={candidate.id} aria-label={candidate.name}>
      <h2>{candidate.name}</h2>
      <p>{candidate.note}</p>
      <div className="dd-toast-candidate-stack">
        <NotificationStack items={ITEMS} onDismiss={() => {}} placement="container" />
      </div>
    </section>)}
  </div>, document.body)
}
