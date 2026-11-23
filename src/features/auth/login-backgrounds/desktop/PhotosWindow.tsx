import { useEffect, useRef, useState } from 'react'
import { DesktopWindow } from './DesktopWindow'
import { CHAERIN_SELFIES, PHOTO_LOCKED_LINE } from './desktop-config'

const selfieFiles = import.meta.glob('/src/assets/characters/chaerin-live2d-v1/selfies/selfie-0*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

function selfieUrl(id: string): string | null {
  return Object.entries(selfieFiles).find(([path]) => path.endsWith(`/${id}.webp`))?.[1] ?? null
}

interface PhotosWindowProps {
  x: number
  y: number
  width: number
  zIndex: number
  active: boolean
  onMove: (x: number, y: number) => void
  onFocus: () => void
  onClose: () => void
  onView: (photo: (typeof CHAERIN_SELFIES)[number]) => void
  onLocked: () => void
}

/** "사진" folder opened by tapping it repeatedly on the login desktop. Read-only, nothing is stored. */
export function PhotosWindow({ x, y, width, zIndex, active, onMove, onFocus, onClose, onView, onLocked }: PhotosWindowProps) {
  const [viewing, setViewing] = useState<number | null>(null)
  const backRef = useRef<HTMLButtonElement>(null)
  const gridRef = useRef<HTMLUListElement>(null)
  const lastThumb = useRef(0)

  useEffect(() => {
    if (viewing !== null) backRef.current?.focus()
    else gridRef.current?.querySelectorAll<HTMLButtonElement>('button')[lastThumb.current]?.focus()
  }, [viewing])

  const open = (index: number) => {
    lastThumb.current = index
    setViewing(index)
    onView(CHAERIN_SELFIES[index]!)
  }
  const step = (delta: number) => {
    if (viewing === null) return
    open((viewing + delta + CHAERIN_SELFIES.length) % CHAERIN_SELFIES.length)
  }
  const current = viewing === null ? null : CHAERIN_SELFIES[viewing]!

  return (
    <DesktopWindow
      id="photos-app"
      role="dialog"
      ariaModal={false}
      x={x}
      y={y}
      width={width}
      zIndex={zIndex}
      active={active}
      title={<span>사진 — 채린</span>}
      bodyClassName="desktop-photos-body"
      onClose={onClose}
      onMove={onMove}
      onFocus={onFocus}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          if (viewing !== null) setViewing(null)
          else onClose()
        } else if (viewing !== null && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
          e.preventDefault()
          step(e.key === 'ArrowRight' ? 1 : -1)
        }
      }}
    >
      {current ? (
        <figure className="desktop-photos-viewer">
          <div className="desktop-photos-viewer-frame">
            {selfieUrl(current.id) ? (
              <img src={selfieUrl(current.id)!} alt={`채린의 사진: ${current.title}`} draggable={false} />
            ) : (
              <div className="desktop-photos-placeholder" role="img" aria-label={`채린의 사진: ${current.title}`} />
            )}
          </div>
          <figcaption className="desktop-photos-viewer-bar">
            <button ref={backRef} type="button" className="desktop-photos-nav" onClick={() => setViewing(null)}>
              ← 모아 보기
            </button>
            <span className="desktop-photos-viewer-title">
              {current.title} · {viewing! + 1}/{CHAERIN_SELFIES.length}
            </span>
            <span className="desktop-photos-viewer-steps">
              <button type="button" className="desktop-photos-nav" aria-label="이전 사진" onClick={() => step(-1)}>‹</button>
              <button type="button" className="desktop-photos-nav" aria-label="다음 사진" onClick={() => step(1)}>›</button>
            </span>
          </figcaption>
        </figure>
      ) : (
        <ul ref={gridRef} className="desktop-photos-grid" aria-label="채린의 사진">
          {CHAERIN_SELFIES.map((photo, index) => {
            const url = selfieUrl(photo.id)
            return (
              <li key={photo.id}>
                <button type="button" className="desktop-photos-thumb" onClick={() => open(index)} aria-label={`${photo.title} 크게 보기`}>
                  {url ? <img src={url} alt="" draggable={false} /> : <span className="desktop-photos-placeholder" aria-hidden="true" />}
                </button>
              </li>
            )
          })}
          <li>
          <button type="button" className="desktop-photos-thumb desktop-photos-thumb--locked" onClick={onLocked} aria-label={PHOTO_LOCKED_LINE}>
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <rect x="5" y="11" width="14" height="9" rx="2" />
              <path d="M8 11V8a4 4 0 0 1 8 0v3" />
            </svg>
            <span>+8</span>
          </button>
          </li>
        </ul>
      )}
    </DesktopWindow>
  )
}
