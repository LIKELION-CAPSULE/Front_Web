import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { createCapsuleScene } from '../capsule-intro-scene'
import { CapsuleIntroFallback, type CapsuleIntroProps } from './CapsuleIntroFallback'
import '../capsule-intro.css'

/** Full-screen 3D capsule that drops, shakes while the record loads, and opens. Loaded lazily with three.js. */
export default function CapsuleIntro(props: CapsuleIntroProps) {
  const [failed, setFailed] = useState(false)
  return failed ? <CapsuleIntroFallback {...props} /> : <CapsuleScene {...props} onFail={() => setFailed(true)} />
}

function CapsuleScene({ ready, onOpen, onDone, onFail }: CapsuleIntroProps & { onFail: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const latest = useRef({ ready, onOpen, onDone, onFail })
  useLayoutEffect(() => { latest.current = { ready, onOpen, onDone, onFail } })

  useEffect(() => {
    let scene: ReturnType<typeof createCapsuleScene>
    try { scene = createCapsuleScene(host.current!) }
    catch {
      // WebGL is unavailable or the context could not be created.
      host.current?.replaceChildren()
      latest.current.onFail()
      return
    }
    const { canvas, floatG, cap, body, seam, shadow, glow, dolly } = scene
    let current: gsap.core.Timeline | undefined

    // One shake is 12 half-swings of 0.07 s (0.84 s) and ends level, so it can stop or repeat cleanly.
    const shake = () => gsap.timeline()
      .to(floatG.rotation, { z: 0.07, duration: 0.07, ease: 'sine.inOut', yoyo: true, repeat: 11 }, 0)
      .to(shadow.scale, { x: 0.94, duration: 0.07, ease: 'sine.inOut', yoyo: true, repeat: 11 }, 0)

    const open = () => gsap.timeline({ onComplete: () => latest.current.onDone() })
      .addLabel('ready', 0)
      .to(dolly, { offset: -0.55, duration: 1.1, ease: 'power2.inOut' }, 'ready')
      .to(seam.material, { opacity: 0.9, duration: 0.6 }, 'ready+=0.3')
      .to(cap.position, { y: 0.035, duration: 0.5, ease: 'power2.inOut' }, 'ready+=0.4')
      .to(body.position, { y: -0.035, duration: 0.5, ease: 'power2.inOut' }, 'ready+=0.4')
      .addLabel('open', 'ready+=1.0')
      .call(() => latest.current.onOpen(), [], 'open')
      .to(cap.position, { y: 1.75, z: -0.7, duration: 1.6, ease: 'expo.out' }, 'open')
      .to(body.position, { y: -1.75, z: -0.7, duration: 1.6, ease: 'expo.out' }, 'open')
      .to(cap.rotation, { x: -0.75, duration: 1.6, ease: 'expo.out' }, 'open')
      .to(body.rotation, { x: 0.75, duration: 1.6, ease: 'expo.out' }, 'open')
      .to(seam.material, { opacity: 0, duration: 0.35 }, 'open')
      .to(shadow.material, { opacity: 0, duration: 0.5 }, 'open')
      .to(glow.material, { opacity: 0.95, duration: 0.18 }, 'open')
      .to(glow.scale, { x: 4.2, y: 4.2, duration: 1.1, ease: 'expo.out' }, 'open')
      .to(glow.material, { opacity: 0, duration: 0.9 }, 'open+=0.2')
      .to(dolly, { offset: 0, duration: 1.4, ease: 'power3.out' }, 'open')
      .to(canvas, { opacity: 0, duration: 0.8 }, 'open+=0.9')

    // Keep shaking, one whole cycle at a time, until the record is ready.
    const next = () => { current = latest.current.ready ? open() : shake().eventCallback('onComplete', next) }

    floatG.position.y = 2.4
    floatG.rotation.y = -0.7
    gsap.set(canvas, { opacity: 0 })
    current = gsap.timeline({ onComplete: next })
      .to(canvas, { opacity: 1, duration: 0.25 }, 0)
      .to(floatG.position, { y: 0, duration: 0.8, ease: 'bounce.out' }, 0)
      .to(floatG.rotation, { y: 0, duration: 1.0, ease: 'power2.out' }, 0)
      .to(shadow.material, { opacity: 0.55, duration: 0.5 }, 0.15)
      .add(shake())

    return () => {
      current?.kill()
      scene.dispose()
    }
  }, [])

  return <div ref={host} className="capsule-intro" aria-hidden="true" />
}
