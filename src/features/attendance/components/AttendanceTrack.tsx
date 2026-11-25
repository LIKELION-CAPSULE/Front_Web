import { forwardRef, type Ref } from 'react'
import { CYCLE_DAYS, type AttendanceLayout } from '../attendance-config'
import { slotGeometry, slotStatus, viewportWidth, type AttendanceReward, type CharacterPose } from '../attendance-model'
import { AttendanceCharacter } from './AttendanceCharacter'
import { AttendanceSlot, type SlotItem } from './AttendanceSlot'

export type TrackView = {
  cycleDay: number
  checkedToday: boolean
  /** Slot the character stands on (-1 = floor before day 1). */
  characterIndex: number
  /** The newest award, rendered invisible so the widget can pop it in. */
  award: { index: number; phase: 'entering' } | null
}

/**
 * The seven days in a row on a thin floor plate, three visible at a time. The track and the character are moved by
 * the widget (transforms only), so this stays a plain picture of `view`.
 */
export const AttendanceTrack = forwardRef(function AttendanceTrack(
  { view, rewards, pose, layout, visible, trackRef, characterRef, squashRef }: {
    view: TrackView
    rewards: AttendanceReward[]
    pose: CharacterPose
    layout: AttendanceLayout
    /** How many days are visible at once. */
    visible: number
    trackRef: Ref<HTMLDivElement>
    characterRef: Ref<HTMLDivElement>
    squashRef: Ref<HTMLDivElement>
  },
  viewportRef: Ref<HTMLDivElement>,
) {
  const { platform, platformTop } = slotGeometry(layout)
  const trackWidth = layout.insetLeft + layout.pitch * CYCLE_DAYS + layout.insetRight
  return (
    <div ref={viewportRef} className="att-viewport" style={{ width: viewportWidth(layout, visible), height: layout.trackHeight }}>
      <div ref={trackRef} className="att-track" style={{ width: trackWidth, height: layout.trackHeight }}>
        <div className="att-floor" style={{ left: Math.round(layout.insetLeft * 0.4), right: 0, top: platformTop + platform.height - 14, height: 18 }} />
        {rewards.slice(0, CYCLE_DAYS).map((reward, index) => {
          const status = slotStatus(index, view)
          const revealing = view.award?.index === index ? view.award.phase : null
          const item: SlotItem = status === 'done' ? (reward.milestone ? 'badge' : 'coin') : 'capsule'
          return (
            <AttendanceSlot
              key={reward.day}
              index={index}
              reward={reward}
              status={status}
              item={item}
              besideCharacter={index === view.characterIndex}
              entering={revealing === 'entering'}
              layout={layout}
            />
          )
        })}
        <div ref={characterRef} className="att-character-position">
          <div ref={squashRef} className="att-character-squash">
            <div className="att-character-breath">
              <AttendanceCharacter pose={pose} layout={layout} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
})
