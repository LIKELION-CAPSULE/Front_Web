import { useState } from 'react'
import { Dialog, type DialogTone } from '@/shared/ui/Dialog'
import { Button } from '@/shared/ui/Button'
import { NotificationStack } from '@/shared/ui/NotificationStack'
import type { NotificationItem } from '@/shared/ui/notification-queue'
import { CREDIT_NOTICE_COPY } from '@/features/mates/credit-notice'
import { MATE_RESET_CLEARS, MATE_RESET_KEEPS } from '@/features/mates/mate-contract'
import './showcase.css'

/**
 * Shared component showcase (`component-showcase`, review only): the product's own `Dialog` in each tone and the
 * product's `NotificationStack` in each tone, side by side. Nothing here is a copy of a component: the review only
 * supplies sample content (product copy constants where they exist). `?dialog=<key>` opens one dialog on load.
 */
type DialogSample = { key: string; label: string; tone?: DialogTone; title: string; body: string; actions: [string, string] }

const DIALOGS: readonly DialogSample[] = [
  { key: 'plain', label: '톤 없음', title: '연결을 끊을까요?', body: '톤이 없으면 머리에는 제목만 보여요. 닫기 X와 Esc·바깥 누르기로 닫혀요.', actions: ['계속하기', '연결 끊기'] },
  { key: 'danger', label: 'danger · 되돌릴 수 없음', tone: 'danger', title: '채린과의 대화를 초기화할까요?',
    body: `지워지는 것: ${MATE_RESET_CLEARS.join(', ')} · 그대로 남는 것: ${MATE_RESET_KEEPS.join(', ')}`, actions: ['취소', '초기화하기'] },
  { key: 'info', label: 'info · 안내', tone: 'info', title: '카메라 사용 안내', body: '정보 아이콘(info) 톤. 안내 창은 확인 버튼 하나로도 써요.', actions: ['닫기', '확인'] },
  { key: 'credit', label: 'credit · 크레딧', tone: 'credit', title: CREDIT_NOTICE_COPY.title, body: CREDIT_NOTICE_COPY.body, actions: [CREDIT_NOTICE_COPY.invite, CREDIT_NOTICE_COPY.basic] },
  { key: 'celebrate', label: 'celebrate · 축하', tone: 'celebrate', title: '새 세계관이 열렸어요 · EP.03 주말 오후의 카페', body: '축하 톤은 머리 띠의 픽셀 눈이 더 촘촘하고 반짝임이 붙어요.', actions: ['나중에', '보러 가기'] },
]

const TOASTS: NotificationItem[] = [
  { id: 'showcase-success', tone: 'success', title: '초대 링크를 복사했어요', text: '친구에게 바로 붙여 넣어 보낼 수 있어요.' },
  { id: 'showcase-info', tone: 'info', title: '대화를 불러오고 있어요', text: '잠시만 기다려 주세요.' },
  { id: 'showcase-warning', tone: 'warning', title: '카메라를 찾지 못했어요', text: '카메라 없이도 연결은 그대로 이어져요.' },
  { id: 'showcase-error', tone: 'error', title: '답장을 보내지 못했어요', text: '입력한 내용은 그대로 있어요. 다시 보내 주세요.' },
]

export function ComponentShowcase() {
  const [open, setOpen] = useState<string | null>(() => {
    const key = new URLSearchParams(location.search).get('dialog')
    return DIALOGS.some(sample => sample.key === key) ? key : null
  })
  const [toasts, setToasts] = useState(TOASTS)
  const current = DIALOGS.find(sample => sample.key === open)
  return <main className="review-showcase">
    <header>
      <h1 className="type-page-title">공용 컴포넌트 쇼케이스</h1>
      <p className="type-body text-muted">실제 <code>Dialog</code>·<code>NotificationStack</code>을 그대로 띄워요. 내용만 검토용 예시예요.</p>
    </header>
    <section aria-labelledby="showcase-dialogs">
      <h2 id="showcase-dialogs" className="type-section-title">확인 창 · Dialog 톤</h2>
      <div className="review-showcase-buttons">
        {DIALOGS.map(sample => <Button key={sample.key} variant="secondary" size="md" onClick={() => setOpen(sample.key)}>{sample.label}</Button>)}
      </div>
    </section>
    <section aria-labelledby="showcase-toasts">
      <h2 id="showcase-toasts" className="type-section-title">알림 · NotificationStack 톤</h2>
      <div className="review-showcase-stack">
        <NotificationStack items={toasts} onDismiss={id => setToasts(items => items.filter(item => item.id !== id))} placement="container" />
      </div>
      {toasts.length < TOASTS.length && <Button variant="ghost" size="sm" onClick={() => setToasts(TOASTS)}>알림 다시 보이기</Button>}
    </section>
    {current && <Dialog open title={current.title} tone={current.tone} onClose={() => setOpen(null)}>
      <p className="type-body">{current.body}</p>
      <div className="mt-6 flex justify-end gap-3">
        <Button variant="secondary" onClick={() => setOpen(null)} data-dialog-initial-focus>{current.actions[0]}</Button>
        <Button variant={current.tone === 'danger' ? 'danger-solid' : 'primary'} onClick={() => setOpen(null)}>{current.actions[1]}</Button>
      </div>
    </Dialog>}
  </main>
}
