import { memo, useState, useSyncExternalStore } from 'react'
import HalftoneReveal from './HalftoneReveal'
import './halftone.css'

const EFFECT_MEDIA =
  '(min-width: 768px) and (hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)'

function subscribe(onChange: () => void) {
  const media = window.matchMedia(EFFECT_MEDIA)
  media.addEventListener('change', onChange)
  return () => media.removeEventListener('change', onChange)
}

function getSnapshot() {
  return window.matchMedia(EFFECT_MEDIA).matches
}

function ActiveBackground({ src }: { src: string }) {
  const [ready, setReady] = useState(false)
  return (
    <div className="scene-background halftone-background" data-ready={ready} aria-hidden="true">
      <HalftoneReveal
        src={src}
        fit="cover"
        mode="mono"
        shape="dot"
        reverse
        intro={false}
        wander={false}
        clickBurst={false}
        cellSize={4.5}
        angle={45}
        dotScale={0.95}
        inkColor="#c8b4ed"
        paperColor="#171925"
        contrast={1.06}
        revealRadius={120}
        softness={0.72}
        linger={0.38}
        onReady={setReady}
      />
    </div>
  )
}

/** The original image stays underneath as the loading, touch and reduced-motion fallback. */
export const HalftoneBackground = memo(function HalftoneBackground({ src }: { src: string }) {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, () => false)
  return enabled ? <ActiveBackground key={src} src={src} /> : null
})
