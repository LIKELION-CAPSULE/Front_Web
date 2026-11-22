import { useState, type MouseEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { chaerinArtwork, matePortrait } from '@/features/mates/artwork'
import type { AvailableMate } from '../catalog'

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> }
}

export function MateCard({ mate }: { mate: AvailableMate }) {
  const navigate = useNavigate()
  const [bgFailed, setBgFailed] = useState(false)
  const target = `/mates/${mate.id}`

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return
    }
    const reduced =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const doc = document as ViewTransitionDocument
    if (reduced || typeof doc.startViewTransition !== 'function') {
      return
    }
    event.preventDefault()
    const card = event.currentTarget
    card.style.viewTransitionName = 'mate-card-expand'
    const transition = doc.startViewTransition(() => {
      navigate(target)
    })
    void transition.finished.finally(() => {
      card.style.viewTransitionName = ''
    })
  }

  return (
    <Link to={target} className="mate-card desktop-window" onClick={handleClick}>
      <div className="desktop-window-titlebar mate-card-titlebar">
        <div className="desktop-window-title-left">
          <span className="mate-card-status-dot mate-card-status-dot--online" aria-hidden="true" />
          <h3 className="mate-card-name">{mate.name}</h3>
          <span className="mate-card-status-label">연결 가능</span>
        </div>
        <div className="desktop-window-title-right">
          <span className="mate-age-badge">전연령</span>
        </div>
      </div>
      <div className="mate-card-image">
        {!bgFailed && (
          <img
            src={chaerinArtwork.callBackground.landscape}
            alt=""
            aria-hidden="true"
            className="mate-card-bg-img"
            loading="lazy"
            decoding="async"
            draggable={false}
            onError={() => setBgFailed(true)}
          />
        )}
        <img
          src={matePortrait(mate.id, mate.image)}
          alt=""
          className="mate-card-char-img"
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      </div>
      <div className="mate-card-copy">
        {mate.introduction && <p>{mate.introduction}</p>}
        {mate.tags.length > 0 && (
          <div className="mate-tags">
            {mate.tags.map((tag) => (
              <span key={tag}>#{tag}</span>
            ))}
          </div>
        )}
      </div>
    </Link>
  )
}
