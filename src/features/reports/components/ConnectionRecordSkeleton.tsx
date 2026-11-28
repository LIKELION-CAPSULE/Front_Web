import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Icon } from '@/shared/ui/Icon'
import { SkeletonLine } from '@/shared/ui/SkeletonLine'
import { CAPSULE_RECORD_COPY } from '@/features/reports/capsule-record'
import '@/features/reports/capsule-record-card.css'

/**
 * The card's action row while the record loads on the screen without the site header (right after hanging up,
 * ConnectionRecordPage `bare`): the real 「홈으로」 (the way out), the 「다시 연결하기」 place still a skeleton.
 */
export function ConnectionRecordLoadingActions() {
  return (
    <div className="capsule-record-actions">
      <Link to="/" className="capsule-record-home"><Icon name="home" size={18} />{CAPSULE_RECORD_COPY.home}</Link>
      <SkeletonLine raised className="h-14 w-full" />
    </div>
  )
}

/**
 * The connection record card while the record loads, row for row at the card's sizes: the brand row, the title with
 * its summary and amount, the three numbers, 친밀도 and the two actions. Used inside the page's own loading card and
 * by the route's loading screen (PageSkeleton), so the card keeps its height when the record arrives.
 */
export function ConnectionRecordCardSkeleton({ actions }: { actions?: ReactNode } = {}) {
  return (
    <>
      <div aria-hidden="true">
        <SkeletonLine raised className="h-10 w-[36%]" />
        <SkeletonLine raised className="mt-[18px] h-10 w-[58%]" />
        <SkeletonLine raised className="mt-4 h-5 w-[45%]" />
        <SkeletonLine raised className="mt-6 h-10 w-1/2" />
        <SkeletonLine raised className="mt-12 h-[120px] w-full" />
        <SkeletonLine raised className="mt-5 h-[77px] w-full" />
        {!actions && <SkeletonLine raised className="mt-6 h-14 w-full" />}
      </div>
      {/* The card's real action row in place of the last bar (the screen without a header keeps its way home). */}
      {actions}
    </>
  )
}

/** The whole two-column record frame with the card skeleton (the route's loading screen). */
export function ConnectionRecordSkeletonBody({ bare = false }: { bare?: boolean } = {}) {
  return (
    <div className="capsule-record">
      <div className="capsule-record-mate"><div className="capsule-record-mate-skeleton" aria-hidden="true" /></div>
      <div className="capsule-record-result">
        <section className="capsule-record-card connection-record-window"><ConnectionRecordCardSkeleton actions={bare ? <ConnectionRecordLoadingActions /> : undefined} /></section>
      </div>
    </div>
  )
}
