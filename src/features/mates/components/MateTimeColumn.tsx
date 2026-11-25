import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { formatCapsuleShortDate, formatTogether, partOfDay } from '@/features/mates/capsule-jar/capsule-jar-data'
import { capsulesForConnection } from '@/features/mates/capsule-jar/capsule-floor-layout'
import type { CapsuleJarTheme, CapsuleRecord } from '@/features/mates/capsule-jar/capsule-jar-types'
import { capsuleBandTheme } from '@/features/mates/capsule-jar/capsule-jar-theme'
import { capsuleBand, capsuleKeepsakes } from '@/features/mates/capsule-jar/capsule-moments'
import type { AffinityProgressView } from '@/features/mates/affinity-progress'
import { Icon } from '@/shared/ui/Icon'
import type { IconName } from '@/shared/ui/animate-icons/icons'
import { NumberCounter } from '@/shared/ui/number-counter/NumberCounter'
import { AnimatedDuration } from '@/shared/ui/number-counter/AnimatedDuration'
import { CapsuleGlyph } from './game-glyphs'
import './mate-time-column.css'

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'] as const
const seoulWeekdayHour = (timestamp: number) => {
  const shifted = new Date(timestamp + 9 * 3_600_000)
  return { weekday: WEEKDAY[shifted.getUTCDay()]!, hour: shifted.getUTCHours() }
}

/**
 * Recent connections shown: as many rows as the room left in the column holds (the column never scrolls; the rest
 * are in 「목록으로 보기」), at least one and at most `RECENT_MAX`. With the affinity and expression blocks off the
 * list simply gets more rows.
 */
const RECENT_MAX = 10
/** NEW marks only the newest connections since the last visit. */
const MAX_NEW = 2


/**
 * Header of a block: one style everywhere, a small icon and the title, an optional count right beside the title (a
 * muted figure; read as `countLabel`), and an optional note at the far right (an action).
 */
function BlockLabel({ id, icon, children, count, countLabel, note }: {
  id: string
  icon: IconName
  children: ReactNode
  count?: number
  countLabel?: string
  note?: ReactNode
}) {
  return (
    <p className="mate-game-label">
      <span className="mate-game-label-icon" aria-hidden="true">
        <Icon name={icon} size={14} />
      </span>
      <span id={id}>{children}</span>
      {count !== undefined && (
        <span className="mate-game-label-count">
          <span aria-hidden="true">{count.toLocaleString('ko-KR')}</span>
          <span className="sr-only">{countLabel ?? `${count}개`}</span>
        </span>
      )}
      {note && <span className="mate-game-label-note">{note}</span>}
    </p>
  )
}

/** Rows of `rowSelector` that fit in the element (measured; the element's height never depends on its rows). */
function useFittingRows(fallback: number) {
  const ref = useRef<HTMLDivElement>(null)
  const [rows, setRows] = useState(fallback)
  useEffect(() => {
    const room = ref.current
    if (!room || typeof ResizeObserver === 'undefined') return
    const measure = () => {
      const row = room.querySelector('li')?.getBoundingClientRect().height || 40
      setRows(Math.max(1, Math.min(RECENT_MAX, Math.floor((room.clientHeight + 1) / row))))
    }
    const observer = new ResizeObserver(measure)
    observer.observe(room)
    measure()
    return () => observer.disconnect()
  }, [])
  return [ref, rows] as const
}

/**
 * 「함께한 시간」 column beside the mate panel. Plain blocks on the report panel's glass (my-mates.css), one title style
 * (small icon + title): the total with one line of counts, the affinity as a title, one progress bar, what is left and
 * what the next stage opens (when the affinity feature is on), the expressions, the latest connections (each opens
 * its record card and lights its capsules in the scene; its title row holds 「목록으로 보기」) and the main action.
 * No badges, ribbons or stickers.
 */
export function MateTimeColumn({
  totalSeconds,
  connections,
  connectionCount,
  capsuleCount,
  newIds,
  affinity,
  expressions = null,
  theme,
  onOpen,
  onPoint,
  listToggle,
  actions,
}: {
  totalSeconds: number
  /** Connections, oldest first (as the scene gets them). */
  connections: readonly CapsuleRecord[]
  /** All connections with the mate (37 `connectionCount`); `connections` may hold only the newest of them. */
  connectionCount?: number
  capsuleCount: number
  /** Connections new since the last visit. */
  newIds: readonly string[]
  /** Null: no affinity data (feature off) — the block is left out. */
  affinity: AffinityProgressView | null
  /**
   * 표정 컬렉션 (feature on; null: the block is left out): the tiles and the count for the title. Picking one makes
   * the panel's big mate wear it. The tiles get `my-mates-expressions-label` as their label.
   */
  expressions?: { tiles: ReactNode; unlocked: number; total: number } | null
  /** Mate colours of the scene's capsules. */
  theme: CapsuleJarTheme
  onOpen: (id: string) => void
  /** The pointer / focus is on a connection in the list (null: left). */
  onPoint: (id: string | null) => void
  /** 「목록으로 보기」: in the recent block's title row. */
  listToggle?: ReactNode
  actions: ReactNode
}) {
  const [pointed, setPointed] = useState<string | null>(null)
  const [roomRef, limit] = useFittingRows(3)
  const recent = connections.slice(-limit).reverse()
  const total = connectionCount ?? connections.length
  // Keepsakes (milestones of the time together) by connection, the same rule as the capsules in the scene.
  const keepsakes = useMemo(() => capsuleKeepsakes(connections, capsulesForConnection), [connections])
  // NEW: the newest two connections since the last visit, not every one of them.
  const fresh = new Set(connections.filter((connection) => newIds.includes(connection.id)).slice(-MAX_NEW).map((connection) => connection.id))
  const point = (id: string | null) => {
    setPointed(id)
    onPoint(id)
  }

  // One progress bar toward the next stage (full at the last stage).
  const progress = affinity ? (affinity.isLast ? 1 : affinity.progress) : null
  const caption = affinity
    ? (affinity.nextCaption ??
      (affinity.nextStageName ? `다음 단계: ${affinity.nextStageName}` : affinity.isLast ? '가장 가까운 사이가 됐어요' : null))
    : null

  return (
    <div className="my-mates-info mate-game" data-affinity={affinity ? 'true' : 'false'}>
      <section className="mate-game-block mate-game-total" data-tour="my-mates-total" aria-labelledby="my-mates-total-label">
        <BlockLabel id="my-mates-total-label" icon="clock">함께한 시간</BlockLabel>
        <p className="mate-game-total-value">
          <AnimatedDuration seconds={totalSeconds} />
        </p>
        <p className="mate-game-total-meta">
          연결 <NumberCounter value={connectionCount ?? connections.length} />회 · 캡슐 <NumberCounter value={capsuleCount} />개
        </p>
      </section>

      {affinity && (
        <section className="mate-game-block mate-game-affinity" data-tour="my-mates-affinity" aria-labelledby="my-mates-affinity-label">
          <BlockLabel id="my-mates-affinity-label" icon="heart">친밀도</BlockLabel>
          <p className="mate-game-level-name">
            {affinity.stage}단계 · {affinity.stageName}
          </p>
          {progress !== null && (
            <div
              className="mate-game-progress"
              role="progressbar"
              aria-label={affinity.nextStageName ? `${affinity.nextStageName}까지` : '친밀도'}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(progress * 100)}
              style={{ '--progress': progress } as CSSProperties}
            />
          )}
          {caption && <p className="mate-game-level-caption">{caption}</p>}
        </section>
      )}

      {expressions && (
        <section className="mate-game-block mate-game-expressions" data-tour="my-mates-expressions" aria-labelledby="my-mates-expressions-label">
          <BlockLabel
            id="my-mates-expressions-label"
            icon="user"
            note={
              <>
                {expressions.unlocked} / {expressions.total}
                <span className="sr-only">개 모았어요</span>
              </>
            }
          >
            표정 컬렉션
          </BlockLabel>
          {expressions.tiles}
        </section>
      )}

      <section className="mate-game-block mate-game-recent" data-tour="my-mates-recent" aria-labelledby="my-mates-recent-label">
        <BlockLabel
          id="my-mates-recent-label"
          icon="sparkle"
          // The count right after the title (all connections, not only the newest listed); the toggle alone at the far right.
          count={total > 0 ? total : undefined}
          countLabel={`전체 ${total}개`}
          note={listToggle}
        >
          최근 캡슐
        </BlockLabel>
        <div ref={roomRef} className="mate-game-inventory-room">
          {recent.length === 0 ? (
            <p className="mate-game-empty">연결을 마치면 여기에 쌓여요.</p>
          ) : (
            <ul className="mate-game-inventory">
              {recent.map((connection) => {
                const { weekday, hour } = seoulWeekdayHour(connection.startedAt)
                const isNew = fresh.has(connection.id)
                const keepsake = keepsakes.get(connection.id)
                const count = capsulesForConnection(connection.durationSeconds)
                return (
                  <li key={connection.id}>
                    <button
                      type="button"
                      className="mate-game-slot"
                      data-pointed={pointed === connection.id ? 'true' : undefined}
                      onClick={() => onOpen(connection.id)}
                      onPointerEnter={() => point(connection.id)}
                      onPointerLeave={() => point(null)}
                      onFocus={() => point(connection.id)}
                      onBlur={() => point(null)}
                    >
                      <span className="mate-game-slot-item" aria-hidden="true">
                        {/* The connection's capsules' own tint (its time band). */}
                        <CapsuleGlyph theme={capsuleBandTheme(theme, capsuleBand(connection))} size={26} />
                      </span>
                      <span className="mate-game-slot-text">
                        <span className="mate-game-slot-date">
                          {formatCapsuleShortDate(connection.startedAt)} ({weekday}) · {partOfDay(hour)}
                        </span>
                        <span className="mate-game-slot-end">
                          {keepsake && (
                            <span className="mate-game-keepsake">
                              {`기념 ${keepsake.hours}시간`}
                            </span>
                          )}
                          {isNew && (
                            <span className="mate-game-new">
                              NEW<span className="sr-only"> 새 캡슐</span>
                            </span>
                          )}
                          <span className="mate-game-slot-time">
                            {formatTogether(connection.durationSeconds)}
                            <span className="mate-game-slot-count"> · 캡슐 {count}개</span>
                          </span>
                        </span>
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </section>

      <div className="my-mates-actions mate-game-actions">{actions}</div>
    </div>
  )
}
