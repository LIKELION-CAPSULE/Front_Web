import type { CSSProperties } from 'react'
import { Icon } from '@/shared/ui/Icon'
import type { MateExpressionUnlock } from '../my-mates-utils'
import './mate-expression-collection.css'

/**
 * Expression collection of 내 메이트: a face thumbnail per expression, in one row of the 「함께한 시간」 column.
 * Unlocked ones are buttons (pressed = the panel's big mate wears that face, pressing again returns to the default
 * face); locked ones show the same face darkened like a silhouette with a lock and the stage that opens them.
 * The column's block title names it (`labelledBy`) and shows the count (`expressionCount`, my-mates-utils.ts).
 */

export function MateExpressionCollection({
  expressions,
  selected,
  onSelect,
  thumbnailFor,
  tint,
  labelledBy,
}: {
  expressions: readonly MateExpressionUnlock[]
  selected: string | null
  onSelect: (expression: MateExpressionUnlock | null) => void
  /** Face thumbnail for an expression file, when the mate has them. */
  thumbnailFor?: (expressionFile: string) => string | undefined
  /** CSS filter for development preview mates (tinted art). */
  tint?: string
  /** Id of the title that names the list. */
  labelledBy?: string
}) {
  const faceStyle = tint ? ({ filter: tint } as CSSProperties) : undefined
  return (
    <ul
      className="mate-expressions"
      style={{ '--count': expressions.length } as CSSProperties}
      {...(labelledBy ? { 'aria-labelledby': labelledBy } : { 'aria-label': '표정 컬렉션' })}
    >
        {expressions.map((item) => {
          const thumbnail = thumbnailFor?.(item.expressionFile)
          const face = (
            <span className="mate-expression-face" aria-hidden="true">
              {thumbnail ? <img src={thumbnail} alt="" draggable={false} style={faceStyle} /> : null}
              {!item.unlocked && (
                <span className="mate-expression-lock">
                  <Icon name="lock" size={13} />
                </span>
              )}
            </span>
          )
          return item.unlocked ? (
            <li key={item.id}>
              <button
                type="button"
                className="mate-expression"
                aria-pressed={selected === item.expressionFile}
                onClick={() => onSelect(selected === item.expressionFile ? null : item)}
              >
                {face}
                <span className="mate-expression-label">{item.label}</span>
              </button>
            </li>
          ) : (
            <li key={item.id}>
              <div
                className="mate-expression mate-expression--locked"
                role="img"
                aria-label={`잠긴 표정. ${item.condition ?? '아직 열리지 않았어요'}`}
                title={item.condition}
              >
                {face}
                {/* Short on the tile: the stage that opens it (its name only where there is room); the full condition
                    is the label and the tooltip. */}
                <span className="mate-expression-condition" aria-hidden="true">
                  {item.unlockStage && item.unlockStageName ? (
                    <>
                      <span className="mate-expression-condition-stage">{item.unlockStage}단계</span>
                      <span className="mate-expression-condition-name">{item.unlockStageName}</span>
                    </>
                  ) : (
                    (item.unlockStageName ?? item.condition ?? '잠겨 있어요')
                  )}
                </span>
              </div>
            </li>
          )
        })}
    </ul>
  )
}
