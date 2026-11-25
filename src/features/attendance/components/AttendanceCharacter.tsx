import idle from '@/assets/attendance/idle_fixed.webp'
import jump from '@/assets/attendance/jump_fixed.webp'
import cheer from '@/assets/attendance/cheer.webp'
import { POSE_OFFSET, type AttendanceLayout } from '../attendance-config'
import { poseSize, type CharacterPose } from '../attendance-model'

export const CHARACTER_IMAGES = { idle, jump, cheer } as const

/**
 * The two-head-tall character in one of three poses. All poses stay stacked and cross-fade, so switching never
 * waits for an image to load. Everything outside (position, squash, breathing) belongs to the caller, so this can
 * later be replaced by a Rive animation with the same `pose` input.
 */
export function AttendanceCharacter({ pose, layout }: { pose: CharacterPose; layout: AttendanceLayout }) {
  const base = poseSize('idle', layout)
  return (
    <div className="att-character" style={{ width: base.width, height: base.height }}>
      {(Object.keys(CHARACTER_IMAGES) as CharacterPose[]).map((name) => {
        const size = poseSize(name, layout)
        return (
          <img
            key={name}
            src={CHARACTER_IMAGES[name]}
            width={size.width}
            height={size.height}
            alt=""
            decoding="async"
            draggable={false}
            className="att-character-pose"
            data-active={name === pose || undefined}
            // Every pose stands on the same feet: bottom-aligned and centred on the idle frame, plus a fine offset.
            style={{ left: Math.round((base.width - size.width) / 2 + POSE_OFFSET[name].x - POSE_OFFSET.idle.x), bottom: -POSE_OFFSET[name].y }}
          />
        )
      })}
    </div>
  )
}
