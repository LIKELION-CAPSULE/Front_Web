import { SkeletonLine } from '@/shared/ui/SkeletonLine'
import '@/features/mates/my-mates.css'

/**
 * 내 메이트 while its data loads, on the page's own grid (`.my-mates-layout`): the mate panel on the left, the mate
 * cards above the 「함께한 시간」 column on the right (total · 친밀도 · 최근 캡슐 · the main action). The same body is the
 * route's loading screen (PageSkeleton) and the page's own loading state, so neither moves when the other replaces it.
 */
export function MyMatesSkeletonBody() {
  return (
    <div className="my-mates-layout" aria-hidden="true">
      <div className="my-mates-switcher-slot my-mates-skeleton-switcher">
        <SkeletonLine className="my-mates-skeleton-card" />
        <SkeletonLine className="my-mates-skeleton-card" />
      </div>
      <div className="my-mates-scene">
        <SkeletonLine className="my-mates-skeleton-panel" />
      </div>
      <div className="my-mates-info my-mates-skeleton-info">
        <SkeletonLine className="my-mates-skeleton-block" style={{ height: 108 }} />
        <SkeletonLine className="my-mates-skeleton-block" style={{ height: 228 }} />
        <SkeletonLine className="my-mates-skeleton-block" style={{ height: 144 }} />
        <div className="my-mates-skeleton-actions">
          <SkeletonLine className="h-12 w-full" />
          <SkeletonLine className="mx-auto h-5 w-24" />
        </div>
      </div>
    </div>
  )
}
