import { useEffect, useRef, useSyncExternalStore } from 'react'
import type { CameraBackground } from './camera-backgrounds'
import { useMedia } from './media-context'

const BACKGROUND_BLUR = 'blur(12px)'
const MASK_FEATHER = 'blur(2.5px)'
const images = new Map<string, Promise<HTMLImageElement>>()

function loadImage(src: string) {
  let image = images.get(src)
  if (!image) {
    const element = new Image()
    element.src = src
    image = element.decode().then(() => element)
    image.catch(() => images.delete(src))
    images.set(src, image)
  }
  return image
}

function drawCover(context: CanvasRenderingContext2D, image: HTMLImageElement, width: number, height: number) {
  const scale = Math.max(width / image.naturalWidth, height / image.naturalHeight)
  const drawWidth = image.naturalWidth * scale, drawHeight = image.naturalHeight * scale
  context.drawImage(image, (width - drawWidth) / 2, (height - drawHeight) / 2, drawWidth, drawHeight)
}

/** Background first, then the person cut out with a feathered mask on top. */
function composite(
  output: CanvasRenderingContext2D,
  person: CanvasRenderingContext2D,
  frame: ImageBitmap,
  mask: ImageBitmap,
  image: HTMLImageElement | null,
) {
  const { width, height } = frame
  for (const canvas of [output.canvas, person.canvas]) {
    if (canvas.width !== width || canvas.height !== height) Object.assign(canvas, { width, height })
  }
  if (image) drawCover(output, image, width, height)
  else {
    // The sharp frame underneath keeps the blurred layer's soft borders from fading to transparent.
    output.drawImage(frame, 0, 0)
    output.filter = BACKGROUND_BLUR
    output.drawImage(frame, 0, 0)
    output.filter = 'none'
  }
  person.globalCompositeOperation = 'copy'
  person.filter = MASK_FEATHER
  person.drawImage(mask, 0, 0, width, height)
  person.filter = 'none'
  person.globalCompositeOperation = 'source-in'
  person.drawImage(frame, 0, 0)
  person.globalCompositeOperation = 'source-over'
  output.drawImage(person.canvas, 0, 0)
}

/**
 * Composites the camera stream onto a canvas for any background other than 'none'.
 * The <video> stays mounted underneath, so the plain camera shows until the first composited frame
 * and whenever segmentation is unavailable. The shared stream's tracks are never stopped here.
 */
export function useVirtualBackground(stream: MediaStream | null, background: CameraBackground) {
  const { segmentation } = useMedia()
  const status = useSyncExternalStore(segmentation.subscribe, segmentation.getStatus)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const enabled = !!stream && background.kind !== 'none'

  useEffect(() => {
    if (enabled) segmentation.ensure()
  }, [enabled, segmentation])

  useEffect(() => {
    const video = videoRef.current, canvas = canvasRef.current
    const output = canvas?.getContext('2d')
    const person = document.createElement('canvas').getContext('2d')
    if (!enabled || status !== 'ready' || !video || !output || !person) return
    let active = true, busy = false, handle = 0
    let image: HTMLImageElement | null = null
    if (background.kind === 'image') void loadImage(background.src).then((loaded) => { image = loaded }, () => { /* Keep showing the plain camera. */ })
    const frameCallback = 'requestVideoFrameCallback' in video
    const schedule = () => {
      handle = frameCallback ? video.requestVideoFrameCallback(tick) : requestAnimationFrame(tick)
    }
    function tick() {
      if (!active) return
      schedule()
      if (busy || video!.readyState < 2 || (background.kind === 'image' && !image)) return
      busy = true
      void createImageBitmap(video!)
        .then((frame) => segmentation.segment(frame))
        .then((result) => {
          if (!result) return
          if (active) composite(output!, person!, result.frame, result.mask, image)
          result.frame.close()
          result.mask.close()
        })
        .catch(() => { /* A dropped frame is retried on the next video frame. */ })
        .finally(() => { busy = false })
    }
    schedule()
    return () => {
      active = false
      if (frameCallback) video.cancelVideoFrameCallback(handle)
      else cancelAnimationFrame(handle)
    }
  }, [enabled, status, background, segmentation, stream])

  return { videoRef, canvasRef, enabled, loading: enabled && status === 'loading' }
}
