import { flushSync } from 'react-dom'
import type { PrepareCapsuleScene } from './prepare-capsule-scene'
import { PREPARE_TRAVEL_MS } from './prepare-capsule-motion'

/** Own the imperative canvas across the route change; the prepared Live2D canvas stays live underneath. */
export async function travelToStudy(scene: PrepareCapsuleScene, navigate: () => void) {
  const curtain = document.createElement('dialog')
  curtain.className = 'prepare-journey'
  curtain.setAttribute('aria-label', '공부 화면으로 이동하고 있어요')
  curtain.setAttribute('aria-busy', 'true')
  curtain.addEventListener('cancel', event => event.preventDefault())
  let arrived = false, stopped = false, arrival: Animation | undefined, destination = ''
  const media = window.matchMedia('(prefers-reduced-motion: reduce)')
  function arrive() {
    if (arrived || stopped) return
    arrived = true
    flushSync(navigate)
    destination = window.location.pathname
    curtain.dataset.arriving = ''
    const app = document.getElementById('root')
    if (app && !media.matches) arrival = app.animate([
      { transform: 'perspective(1600px) translateX(12vw) rotateY(-8deg)', opacity: .45 },
      { transform: 'perspective(1600px) translateX(0) rotateY(0deg)', opacity: 1 },
    ], { duration: PREPARE_TRAVEL_MS * .8, easing: 'cubic-bezier(.16,1,.3,1)', fill: 'both' })
  }
  function stop() { stopped = true; scene.dispose() }
  function settle() { scene.settle() }
  function preference() { if (media.matches) settle() }
  function visibility() { if (document.hidden) settle() }
  // A browser Back action cancels the handoff instead of sending the user back to study later.
  function historyChanged() { if (!arrived || window.location.pathname !== destination) stop() }
  window.addEventListener('popstate', historyChanged)
  window.addEventListener('resize', settle)
  media.addEventListener('change', preference)
  document.addEventListener('visibilitychange', visibility)
  try {
    curtain.append(scene.canvas)
    document.body.append(curtain)
    curtain.showModal()
    await scene.depart(arrive)
  } catch {
    if (!stopped) arrive()
  } finally {
    scene.dispose()
    arrival?.cancel()
    curtain.close(); curtain.remove()
    window.removeEventListener('popstate', historyChanged)
    window.removeEventListener('resize', settle)
    media.removeEventListener('change', preference)
    document.removeEventListener('visibilitychange', visibility)
    if (arrived && window.location.pathname === destination) document.getElementById('main-content')?.focus({ preventScroll: true })
  }
}
