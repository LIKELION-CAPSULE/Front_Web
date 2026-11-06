import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { createCapsuleScene } from '../capsule-intro-scene'
import { CapsuleIntroFallback, type CapsuleIntroProps } from './CapsuleIntroFallback'
import '../capsule-intro.css'

/** Crack blows: when (after ready), how far the cracks reach, how many shards fly and how hard the pill jolts. */
const BLOWS = [
  { at: 0.3, crack: 0.32, chips: 5, recoil: 0.022 },
  { at: 0.78, crack: 0.66, chips: 7, recoil: 0.028 },
  { at: 1.18, crack: 1.0, chips: 10, recoil: 0.034 },
]

/** Full-screen 3D capsule that drops, shakes while the record loads, then cracks and bursts open. Loaded lazily with three.js. */
export default function CapsuleIntro(props: CapsuleIntroProps) {
  const [failed, setFailed] = useState(false)
  return failed ? <CapsuleIntroFallback {...props} /> : <CapsuleScene {...props} onFail={() => setFailed(true)} />
}

function CapsuleScene({ ready, onOpen, onDone, onFail, getCardQuad }: CapsuleIntroProps & { onFail: () => void }) {
  const host = useRef<HTMLDivElement>(null)
  const grain = useRef<HTMLDivElement>(null)
  const latest = useRef({ ready, onOpen, onDone, onFail, getCardQuad })
  useLayoutEffect(() => { latest.current = { ready, onOpen, onDone, onFail, getCardQuad } })

  useEffect(() => {
    const overlay = host.current!
    const film = grain.current!
    let scene: ReturnType<typeof createCapsuleScene>
    try {
      scene = createCapsuleScene(overlay, {
        getCardQuad: () => latest.current.getCardQuad?.() ?? null,
        // Film grain only goes with the high quality look.
        onQuality: quality => { film.dataset.quality = quality },
      })
    } catch {
      // WebGL2 is unavailable or the context could not be created.
      overlay.replaceChildren()
      latest.current.onFail()
      return
    }
    const { floatG, cap, body, shadow, glow, dolly, fx, ribbons, emitters, halfMaterials } = scene
    let current: gsap.core.Timeline | undefined

    // One shake is 12 half-swings of 0.07 s (0.84 s) and ends level, so it can stop or repeat cleanly.
    const shake = () => gsap.timeline()
      .to(floatG.rotation, { z: 0.07, duration: 0.07, ease: 'sine.inOut', yoyo: true, repeat: 11 }, 0)
      .to(shadow.scale, { x: 0.94, duration: 0.07, ease: 'sine.inOut', yoyo: true, repeat: 11 }, 0)

    // Three blows crack the pill, each jolting it and knocking off shards; then it splits wide toward the camera
    // while light ribbons and sparkles pour out of the gap.
    const open = () => {
      const high = scene.quality() === 'high'
      const glowOpacity = high ? 0.3 : 1
      const glowScale = high ? 2.2 : 3.4
      const timeline = gsap.timeline({ onComplete: () => latest.current.onDone() })
        .addLabel('ready', 0)
        .to(dolly, { offset: -0.7, duration: 1.8, ease: 'power2.inOut' }, 'ready')
        .to(floatG.rotation, { y: 0.22, duration: 2.0, ease: 'sine.inOut' }, 'ready')
      for (const blow of BLOWS) {
        const at = `ready+=${blow.at}`
        timeline
          .to(fx, { crack: blow.crack, duration: 0.09, ease: 'power4.out' }, at)
          .call(() => scene.breakChips(blow.chips, 1.1), [], `ready+=${blow.at + 0.03}`)
          .to(floatG.position, { x: `+=${blow.recoil}`, duration: 0.035, ease: 'power2.out', yoyo: true, repeat: 1 }, at)
          .to(floatG.rotation, { z: `+=${blow.recoil}`, duration: 0.05, ease: 'power2.out', yoyo: true, repeat: 1 }, at)
          .to(emitters, { crackSpark: 90, duration: 0.02 }, at)
          .to(emitters, { crackSpark: 0, duration: 0.18 }, `ready+=${blow.at + 0.05}`)
      }
      return timeline
        .to(floatG.position, { x: 0.012, duration: 0.04, yoyo: true, repeat: 7 }, 'ready+=1.4')
        .addLabel('open', 'ready+=1.75')
        .call(() => { latest.current.onOpen(); scene.breakSeam(28, 1.6) }, [], 'open')
        .to(shadow.material, { opacity: 0, duration: 0.4 }, 'open')
        .to(cap.position, { y: 2.8, z: 1.8, duration: 2.0, ease: 'power3.out' }, 'open')
        .to(body.position, { y: -2.8, z: 1.8, duration: 2.0, ease: 'power3.out' }, 'open')
        .to(cap.rotation, { x: -0.55, duration: 2.0, ease: 'power3.out' }, 'open')
        .to(body.rotation, { x: 0.55, duration: 2.0, ease: 'power3.out' }, 'open')
        .to(glow.material, { opacity: glowOpacity, duration: 0.25 }, 'open')
        .to(glow.scale, { x: glowScale, y: glowScale, duration: 1.3, ease: 'expo.out' }, 'open')
        .to(glow.material, { opacity: glowOpacity * 0.3, duration: 1.0 }, 'open+=0.5')
        .to(glow.material, { opacity: 0, duration: 1.2 }, 'open+=2.4')
        .set(emitters, { burst: 1400 }, 'open')
        .to(emitters, { burst: 160, duration: 0.4 }, 'open+=0.3')
        .to(emitters, { burst: 0, duration: 0.8 }, 'open+=1.6')
        .to(emitters, { ambient: 45, duration: 0.6 }, 'open+=0.4')
        .to(emitters, { ambient: 0, duration: 1.2 }, 'open+=3.4')
        .to(fx, { ribbon: 1.55, duration: 2.8, ease: 'power1.inOut' }, 'open+=0.1')
        .to(ribbons.rotation, { y: 1.5, duration: 4.0, ease: 'power1.out' }, 'open')
        .to(halfMaterials, { opacity: 0, duration: 0.8, ease: 'power1.in' }, 'open+=1.3')
        .to([overlay, film], { opacity: 0, duration: 1.2 }, 'open+=4.3')
    }

    // Keep shaking, one whole cycle at a time, until the record is ready.
    const next = () => { current = latest.current.ready ? open() : shake().eventCallback('onComplete', next) }

    floatG.position.y = 2.4
    floatG.rotation.y = -0.7
    gsap.set([overlay, film], { opacity: 0 })
    current = gsap.timeline({ onComplete: next })
      .to(overlay, { opacity: 1, duration: 0.25 }, 0)
      // The grain's own strength is in CSS; this only fades it in and out with the scene.
      .to(film, { opacity: 0.35, duration: 0.25 }, 0)
      .to(floatG.position, { y: 0, duration: 0.8, ease: 'bounce.out' }, 0)
      .to(floatG.rotation, { y: 0, duration: 1.0, ease: 'power2.out' }, 0)
      .to(shadow.material, { opacity: 0.55, duration: 0.5 }, 0.15)
      .add(shake())

    return () => {
      current?.kill()
      scene.dispose()
    }
  }, [])

  return (
    <>
      <div ref={host} className="capsule-intro" aria-hidden="true" />
      <div ref={grain} className="capsule-intro-grain" aria-hidden="true" />
    </>
  )
}
