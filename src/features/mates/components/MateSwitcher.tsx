import type { CSSProperties } from 'react'

export type MateSwitcherItem = {
  id: string
  name: string
  image?: string
  /** CSS filter for preview mates without artwork of their own. */
  tint?: string
  /** Not available yet: shown dimmed, cannot be picked. */
  upcoming?: boolean
}

/**
 * Mate selection above the scene. One mate: a quiet name chip (and dimmed 「추가 예정」 mates). Several mates: a fan of
 * small cards, the picked one raised; picking another swaps the card in the scene (with a sweep of light).
 * The choice lives in `?mate=` (the page owns it).
 */
export function MateSwitcher({
  mates,
  selectedId,
  onSelect,
}: {
  mates: readonly MateSwitcherItem[]
  selectedId: string
  onSelect: (id: string) => void
}) {
  const available = mates.filter((mate) => !mate.upcoming)
  const upcoming = mates.filter((mate) => mate.upcoming)

  if (available.length <= 1) {
    return (
      <nav className="mate-switcher mate-switcher--single" aria-label="메이트">
        {available.map((mate) => (
          <span key={mate.id} className="mate-switcher-chip" aria-current="true">
            <span className="mate-switcher-dot" aria-hidden="true" />
            {mate.name}
          </span>
        ))}
        {upcoming.map((mate) => (
          <span key={mate.id} className="mate-switcher-chip mate-switcher-chip--upcoming" aria-disabled="true">
            {mate.name}
            <span className="mate-switcher-soon">추가 예정</span>
          </span>
        ))}
      </nav>
    )
  }

  const middle = (available.length - 1) / 2
  return (
    <nav className="mate-switcher mate-switcher--fan" aria-label="메이트 고르기">
      <ul className="mate-fan">
        {available.map((mate, index) => {
          const selected = mate.id === selectedId
          return (
            <li key={mate.id} className="mate-fan-item" style={{ '--fan': index - middle } as CSSProperties}>
              <button
                type="button"
                className="mate-fan-card"
                aria-pressed={selected}
                onClick={() => onSelect(mate.id)}
              >
                <span className="mate-fan-art" style={mate.tint ? { filter: mate.tint } : undefined}>
                  {mate.image && <img src={mate.image} alt="" draggable={false} />}
                </span>
                <span className="mate-fan-name">{mate.name}</span>
              </button>
            </li>
          )
        })}
        {upcoming.map((mate) => (
          <li key={mate.id} className="mate-fan-item mate-fan-item--upcoming">
            <span className="mate-fan-card" aria-disabled="true">
              <span className="mate-fan-art" />
              <span className="mate-fan-name">{mate.name}</span>
              <span className="mate-switcher-soon">추가 예정</span>
            </span>
          </li>
        ))}
      </ul>
    </nav>
  )
}
