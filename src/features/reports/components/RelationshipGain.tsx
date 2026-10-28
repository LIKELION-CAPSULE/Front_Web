import { useLayoutEffect, useRef, useState } from 'react'
import { useReducedMotion } from '@/shared/lib/use-reduced-motion'
import { measuredDuration } from '@/shared/lib/format'
import { Icon } from '@/shared/ui/Icon'
import { withParticle } from '@/shared/lib/korean'
import type { CSSProperties } from 'react'
import type { ReportRelationship } from '../report-relationship'

export function RelationshipGain({ name, gain }: { name: string; gain: ReportRelationship }) {
  const reduced = useReducedMotion()
  const fill = useRef<HTMLSpanElement>(null)
  const meter = useRef<HTMLDivElement>(null)
  const [level, setLevel] = useState(gain.before.level)
  const [burst, setBurst] = useState(0)
  const [finished, setFinished] = useState(false)
  useLayoutEffect(() => {
    let frame = 0, timer = 0
    let stopped = false
    function paint(progress: number) {
      if (fill.current) fill.current.style.width = `${progress}%`
      meter.current?.setAttribute('aria-valuenow', String(Math.round(progress * 10) / 10))
    }
    if (reduced) { paint(gain.after.progress); return }
    paint(gain.before.progress)
    const wait = (ms: number) => new Promise<void>(resolve => { timer = window.setTimeout(resolve, ms) })
    const animate = (from: number, to: number) => new Promise<void>(resolve => {
      const start = performance.now()
      function tick(now: number) {
        if (stopped) return
        const t = Math.min(1, (now - start) / 1100)
        paint(from + (to - from) * (1 - (1 - t) ** 3))
        if (t < 1) frame = requestAnimationFrame(tick)
        else resolve()
      }
      frame = requestAnimationFrame(tick)
    })
    async function play() {
      await wait(280)
      if (stopped) return
      for (const step of gain.steps) {
        setLevel(step.level)
        await animate(step.from, step.to)
        if (stopped) return
        if (step.nextLevel) {
          setBurst(step.nextLevel)
          await wait(500)
          if (stopped) return
          setLevel(step.nextLevel)
          paint(step.nextLevel === 5 ? 100 : 0)
        }
      }
      if (stopped) return
      paint(gain.after.progress)
      setLevel(gain.after.level)
      setFinished(true)
    }
    void play()
    return () => { stopped = true; cancelAnimationFrame(frame); clearTimeout(timer) }
  }, [gain, reduced])
  const displayLevel = reduced ? gain.after.level : level
  const complete = reduced || finished
  const leveled = gain.after.level > gain.before.level
  return (
    <section className="report-relationship-gain" data-complete={complete || undefined} data-level-up={burst || (reduced && leveled) || undefined}>
      <div className="report-gain-heading"><h3>{withParticle(name, '과', '와')} 함께한 시간</h3><strong>+{measuredDuration(gain.gainSeconds)}</strong></div>
      <div ref={meter} className="report-gain-track" role="progressbar" aria-label={`${name} 관계 진행도`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={reduced ? gain.after.progress : gain.before.progress}>
        <span ref={fill} className="report-gain-fill" style={{ width: `${reduced ? gain.after.progress : gain.before.progress}%` }} />
      </div>
      <div className="report-gain-details"><span className="report-gain-level">Lv.{displayLevel} 친구</span><span className="report-gain-next">{gain.after.level === 5 ? '가장 가까운 친구가 되었어요' : `Lv.${gain.after.level + 1}까지 ${gain.after.next}분`}</span></div>
      {leveled && <p className="report-gain-celebration" role="status"><Icon name="sparkle" size={15} />Lv.{gain.after.level}로 더 가까워졌어요</p>}
      {burst > 0 && <span key={burst} className="report-gain-burst" aria-hidden="true"><i />{Array.from({ length: 10 }, (_, index) => <span key={index} style={{ '--spark-index': index } as CSSProperties} />)}</span>}
    </section>
  )
}
