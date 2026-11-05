import './room-detail-wordmark.css'

const strips = [
  { id: 'echo', solid: 'ONE MORE PAGE', outline: 'STAY FOCUSED' },
  { id: 'paper', solid: 'STUDY WITH ME', outline: 'CAPSULE' },
  { id: 'slip', solid: 'TOGETHER', outline: 'CAPSULE' },
  { id: 'underlay', solid: 'CAPSULE', outline: 'ONE MORE PAGE' },
  { id: 'violet', solid: 'STUDY WITH ME', outline: 'CAPSULE' },
  { id: 'note', solid: 'ONE MORE PAGE', outline: 'STUDY WITH ME' },
] as const

/** A decorative closing mark, separate from the room's readable information. */
export function RoomDetailWordmark() {
  return (
    <div className="room-detail-wordmark" aria-hidden="true">
      {strips.map(strip => (
        <div key={strip.id} className={`room-detail-wordmark-line room-detail-wordmark-line--${strip.id}`}>
          <div className="room-detail-wordmark-track">
            {[0, 1, 2].map(index => (
              <span key={index} className="room-detail-wordmark-repeat">
                <span>{strip.solid}</span>
                <span className="room-detail-wordmark-dot">·</span>
                <span className="room-detail-wordmark-outline">{strip.outline}</span>
                <span className="room-detail-wordmark-dot">·</span>
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
