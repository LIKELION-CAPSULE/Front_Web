import { Fragment } from 'react'
import { GUIDE_STEPS } from '../guide-steps'

/** All step copies stacked in one place; only `step` shows, the others fade out and are hidden from readers. */
export function GuideCopy({ step }: { step: number }) {
  return (
    <div className="usage-guide-copy" aria-live="polite">
      {GUIDE_STEPS.map((item, index) => (
        <div key={item.id} className="usage-guide-copy-item" data-active={index === step || undefined} aria-hidden={index !== step}>
          <p className="eyebrow">{item.eyebrow}</p>
          <h2 className="usage-guide-title">
            {item.title.split('\n').map((line, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                {line}
              </Fragment>
            ))}
          </h2>
          <p className="usage-guide-body">{item.body}</p>
        </div>
      ))}
    </div>
  )
}

/** Step dots; the current one is wider. */
export function GuideDots({ step }: { step: number }) {
  return (
    <ol className="usage-guide-dots" aria-label={`${GUIDE_STEPS.length}단계 중 ${step + 1}단계`}>
      {GUIDE_STEPS.map((item, index) => (
        <li key={item.id} data-active={index === step || undefined} />
      ))}
    </ol>
  )
}
