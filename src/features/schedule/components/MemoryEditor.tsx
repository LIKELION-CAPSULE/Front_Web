import { useState } from 'react'
import type { Memory } from '@/features/demo/types'
import { Dialog } from '@/shared/ui/Dialog'
import { MemoryForm } from './MemoryForm'

export function MemoryEditor({ initial, initialDate, onClose, onSaved }: {
  initial?: Memory
  initialDate?: string
  onClose: () => void
  onSaved?: (memory: Memory) => void
}) {
  const [busy, setBusy] = useState(false)
  if (initial) return <Dialog open onClose={onClose} title="일정 상세">
    <dl className="space-y-3 text-body-compact"><div><dt className="text-muted">종류</dt><dd>{initial.kind}</dd></div><div><dt className="text-muted">일정 이름</dt><dd>{initial.title}</dd></div><div><dt className="text-muted">날짜</dt><dd>{initial.date || '마감일 없음'}</dd></div><div><dt className="text-muted">시간</dt><dd>{initial.time || '종일'}</dd></div></dl>
    <p className="mt-5 text-caption text-muted">저장한 일정의 수정·삭제는 아직 제공하지 않아요.</p>
  </Dialog>
  return <Dialog open onClose={onClose} title="일정 추가" dismissible={!busy}>
    <MemoryForm initialDate={initialDate} onClose={onClose} onSaved={onSaved} onBusyChange={setBusy} />
  </Dialog>
}
