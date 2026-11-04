export function SessionFocus({ rate }: { rate: number | null }) {
  const level = rate === null ? 'unmeasured' : rate < 50 ? 'low' : rate < 80 ? 'medium' : 'high'
  return (
    <div
      role="status"
      aria-label="현재 공부 자리 지킴률"
      aria-live="off"
      className="study-focus-status"
      data-focus-level={level}
      title={rate === null ? '아직 공부한 시간이 없어요.' : '자리 지킴 시간 / 공부 시간 (카메라를 끈 동안은 자리 지킴으로 계산)' }
    >
      <span>자리 지킴률</span>
      <strong>{rate === null ? '—' : `${rate}%`}</strong>
    </div>
  )
}
