export function PageSkeleton() {
  return (
    <div role="status" className="page-container page-skeleton">
      <span className="sr-only">공부 공간을 불러오고 있어요…</span>
      <div aria-hidden="true">
        <div className="skeleton-line mb-8 h-7 w-36" />
        <div className="skeleton-line h-64 rounded-panel" />
        <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton-line h-64 rounded-card" />
          ))}
        </div>
      </div>
    </div>
  )
}
