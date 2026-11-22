import { Fragment } from 'react'
import { DESKTOP_ICONS, type DesktopIconItem } from './desktop-config'

/** Insert <wbr> strictly after "_" and "." so Chromium & WebKit wrap at natural filename boundaries. */
function renderFilenameWithBreaks(label: string) {
  const parts = label.split(/(?<=[_.])/)
  return parts.map((part, idx) => (
    <Fragment key={`${idx}-${part}`}>
      {part}
      {idx < parts.length - 1 && <wbr />}
    </Fragment>
  ))
}

interface DesktopIconsProps {
  selectedId: string | null
  onSelect: (id: string) => void
  onOpen: (item: DesktopIconItem) => void
}

function DesktopIconGraphic({ kind }: { kind: DesktopIconItem['kind'] }) {
  if (kind === 'folder') {
    return (
      <svg aria-hidden="true" width="40" height="36" viewBox="0 0 40 36" fill="none">
        <path
          d="M4 9C4 6.79 5.79 5 8 5H15.4C16.4 5 17.35 5.42 18.02 6.16L19.6 7.9H32C34.21 7.9 36 9.69 36 11.9V27C36 29.21 34.21 31 32 31H8C5.79 31 4 29.21 4 27V9Z"
          fill="#7E54F6"
          fillOpacity="0.86"
        />
        <path
          d="M4 12.5H36V27C36 29.21 34.21 31 32 31H8C5.79 31 4 29.21 4 27V12.5Z"
          fill="#AC95F8"
          fillOpacity="0.45"
        />
      </svg>
    )
  }

  const badgeText = kind === 'pdf' ? 'PDF' : 'FIG'
  const badgeColor = kind === 'pdf' ? '#F4A9C9' : '#C4B9F3'

  return (
    <svg aria-hidden="true" width="36" height="40" viewBox="0 0 36 40" fill="none">
      <path
        d="M6 5C6 3.34 7.34 2 9 2H22L30 10V35C30 36.66 28.66 38 27 38H9C7.34 38 6 36.66 6 35V5Z"
        fill="#292733"
        stroke="rgba(250,250,253,0.18)"
        strokeWidth="1.2"
      />
      <path d="M22 2V10H30" fill="#403E4B" />
      <rect x="9.5" y="21" width="17" height="9" rx="2.5" fill={badgeColor} fillOpacity="0.22" />
      <text
        x="18"
        y="27.5"
        textAnchor="middle"
        fill={badgeColor}
        fontSize="6.8"
        fontWeight="700"
        fontFamily="Pretendard, sans-serif"
      >
        {badgeText}
      </text>
    </svg>
  )
}

export function DesktopIcons({ selectedId, onSelect, onOpen }: DesktopIconsProps) {
  return (
    <div className="desktop-icons" role="group" aria-label="바탕화면 아이콘">
      {DESKTOP_ICONS.map((item) => {
        const selected = selectedId === item.id
        return (
          <button
            key={item.id}
            type="button"
            className="desktop-icon-btn"
            aria-pressed={selected}
            aria-label={`${item.label} (더블클릭하거나 Enter로 반응 보기)`}
            onClick={(e) => {
              e.stopPropagation()
              onSelect(item.id)
            }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              onSelect(item.id)
              onOpen(item)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                onSelect(item.id)
                onOpen(item)
              }
            }}
          >
            <span className="desktop-icon-glyph">
              <DesktopIconGraphic kind={item.kind} />
            </span>
            <span className="desktop-icon-label" aria-hidden="true">
              {renderFilenameWithBreaks(item.label)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
