import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { formatCapsuleShortDate, formatTogether, partOfDay } from '@/features/mates/capsule-jar/capsule-jar-data'
import { capsulesForConnection } from '@/features/mates/capsule-jar/capsule-floor-layout'
import type { CapsuleJarTheme, CapsuleRecord } from '@/features/mates/capsule-jar/capsule-jar-types'
import type { AffinityProgressView } from '@/features/mates/affinity-progress'
import { Icon } from '@/shared/ui/Icon'
import type { IconName } from '@/shared/ui/animate-icons/icons'
import { withParticle } from '@/shared/lib/korean'
import { NumberCounter } from '@/shared/ui/number-counter/NumberCounter'
import { AnimatedDuration } from '@/shared/ui/number-counter/AnimatedDuration'
import { CapsuleGlyph, Sparkle, StageCrest } from './game-glyphs'
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
/** Cells of the experience bar. */
const XP_CELLS = 10

/** An expression the next stage unlocks, shown as a locked reward slot. */
export type StageReward = { id: string; label: string; thumbnail?: string; tint?: string }

/** Header of a block: one style everywhere, a small icon and the title (and an optional note on the right). */
function BlockLabel({ id, icon, children, note }: { id: string; icon: IconName; children: ReactNode; note?: ReactNode }) {
  return (
    <p id={id} className="mate-game-label">
      <span className="mate-game-label-icon" aria-hidden="true">
        <Icon name={icon} size={14} />
      </span>
      {children}
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

function useShortWindow() {
  const query = '(min-width: 960px) and (max-height: 800px)'
  const [short, setShort] = useState(() => typeof window !== 'undefined' && Boolean(window.matchMedia?.(query).matches))
  useEffect(() => {
    const list = window.matchMedia?.(query)
    if (!list) return
    const update = () => setShort(list.matches)
    update()
    list.addEventListener('change', update)
    return () => list.removeEventListener('change', update)
  }, [])
  return short
}

/**
 * 「함께한 시간」 column beside the capsule scene, in a light game style (docs/DESIGN_SYSTEM.md, exception of
 * 2026-11-24): the total with resource chips, the affinity as a level crest with an experience bar and the next
 * stage's reward slots (when the affinity feature is on), the latest connections as inventory slots (each opens
 * its record card and lights its capsules in the scene) and the two actions.
 */
export function MateTimeColumn({
  totalSeconds,
  connections,
  capsuleCount,
  newIds,
  affinity,
  nextRewards,
  expressions = null,
  theme,
  onOpen,
  onPoint,
  actions,
}: {
  totalSeconds: number
  /** Connections, oldest first (as the scene gets them). */
  connections: readonly CapsuleRecord[]
  capsuleCount: number
  /** Connections new since the last visit. */
  newIds: readonly string[]
  /** Null: no affinity data (feature off) — the block is left out. */
  affinity: AffinityProgressView | null
  /** Expressions the next stage unlocks. */
  nextRewards: readonly StageReward[]
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
  actions: ReactNode
}) {
  const short = useShortWindow()
  const [pointed, setPointed] = useState<string | null>(null)
  const [roomRef, limit] = useFittingRows(3)
  const recent = connections.slice(-limit).reverse()
  // NEW: the newest two connections since the last visit, not every one of them.
  const fresh = new Set(connections.filter((connection) => newIds.includes(connection.id)).slice(-MAX_NEW).map((connection) => connection.id))
  const point = (id: string | null) => {
    setPointed(id)
    onPoint(id)
  }

  // Experience bar: whole cells filled, the current cell partly filled (and gently flowing).
  const progress = affinity?.progress ?? null
  const filled = progress === null ? 0 : Math.min(XP_CELLS, progress * XP_CELLS)
  const caption = affinity
    ? (affinity.nextCaption ??
      (affinity.nextStageName ? `다음 단계: ${affinity.nextStageName}` : affinity.isLast ? '가장 가까운 사이가 됐어요' : null))
    : null

  return (
    <div className="my-mates-info mate-game" data-affinity={affinity ? 'true' : 'false'}>
      {/* Decoration inside the column: a few faint rising stars. */}
      <div className="mate-game-sky" aria-hidden="true">
        {Array.from({ length: 4 }, (_, index) => (
          <span
            key={index}
            className="mate-game-star"
            style={{ '--i': index, left: `${12 + index * 24}%`, bottom: `${10 + ((index * 37) % 60)}%` } as CSSProperties}
          />
        ))}
      </div>

      <section className="mate-game-block mate-game-total" aria-labelledby="my-mates-total-label">
        <BlockLabel id="my-mates-total-label" icon="clock">함께한 시간</BlockLabel>
        <div className="mate-game-total-row">
          <span className="mate-game-total-icon">
            <CapsuleGlyph theme={theme} size={42} />
          </span>
          <div className="mate-game-total-text">
            <p className="mate-game-total-value">
              <AnimatedDuration seconds={totalSeconds} />
            </p>
        <ul className="mate-game-chips" aria-label="모은 것">
          <li className="mate-game-chip">
            <span className="mate-game-chip-icon" aria-hidden="true">
              <Icon name="heart" size={13} />
            </span>
            연결 <strong><NumberCounter value={connections.length} /></strong>회
          </li>
          <li className="mate-game-chip">
            <span className="mate-game-chip-icon" aria-hidden="true">
              <CapsuleGlyph theme={theme} size={20} />
            </span>
            캡슐 <strong><NumberCounter value={capsuleCount} /></strong>개
          </li>
        </ul>
          </div>
        </div>
      </section>

      {affinity && (
        <section className="mate-game-block mate-game-affinity" aria-labelledby="my-mates-affinity-label">
          <BlockLabel id="my-mates-affinity-label" icon="heart">친밀도</BlockLabel>
          <div className="mate-game-level">
            <StageCrest stage={affinity.stage} size={short ? 42 : 48} />
            <div className="mate-game-level-text">
              <p className="mate-game-level-name">
                {affinity.stage}단계 · {affinity.stageName}
                {affinity.nextStageName && <span className="mate-game-level-next"> → {affinity.nextStageName}</span>}
              </p>
              {progress !== null && (
                <div
                  className="mate-game-xp"
                  role="progressbar"
                  aria-label={`${affinity.stageName}에서 다음 단계까지`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(progress * 100)}
                >
                  {Array.from({ length: XP_CELLS }, (_, index) => {
                    const fill = Math.max(0, Math.min(1, filled - index))
                    const current = fill > 0 && fill < 1
                    return (
                      <span
                        key={index}
                        className="mate-game-xp-cell"
                        data-state={fill >= 1 ? 'full' : current ? 'current' : 'empty'}
                        style={{ '--cell': fill } as CSSProperties}
                      />
                    )
                  })}
                </div>
              )}
              {caption && <p className="mate-game-level-caption">{caption}</p>}
            </div>
          </div>
          {nextRewards.length > 0 && (
            <div className="mate-game-rewards">
              <span className="mate-game-ribbon">다음 단계 보상</span>
              <span className="mate-game-rewards-text">
                {affinity.nextStageName
                  ? `${withParticle(affinity.nextStageName, '이', '가')} 되면 표정 ${nextRewards.length}개`
                  : `표정 ${nextRewards.length}개`}
              </span>
              <ul className="mate-game-reward-slots">
                {nextRewards.slice(0, 3).map((reward) => (
                  <li key={reward.id} className="mate-game-reward" title={reward.label}>
                    <span className="mate-game-reward-face" aria-hidden="true">
                      {reward.thumbnail && (
                        <img src={reward.thumbnail} alt="" draggable={false} style={reward.tint ? { filter: reward.tint } : undefined} />
                      )}
                      <span className="mate-game-reward-lock">
                        <Icon name="lock" size={12} />
                      </span>
                    </span>
                    <span className="sr-only">잠긴 표정 {reward.label}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {expressions && (
        <section className="mate-game-block mate-game-expressions" aria-labelledby="my-mates-expressions-label">
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

      <section className="mate-game-block mate-game-recent" aria-labelledby="my-mates-recent-label">
        <BlockLabel
          id="my-mates-recent-label"
          icon="sparkle"
          note={connections.length > recent.length ? `전체 ${connections.length}개 · 목록으로 보기` : undefined}
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
                        <CapsuleGlyph theme={theme} size={30} />
                        <span className="mate-game-slot-count">×{count}</span>
                      </span>
                      <span className="mate-game-slot-text">
                        <span className="mate-game-slot-date">
                          {formatCapsuleShortDate(connection.startedAt)} ({weekday}) · {partOfDay(hour)}
                        </span>
                        <span className="mate-game-slot-time">
                          {formatTogether(connection.durationSeconds)}
                          <span className="sr-only">{`, 캡슐 ${count}개`}</span>
                        </span>
                      </span>
                      {isNew && (
                        <span className="mate-game-new">
                          <Sparkle className="mate-game-new-star" />
                          NEW<span className="sr-only"> 새 캡슐</span>
                        </span>
                      )}
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
