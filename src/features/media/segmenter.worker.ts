/// <reference lib="webworker" />
import { FilesetResolver, ImageSegmenter } from '@mediapipe/tasks-vision'
import type { SegmenterMessage, SegmenterRequest } from './types'

const scope = self as unknown as DedicatedWorkerGlobalScope
let segmenter: ImageSegmenter | undefined
let lastAt = 0
function send(message: SegmenterMessage, transfer: Transferable[] = []) { scope.postMessage(message, transfer) }

async function initialize(baseUrl: string) {
  const files = await FilesetResolver.forVisionTasks(`${baseUrl}runtime/mediapipe`, true)
  const options = {
    runningMode: 'VIDEO' as const, outputConfidenceMasks: true, outputCategoryMask: false,
    // MediaPipe's image upload needs WebGL even when TFLite inference uses CPU.
    canvas: new OffscreenCanvas(640, 480),
  }
  const modelAssetPath = `${baseUrl}models/selfie_segmenter.tflite`
  try {
    segmenter = await ImageSegmenter.createFromOptions(files, { ...options, baseOptions: { modelAssetPath, delegate: 'GPU' } })
  } catch {
    // Same as vision.worker.ts: a failed GPU graph consumed the loader's global factory, so reload it under a distinct URL.
    segmenter = await ImageSegmenter.createFromOptions({ ...files, wasmLoaderPath: `${files.wasmLoaderPath}?delegate=cpu` }, {
      ...options, baseOptions: { modelAssetPath, delegate: 'CPU' },
    })
  }
  send({ type: 'status', value: 'ready' })
}

async function segment(id: number, frame: ImageBitmap) {
  let mask: ImageBitmap | null = null
  if (segmenter) {
    // VIDEO mode rejects timestamps that do not increase.
    lastAt = Math.max(lastAt + 1, performance.now())
    const result = segmenter.segmentForVideo(frame, lastAt)
    try {
      // selfie_segmenter has a single output: the probability that each pixel is the person.
      const confidence = result.confidenceMasks?.[0]
      if (confidence) {
        const values = confidence.getAsFloat32Array()
        const pixels = new Uint8ClampedArray(values.length * 4)
        for (let index = 0; index < values.length; index++) pixels[index * 4 + 3] = values[index]! * 255
        mask = await createImageBitmap(new ImageData(pixels, confidence.width, confidence.height))
      }
    } finally { result.close() }
  }
  send({ type: 'result', id, frame, mask }, mask ? [frame, mask] : [frame])
}

scope.onmessage = (event: MessageEvent<SegmenterRequest>) => {
  const message = event.data
  if (message.type === 'close') {
    segmenter?.close()
    segmenter = undefined
    scope.close()
    return
  }
  const task = message.type === 'init' ? initialize(message.baseUrl) : segment(message.id, message.frame)
  void task.catch((error: unknown) => {
    console.error('Camera background segmentation failed', error)
    send({ type: 'status', value: 'error' })
  })
}
