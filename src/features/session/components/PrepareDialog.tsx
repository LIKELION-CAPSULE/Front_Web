import { useCallback, useRef } from 'react'
import type { ComponentProps } from 'react'
import { Dialog } from '@/shared/ui/Dialog'

export function PrepareDialog({ children, ...props }: Omit<ComponentProps<typeof Dialog>, 'onOpen' | 'className'>) {
  const stack = useRef<HTMLDivElement>(null)
  const reveal = useCallback((dialog: HTMLDialogElement) => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const frame = stack.current
    if (!frame || media.matches || typeof frame.animate !== 'function') return

    const style = getComputedStyle(dialog)
    const angle = parseFloat(style.getPropertyValue('--prepare-stack-angle'))
    const pitch = parseFloat(style.getPropertyValue('--prepare-stack-pitch'))
    const yaw = parseFloat(style.getPropertyValue('--prepare-stack-yaw'))
    const compact = window.innerWidth < 768
    const pose = (x: number, y: number, rotation: number, scale: number) =>
      `translate3d(${x}px, ${y}px, 0) perspective(1400px) rotateX(${pitch}deg) rotateY(${yaw}deg) rotateZ(${rotation}deg) scale(${scale})`
    let finished = false
    dialog.dataset.stackEntering = ''
    const entrance = frame.animate([
      { transform: pose(compact ? 10 : 22, 54, angle - (compact ? 2.5 : 5), 0.94), opacity: 0, offset: 0, easing: 'cubic-bezier(.22,.8,.32,1)' },
      { transform: pose(-2, -6, angle + 0.8, 1.008), opacity: 1, offset: 0.65, easing: 'ease-in-out' },
      { transform: pose(1, 2, angle - 0.3, 0.998), opacity: 1, offset: 0.84, easing: 'ease-out' },
      { transform: pose(0, 0, angle, 1), opacity: 1, offset: 1 },
    ], { duration: 760, easing: 'linear', fill: 'both' })
    const layers = Array.from(frame.querySelectorAll<HTMLElement>('.prepare-stack-layer')).map((layer, index) =>
      layer.animate([
        { transform: 'translate(0px, 0px) rotate(0deg) scale(.97)', opacity: 0 },
        { transform: getComputedStyle(layer).transform, opacity: 1 },
      ], { duration: 640, delay: 20 + index * 25, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' }),
    )
    const animations = [entrance, ...layers]

    function finish() {
      if (finished) return
      finished = true
      animations.forEach(animation => animation.cancel())
      delete dialog.dataset.stackEntering
      window.removeEventListener('resize', finish)
      media.removeEventListener('change', finish)
    }
    entrance.onfinish = finish
    window.addEventListener('resize', finish)
    media.addEventListener('change', finish)
    return finish
  }, [])

  return <Dialog {...props} className="prepare-dialog prepare-dialog--stack" onOpen={reveal}>
    <div ref={stack} className="prepare-stack">
      <div className="prepare-stack-layer prepare-stack-layer--far" aria-hidden="true" />
      <div className="prepare-stack-layer prepare-stack-layer--near" aria-hidden="true" />
      <div className="prepare-stack-surface">{children}</div>
    </div>
  </Dialog>
}
