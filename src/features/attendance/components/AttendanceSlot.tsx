import capsule from '@/assets/attendance/capsule.webp'
import platform from '@/assets/attendance/platform.webp'
import coin from '@/assets/attendance/check_coin.webp'
import badge from '@/assets/attendance/milestone_badge.webp'
import type { CSSProperties } from 'react'
import { ASSET_SIZE, ATTENDANCE_COPY, SOURCE_MARGIN, type AttendanceLayout } from '../attendance-config'
import { GoldText } from './GoldText'
import { displaySize, slotGeometry, type AttendanceReward, type SlotStatus } from '../attendance-model'

export const SLOT_IMAGES = { capsule, platform, coin, badge } as const

export type SlotItem = 'capsule' | 'coin' | 'badge' | 'none'

/**
 * One day of the cycle as a column: floating capsule, its light beam, the platform and the day label. A finished
 * day shows a coin (or the milestone badge) on the platform instead of the capsule. Positions are whole pixels.
 */
export function AttendanceSlot({
  index, reward, status, item, besideCharacter, entering = false, layout,
}: {
  index: number
  reward: AttendanceReward
  status: SlotStatus
  item: SlotItem
  /** The character stands on this platform, so the coin moves aside to stay visible. */
  besideCharacter: boolean
  /** Rendered invisible so the widget can pop it in. */
  entering?: boolean
  layout: AttendanceLayout
}) {
  const { platform: platformSize, platformTop, floorY, labelTop } = slotGeometry(layout)
  const capsuleSize = displaySize(ASSET_SIZE.capsule, { height: layout.capsuleHeight })
  const coinSize = displaySize(ASSET_SIZE.coin, { width: layout.coinWidth })
  const badgeSize = displaySize(ASSET_SIZE.badge, { width: layout.badgeWidth })
  const award = reward.milestone ? badgeSize : coinSize
  const awardMargin = Math.round(SOURCE_MARGIN * award.scale)
  const center = layout.pitch / 2
  const beamTop = layout.capsuleTop + Math.round(capsuleSize.height * 0.72)
  const awardX = besideCharacter ? layout.coinBesideCharacterX : 0
  // Phase-shift every slot's idle float so the capsules never move in step.
  const phase = { '--att-phase': `${-index * 0.73}s`, '--att-tilt-phase': `${-index * 1.31}s` } as CSSProperties

  return (
    <div
      className="att-slot"
      data-slot={index}
      data-status={status}
      data-milestone={reward.milestone || undefined}
      style={{ left: layout.insetLeft + layout.pitch * index, width: layout.pitch, height: layout.trackHeight, ...phase }}
    >
      {status === 'today' && (
        <div
          className="att-slot-glow"
          style={{ left: Math.round(center - platformSize.width * 0.8), top: Math.round(platformTop - platformSize.height * 0.55), width: Math.round(platformSize.width * 1.6), height: Math.round(platformSize.height * 2.1) }}
        />
      )}
      {item === 'capsule' && (
        <div className="att-slot-beam" style={{ left: center - 22, top: beamTop, width: 44, height: floorY - beamTop }} />
      )}
      <img
        className="att-slot-platform"
        src={platform}
        width={platformSize.width}
        height={platformSize.height}
        alt=""
        decoding="async"
        draggable={false}
        style={{ left: Math.round(center - platformSize.width / 2), top: platformTop }}
      />
      <div className="att-slot-ring" style={{ left: Math.round(center - platformSize.width * 0.42), top: Math.round(floorY - platformSize.width * 0.14), width: Math.round(platformSize.width * 0.84), height: Math.round(platformSize.width * 0.28) }} />

      {item === 'capsule' && (
        <div className="att-slot-capsule" style={{ left: Math.round(center - capsuleSize.width / 2), top: layout.capsuleTop, width: capsuleSize.width, height: capsuleSize.height }}>
          <div className="att-slot-capsule-float">
            <img src={capsule} width={capsuleSize.width} height={capsuleSize.height} alt="" decoding="async" draggable={false} />
          </div>
        </div>
      )}

      {(item === 'coin' || item === 'badge') && (
        <div
          className="att-slot-award"
          data-award={item}
          data-entering={entering || undefined}
          style={{
            left: Math.round(center - award.width / 2),
            top: floorY + awardMargin + 4 - award.height,
            width: award.width,
            height: award.height,
            transform: awardX ? `translateX(${awardX}px)` : undefined,
          }}
        >
          {item === 'badge' && <div className="att-slot-rays" />}
          {/* Moved aside by the wrapper, popped in by the widget: two layers so the transforms never clash. */}
          <div className="att-slot-award-pop">
            <img src={item === 'badge' ? badge : coin} width={award.width} height={award.height} alt="" decoding="async" draggable={false} />
            {item === 'coin' && (
              <div className="att-slot-shine-mask" style={{ maskImage: `url(${coin})`, WebkitMaskImage: `url(${coin})` }}>
                <div className="att-slot-shine" />
              </div>
            )}
            {item === 'badge' && <GoldText className="att-slot-badge-text" style={{ fontSize: Math.round(award.width * 0.18) }}>{ATTENDANCE_COPY.dayLabel(reward.day)}</GoldText>}
          </div>
        </div>
      )}

      <p className="att-slot-label" style={{ top: labelTop, height: layout.labelHeight }}>
        <span>{ATTENDANCE_COPY.dayLabel(reward.day)}</span>
        <span className="att-slot-status">({ATTENDANCE_COPY.status[status]})</span>
      </p>
    </div>
  )
}
