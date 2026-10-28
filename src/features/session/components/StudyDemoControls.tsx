import { useEffect, useRef } from 'react'
import { Link } from 'react-router'
import { Icon } from '@/shared/ui/Icon'
import { ButtonLink } from '@/shared/ui/Button'

export function StudyDemoControls({ studying, onBreak, onReaction, onReturn }: {
  studying: boolean
  onBreak: () => void
  onReaction: (level: number) => void
  onReturn: () => void
}) {
  const ref = useRef<HTMLDetailsElement>(null)
  const close = () => { if (ref.current) ref.current.open = false }
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (event.target instanceof Node && !ref.current?.contains(event.target)) close()
    }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [])
  function run(action: () => void) { action(); close() }
  return (
    <details ref={ref} className="study-demo-controls" onKeyDown={(event) => {
      if (event.key === 'Escape' && event.currentTarget.open) {
        close()
        event.currentTarget.querySelector('summary')?.focus()
        event.stopPropagation()
      }
    }}>
      <summary aria-label="데모 조작" title="데모 조작">
        <Icon name="sliders" size={14} />
        <span className="study-demo-label">데모 조작</span>
      </summary>
      <div className="study-demo-menu">
        <p>친구 반응과 쉬는 시간을 미리 확인할 수 있어요.</p>
        <div className="flex flex-wrap gap-1.5">
          {studying && <>
            <button type="button" onClick={() => run(onBreak)}>휴식 화면 보기</button>
            {[1, 2, 3].map((level) => <button key={level} type="button" onClick={() => run(() => onReaction(level))}>반응 {level}단계</button>)}
            <button type="button" onClick={() => run(onReturn)}>공부 복귀</button>
          </>}
          <Link to="/" onClick={close}>홈으로</Link>
          <ButtonLink to="/credits" variant="secondary" size="xs" onClick={close}>내 크레딧</ButtonLink>
        </div>
      </div>
    </details>
  )
}
