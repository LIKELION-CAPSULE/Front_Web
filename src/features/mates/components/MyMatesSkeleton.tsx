import { SkeletonLine } from '@/shared/ui/SkeletonLine'
import '@/features/mates/my-mates.css'

/**
 * 내 메이트 while its data loads, on the page's own grid (`.my-mates-layout`): the mate panel on the left, the mate
 * cards above the 「함께한 시간」 column on the right (total · 친밀도 · 세계관 · 최근 캡슐 · the main action; 친밀도 and 세계관 are
 * separate cards since 2026-11-28; heights as the real blocks at each window height, my-mates.css). The same body is the
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
        <SkeletonLine className="my-mates-skeleton-block my-mates-skeleton-total" />
        <SkeletonLine className="my-mates-skeleton-block my-mates-skeleton-affinity" />
        <SkeletonLine className="my-mates-skeleton-block my-mates-skeleton-world" />
        {/* 최근 캡슐 takes what is left of the column, as the real card does (its rows share that room). */}
        <SkeletonLine className="my-mates-skeleton-block my-mates-skeleton-recent" />
        <div className="my-mates-skeleton-actions">
          <SkeletonLine className="h-12 w-full" />
          <SkeletonLine className="mx-auto h-5 w-24" />
        </div>
      </div>
    </div>
  )
}
