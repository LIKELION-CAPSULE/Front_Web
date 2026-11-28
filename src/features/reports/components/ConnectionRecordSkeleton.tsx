import { SkeletonLine } from '@/shared/ui/SkeletonLine'
import '@/features/reports/capsule-record-card.css'

/**
 * The connection record card while the record loads, row for row at the card's sizes: the brand row, the title with
 * its summary and amount, the three numbers, 친밀도 and the two actions. Used inside the page's own loading card and
 * by the route's loading screen (PageSkeleton), so the card keeps its height when the record arrives.
 */
export function ConnectionRecordCardSkeleton() {
  return (
    <div aria-hidden="true">
      <SkeletonLine raised className="h-10 w-[36%]" />
      <SkeletonLine raised className="mt-[18px] h-10 w-[58%]" />
      <SkeletonLine raised className="mt-4 h-5 w-[45%]" />
      <SkeletonLine raised className="mt-6 h-10 w-1/2" />
      <SkeletonLine raised className="mt-12 h-[120px] w-full" />
      <SkeletonLine raised className="mt-5 h-[77px] w-full" />
      <SkeletonLine raised className="mt-6 h-14 w-full" />
    </div>
  )
}

/** The whole two-column record frame with the card skeleton (the route's loading screen). */
export function ConnectionRecordSkeletonBody() {
  return (
    <div className="capsule-record">
      <div className="capsule-record-mate"><div className="capsule-record-mate-skeleton" aria-hidden="true" /></div>
      <div className="capsule-record-result">
        <section className="capsule-record-card connection-record-window"><ConnectionRecordCardSkeleton /></section>
      </div>
    </div>
  )
}
