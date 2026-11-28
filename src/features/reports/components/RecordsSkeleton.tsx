import { SkeletonLine } from '@/shared/ui/SkeletonLine'
import '@/features/reports/records-window.css'

/**
 * 내 기록 while its data loads, on the page's own rows: the period tabs and date arrows, the mate chips, the overview
 * (the mate's comment beside the numbers) and the board block. The same body is the route's loading screen
 * (PageSkeleton) and the page's own loading state.
 */
export function RecordsSkeletonBody() {
  return (
    <div aria-hidden="true">
      <div className="records-toolbar">
        <SkeletonLine className="h-9 w-[142px] rounded-full" />
        <SkeletonLine className="h-9 w-[189px] rounded-full" />
      </div>
      <div className="records-mate-chips">
        <SkeletonLine className="h-9 w-[52px] rounded-full" />
        <SkeletonLine className="h-9 w-[52px] rounded-full" />
        <SkeletonLine className="h-9 w-16 rounded-full" />
      </div>
      <div className="records-overview" data-has-comment>
        <div className="records-skeleton-comment">
          <SkeletonLine className="size-12 shrink-0 rounded-full" />
          <SkeletonLine className="records-skeleton-bubble" />
        </div>
        <SkeletonLine className="records-skeleton-summary" />
      </div>
      <SkeletonLine className="records-board-block records-skeleton-board" />
    </div>
  )
}
