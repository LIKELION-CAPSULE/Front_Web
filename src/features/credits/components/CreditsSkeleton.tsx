import { SkeletonLine } from '@/shared/ui/SkeletonLine'
import '@/features/credits/credits-window.css'
import '@/features/credits/invite.css'

/**
 * 내 크레딧 while its data loads, on the dashboard's own rows: the title beside the balance card, then the activity
 * card (title, filter, the first days). The route's loading screen (PageSkeleton) and the page's own loading state.
 */
export function CreditsSkeletonBody() {
  return (
    <>
      <div className="credits-top" aria-hidden="true">
        <div className="credits-intro">
          <SkeletonLine className="h-10 w-36" />
          <SkeletonLine className="mt-3 h-5 w-full max-w-[220px]" />
          <SkeletonLine className="mt-2 h-5 w-28" />
        </div>
        <SkeletonLine className="credits-skeleton-balance" />
      </div>
      <section className="credits-activity" aria-hidden="true">
        <SkeletonLine raised className="h-7 w-44" />
        <SkeletonLine raised className="mt-4 h-[42px] w-[199px]" />
        <CreditActivitySkeleton />
      </section>
    </>
  )
}

/** The activity list's first days (a day's label, then its entries), also while a filter's page loads. */
export function CreditActivitySkeleton() {
  return (
    <div className="credits-skeleton-days" aria-hidden="true">
      {[2, 1].map((entries, day) => (
        <div key={day} className="credits-skeleton-day">
          <SkeletonLine raised className="h-5 w-28" />
          {Array.from({ length: entries }, (_, index) => <SkeletonLine key={index} raised className="credits-skeleton-entry" />)}
        </div>
      ))}
    </div>
  )
}

/**
 * 친구 초대 while its data loads: the hero (copy beside the art), the progress row, the code card, the friends card and
 * the code entry card, each at its own size.
 */
export function InviteSkeletonBody() {
  return (
    <>
      <div className="invite-hero" aria-hidden="true">
        <div>
          <SkeletonLine className="h-[68px] w-4/5 max-w-[400px]" />
          <SkeletonLine className="mt-5 h-[68px] w-3/4 max-w-[380px]" />
          <SkeletonLine className="mt-6 h-6 w-full max-w-[420px]" />
        </div>
        <SkeletonLine className="credits-skeleton-art" />
      </div>
      <div className="invite-progress" aria-hidden="true">
        <SkeletonLine raised className="h-11 w-[123px]" />
        <SkeletonLine raised className="h-14 w-full" />
        <SkeletonLine raised className="h-12 w-[261px] rounded-full" />
      </div>
      <div className="invite-panel invite-code-panel" aria-hidden="true">
        <SkeletonLine raised className="h-[26px] w-36" />
        <SkeletonLine raised className="h-[60px] w-full" />
        <SkeletonLine raised className="h-5 w-3/5" />
      </div>
      <div className="invite-panel invite-friends" aria-hidden="true">
        <SkeletonLine raised className="h-[26px] w-40" />
        <SkeletonLine raised className="h-[66px] w-full" />
        <SkeletonLine raised className="h-[66px] w-full" />
      </div>
    </>
  )
}
