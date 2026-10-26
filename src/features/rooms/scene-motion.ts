import type { PointerEvent } from 'react'

export function moveScene(event: PointerEvent<HTMLElement>) {
  if (
    event.pointerType !== 'mouse' ||
    !window.matchMedia('(prefers-reduced-motion: no-preference)').matches
  )
    return
  const rect = event.currentTarget.getBoundingClientRect()
  event.currentTarget.style.setProperty(
    '--scene-x',
    `${((event.clientX - rect.left) / rect.width - 0.5) * 7}px`,
  )
  event.currentTarget.style.setProperty(
    '--scene-y',
    `${((event.clientY - rect.top) / rect.height - 0.5) * 4}px`,
  )
}
export function resetScene(event: PointerEvent<HTMLElement>) {
  event.currentTarget.style.setProperty('--scene-x', '0px')
  event.currentTarget.style.setProperty('--scene-y', '0px')
}
