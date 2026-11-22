import { useEffect, useState } from 'react'
import { Icon } from '@/shared/ui/Icon'
import { DESKTOP_LOGIN_ASSETS } from './desktop-config'

function formatKoreanTime(date: Date): string {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date)
}

export interface MenuBarProps {
  showMotionToggle?: boolean
  motionPaused?: boolean
  onToggleMotion?: () => void
}

export function MenuBar({
  showMotionToggle = false,
  motionPaused = false,
  onToggleMotion,
}: MenuBarProps) {
  const [timeText, setTimeText] = useState(() => formatKoreanTime(new Date()))

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined
    const update = () => setTimeText(formatKoreanTime(new Date()))
    const msUntilNextMinute = (60 - new Date().getSeconds()) * 1000 + 50
    const timeoutId = setTimeout(() => {
      update()
      intervalId = setInterval(update, 60_000)
    }, msUntilNextMinute)

    return () => {
      clearTimeout(timeoutId)
      if (intervalId) clearInterval(intervalId)
    }
  }, [])

  return (
    <header className="desktop-menubar" aria-label="캡슐 바탕화면 상단 바">
      <div className="desktop-menubar-left">
        {/* Color symbol SVG at 18px (>=16px min, clear space >= H/4 = 4.5px) */}
        <span className="desktop-menubar-symbol">
          <img
            src={DESKTOP_LOGIN_ASSETS.logo.symbol}
            alt="CAPSULE"
            className="desktop-menubar-symbol-img"
            draggable={false}
          />
        </span>
      </div>
      <div className="desktop-menubar-right">
        {showMotionToggle && onToggleMotion && (
          <button
            type="button"
            className="desktop-menubar-motion-btn"
            aria-label={motionPaused ? '바탕화면 배경 애니메이션 재생' : '바탕화면 배경 애니메이션 일시정지'}
            aria-pressed={motionPaused}
            title={motionPaused ? '배경 애니메이션 재생' : '배경 애니메이션 일시정지'}
            onClick={onToggleMotion}
          >
            <Icon name={motionPaused ? 'play' : 'pause'} size={12} />
          </button>
        )}
        <span className="desktop-menubar-time">{timeText}</span>
        {/* Decorative OS status icons */}
        <svg
          aria-hidden="true"
          width="15"
          height="12"
          viewBox="0 0 16 12"
          fill="none"
          className="desktop-menubar-icon"
        >
          <path
            d="M1.5 4.2C4.9 1.2 11.1 1.2 14.5 4.2M4.1 7C6.2 5.1 9.8 5.1 11.9 7M6.7 9.7C7.4 9.1 8.6 9.1 9.3 9.7"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
        <svg
          aria-hidden="true"
          width="20"
          height="11"
          viewBox="0 0 22 12"
          fill="none"
          className="desktop-menubar-icon"
        >
          <rect
            x="0.75"
            y="1.25"
            width="17.5"
            height="9.5"
            rx="2.2"
            stroke="currentColor"
            strokeWidth="1.3"
          />
          <rect x="2.6" y="3.1" width="12.6" height="5.8" rx="1" fill="currentColor" />
          <rect x="19.5" y="4" width="1.8" height="4" rx="0.8" fill="currentColor" />
        </svg>
      </div>
    </header>
  )
}
