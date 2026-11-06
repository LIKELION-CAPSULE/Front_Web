import { useCallback, useId, useRef } from 'react'
import type { ComponentProps } from 'react'
import { Dialog } from '@/shared/ui/Dialog'

// The pocket covers the card's left side, with a rounded opening on the right.
const pocketPath = 'M .064 .005 H .714 C .758 .005 .792 .032 .792 .078 V .602 C .792 .668 .812 .711 .853 .746 L .906 .788 C .94 .815 .955 .852 .955 .9 V .937 C .955 .973 .932 .995 .896 .995 H .064 C .028 .995 .005 .972 .005 .936 V .065 C .005 .029 .028 .005 .064 .005 Z'

export function PrepareDialog({ children, ...props }: Omit<ComponentProps<typeof Dialog>, 'onOpen' | 'className'>) {
  const stage = useRef<HTMLDivElement>(null)
  const clipId = `prepare-pocket-${useId().replace(/:/g, '')}`
  const rimId = `${clipId}-rim`
  const reveal = useCallback((dialog: HTMLDialogElement) => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const frame = stage.current
    const card = frame?.querySelector<HTMLElement>('.prepare-folder-card')
    const back = frame?.querySelector<HTMLElement>('.prepare-folder-back')
    const front = frame?.querySelector<HTMLElement>('.prepare-folder-front')
    const content = frame?.querySelector<HTMLElement>('.prepare-folder-content')
    const paper = frame?.querySelector<HTMLElement>('.prepare-folder-paper')
    const reflection = frame?.querySelector<HTMLElement>('.prepare-folder-reflection')
    if (!frame || !card || !back || !front || !content || !paper || !reflection || media.matches || typeof card.animate !== 'function') return

    const style = getComputedStyle(dialog)
    const angle = parseFloat(style.getPropertyValue('--prepare-card-angle'))
    const pitch = parseFloat(style.getPropertyValue('--prepare-card-pitch'))
    const yaw = parseFloat(style.getPropertyValue('--prepare-card-yaw'))
    const compact = window.innerWidth < 768
    const sideRoom = (window.innerWidth - frame.clientWidth) / 2
    const travel = Math.max(12, Math.min(frame.clientWidth * .19, compact ? 34 : 130, sideRoom + frame.clientWidth * .06 - 20))
    const retreat = Math.min(travel, Math.max(0, sideRoom - 32))
    const cardPose = (x: number, y: number, rotation: number, scale: number, tilt = 1) =>
      `translate3d(${x}px, ${y}px, 0) perspective(1400px) rotateX(${pitch * tilt}deg) rotateY(${yaw * tilt}deg) rotateZ(${rotation}deg) scale(${scale})`
    const folderPose = (x: number, y: number, rotation: number, scale: number, hinge = 0) =>
      `translate3d(${x}px, ${y}px, 0) perspective(2400px) rotateY(${hinge}deg) rotateZ(${rotation * (compact ? .55 : 1)}deg) scale(${scale})`
    const duration = 1100
    let finished = false
    dialog.dataset.folderEntering = ''
    const entrance = card.animate([
      { transform: cardPose(-travel * .32, 24, angle - 3, .74), opacity: 0, offset: 0, easing: 'ease-out' },
      { transform: cardPose(-travel * .32, 10, angle - 3, .76), opacity: 1, offset: .15, easing: 'cubic-bezier(.4,0,.2,1)' },
      { transform: cardPose(travel, -12, angle + 2.2, .88), opacity: 1, offset: .56, easing: 'cubic-bezier(.16,1,.3,1)' },
      { transform: cardPose(-3, 1, -.2, 1.002, .12), opacity: 1, offset: .88, easing: 'ease-out' },
      { transform: cardPose(0, 0, 0, 1, 0), opacity: 1, offset: 1 },
    ], { duration, easing: 'linear', fill: 'both' })
    const animations = [entrance,
      back.animate([
        { transform: folderPose(-travel * .2, 30, -5, .92), opacity: 0, offset: 0, easing: 'ease-out' },
        { transform: folderPose(0, 0, -4, 1), opacity: 1, offset: .15 },
        { transform: folderPose(0, 0, -4, 1), opacity: 1, offset: .5, easing: 'cubic-bezier(.4,0,.2,1)' },
        { transform: folderPose(-retreat * .8, 22, -8, .88), opacity: 0, offset: .84 },
        { transform: folderPose(-retreat * .8, 22, -8, .88), opacity: 0, offset: 1 },
      ], { duration, easing: 'linear', fill: 'both' }),
      front.animate([
        { transform: folderPose(-travel * .2, 30, -5, .92, -2), opacity: 0, offset: 0, easing: 'ease-out' },
        { transform: folderPose(0, 0, -4, 1, -2), opacity: 1, offset: .15, easing: 'cubic-bezier(.22,.7,.3,1)' },
        { transform: folderPose(-travel * .08, 2, -5, .96, -24), opacity: 1, offset: .4, easing: 'ease-in-out' },
        { transform: folderPose(-travel * .2, 6, -6, .94, -28), opacity: 1, offset: .53, easing: 'cubic-bezier(.4,0,.2,1)' },
        { transform: folderPose(-retreat * .95, 24, -10, .86, -32), opacity: 0, offset: .8 },
        { transform: folderPose(-retreat * .95, 24, -10, .86, -32), opacity: 0, offset: 1 },
      ], { duration, easing: 'linear', fill: 'both' }),
      content.animate([
        { opacity: 0, offset: 0 }, { opacity: 0, offset: .4, easing: 'ease-out' },
        { opacity: 1, offset: .76 }, { opacity: 1, offset: 1 },
      ], { duration, easing: 'linear', fill: 'both' }),
      paper.animate([
        { opacity: 1, offset: 0 }, { opacity: 1, offset: .38, easing: 'ease-out' },
        { opacity: 0, offset: .65 }, { opacity: 0, offset: 1 },
      ], { duration, easing: 'linear', fill: 'both' }),
      reflection.animate([
        { transform: 'translateX(-22%)', opacity: .2, offset: 0 },
        { transform: 'translateX(-16%)', opacity: .25, offset: .15, easing: 'ease-in-out' },
        { transform: 'translateX(12%)', opacity: .65, offset: .46, easing: 'ease-out' },
        { transform: 'translateX(30%)', opacity: .18, offset: .8 },
        { transform: 'translateX(30%)', opacity: .18, offset: 1 },
      ], { duration, easing: 'linear', fill: 'both' }),
    ]

    function finish() {
      if (finished) return
      finished = true
      animations.forEach(animation => animation.cancel())
      delete dialog.dataset.folderEntering
      window.removeEventListener('resize', finish)
      media.removeEventListener('change', finish)
      dialog.removeEventListener('pointerdown', finish)
      dialog.removeEventListener('keydown', finish)
    }
    entrance.onfinish = finish
    window.addEventListener('resize', finish)
    media.addEventListener('change', finish)
    // A deliberate interaction settles the card immediately, including keyboard navigation.
    dialog.addEventListener('pointerdown', finish)
    dialog.addEventListener('keydown', finish)
    return finish
  }, [])

  return <Dialog {...props} className="prepare-dialog prepare-dialog--folder" onOpen={reveal}>
    <div ref={stage} className="prepare-folder-stage">
      <svg className="prepare-folder-defs" aria-hidden="true" focusable="false">
        <defs>
          <clipPath id={clipId} clipPathUnits="objectBoundingBox"><path d={pocketPath} /></clipPath>
          <linearGradient id={rimId} x1="0" y1="0" x2=".85" y2="1">
            <stop offset="0" stopColor="#ffffff" stopOpacity=".95" />
            <stop offset=".28" stopColor="#f2eaff" stopOpacity=".55" />
            <stop offset=".55" stopColor="#e2cfff" stopOpacity=".18" />
            <stop offset=".78" stopColor="#e6d4ff" stopOpacity=".5" />
            <stop offset="1" stopColor="#513469" stopOpacity=".65" />
          </linearGradient>
        </defs>
      </svg>
      <div className="prepare-folder-back" aria-hidden="true">
        <span className="prepare-folder-tab" />
        <div className="prepare-folder-documents">
          <span className="prepare-folder-sheet prepare-folder-sheet--back" />
          <span className="prepare-folder-sheet prepare-folder-sheet--middle" />
          <span className="prepare-folder-sheet prepare-folder-sheet--front"><i /><i /><i /></span>
        </div>
      </div>
      <div className="prepare-folder-card">
        <div className="prepare-folder-paper" aria-hidden="true">
          <span /><span /><span /><span />
        </div>
        <div className="prepare-folder-content">{children}</div>
      </div>
      <div className="prepare-folder-front" aria-hidden="true">
        <svg className="prepare-folder-pocket-depth" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path d={pocketPath} fill="none" stroke="#795a9b" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="prepare-folder-pocket" style={{ clipPath: `url(#${clipId})` }}>
          <span className="prepare-folder-reflection" />
          <span className="prepare-folder-spine" />
          <span className="prepare-folder-seam" />
        </div>
        <svg className="prepare-folder-rim" viewBox="0 0 1 1" preserveAspectRatio="none" aria-hidden="true" focusable="false">
          <path d={pocketPath} fill="none" stroke="#432554" strokeOpacity=".2" strokeWidth="3" vectorEffect="non-scaling-stroke" />
          <path d={pocketPath} fill="none" stroke={`url(#${rimId})`} strokeWidth="1.2" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    </div>
  </Dialog>
}
