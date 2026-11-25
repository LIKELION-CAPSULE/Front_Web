import { PILLAR_MODE_LABELS, PILLAR_MODES, type PillarMode } from './capsule-board-pillars'

/**
 * DEV only (RecordsPage loads it behind `import.meta.env.DEV`): switches the 2.5D board between the current columns and
 * the 「유리 기둥」 and 「엇갈려 쌓기」 drafts, the same as `?pillars=glass|glass-aid|stack|stack-aid`. Bottom-left corner, out of the way of the local
 * dummy controls (bottom-right).
 */
export default function PillarDevSwitch({ value, onChange }: { value: PillarMode; onChange: (mode: PillarMode) => void }) {
  return (
    <div
      role="radiogroup"
      aria-label="보드 기둥 시안 (개발용)"
      style={{
        position: 'fixed',
        left: 16,
        bottom: 16,
        zIndex: 60,
        display: 'flex',
        gap: 4,
        padding: 4,
        borderRadius: 12,
        background: 'color-mix(in srgb, var(--color-floating) 92%, transparent)',
        boxShadow: 'var(--popover-shadow)',
        fontSize: 12,
      }}
    >
      <span style={{ alignSelf: 'center', padding: '0 6px', color: 'var(--color-subtle)' }}>DEV 기둥</span>
      {PILLAR_MODES.map((mode) => (
        <button
          key={mode}
          type="button"
          role="radio"
          aria-checked={mode === value}
          data-pillar-mode={mode}
          onClick={() => onChange(mode)}
          style={{
            border: 0,
            borderRadius: 8,
            padding: '6px 10px',
            background: mode === value ? 'var(--color-selected)' : 'transparent',
            color: mode === value ? 'var(--color-selected-text)' : 'var(--color-ink)',
            fontWeight: mode === value ? 700 : 500,
            cursor: 'pointer',
          }}
        >
          {PILLAR_MODE_LABELS[mode]}
        </button>
      ))}
    </div>
  )
}
