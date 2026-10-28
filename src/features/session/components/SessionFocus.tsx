export function SessionFocus({ rate }: { rate: number | null }) {
  const level = rate === null ? 'unmeasured' : rate < 50 ? 'low' : rate < 80 ? 'medium' : 'high'
  return (
    <div
      role="status"
      aria-label="현재 공부 집중률"
      aria-live="off"
      className="study-focus-status"
      data-focus-level={level}
      title={rate === null ? '카메라로 측정한 시간이 없어요.' : '얼굴이 감지된 시간 / 측정한 시간'}
    >
      <span>집중률</span>
      <strong>{rate === null ? '—' : `${rate}%`}</strong>
    </div>
  )
}
