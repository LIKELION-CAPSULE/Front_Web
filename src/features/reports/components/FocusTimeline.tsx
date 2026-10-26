export function FocusTimeline({ seconds = 3000 }: { seconds?: number }) {
  const segments = [28, 3, 31, 3, 23, 2, 10]
  return (
    <section aria-label="집중 흐름" className="my-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-bold">{Math.floor(seconds / 60)}분 동안의 집중 흐름</h2>
        <p className="text-[10px] text-muted">
          <span className="text-brand">●</span> 집중{' '}
          <span className="ml-2">
            <span className="text-subtle">●</span> 딴짓 → 복귀
          </span>
        </p>
      </div>
      <div className="flex h-[18px] overflow-hidden rounded-full bg-line" aria-hidden="true">
        {segments.map((width, index) => (
          <span
            key={index}
            style={{ width: `${width}%` }}
            className={index % 2 ? 'bg-subtle' : 'bg-brand-solid'}
          />
        ))}
      </div>
      <div className="mt-2 flex justify-between text-xs text-subtle">
        <span>0분</span>
        <span>{Math.floor(seconds / 60)}분</span>
      </div>
    </section>
  )
}
