/// <reference lib="webworker" />
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import type { Observation, VisionMessage, VisionRequest, VisionStatus } from './types'

const scope = self as unknown as DedicatedWorkerGlobalScope
let face: FaceLandmarker | undefined
let busy = false
function send(message: VisionMessage) { scope.postMessage(message) }

async function initialize(baseUrl: string) {
  send({ type: 'status', value: { status: 'loading' } })
  const files = await FilesetResolver.forVisionTasks(`${baseUrl}runtime/mediapipe`, true)
  // MediaPipe's image upload needs WebGL even when TFLite inference uses CPU.
  const probe = new OffscreenCanvas(1, 1)
  const graphics = probe.getContext('webgl2') ?? probe.getContext('webgl')
  if (!graphics) throw new Error('WEBGL_REQUIRED')
  graphics.getExtension('WEBGL_lose_context')?.loseContext()
  let faceBackend: VisionStatus['faceBackend'] = 'GPU'
  const options = {
    runningMode: 'VIDEO' as const, numFaces: 1,
    canvas: new OffscreenCanvas(640, 480),
  }
  try {
    face = await FaceLandmarker.createFromOptions(files, {
      ...options, baseOptions: { modelAssetPath: `${baseUrl}models/face_landmarker.task`, delegate: 'GPU' },
    })
  } catch {
    faceBackend = 'CPU'
    // A failed GPU graph has already consumed the module loader's global
    // factory. A distinct module URL restores it for the CPU initialization.
    face = await FaceLandmarker.createFromOptions({ ...files, wasmLoaderPath: `${files.wasmLoaderPath}?delegate=cpu` }, {
      ...options, baseOptions: { modelAssetPath: `${baseUrl}models/face_landmarker.task`, delegate: 'CPU' },
    })
  }
  send({ type: 'status', value: { status: 'ready', faceBackend } })
}

async function analyze(frame: ImageBitmap, at: number) {
  if (!face || busy) { frame.close(); return }
  busy = true
  try {
    const result = face.detectForVideo(frame, at)
    const landmarks = result.faceLandmarks[0]
    let faceBox: Observation['faceBox'] = null
    if (landmarks?.length) {
      const xs = landmarks.map((point) => point.x), ys = landmarks.map((point) => point.y)
      const x = Math.max(0, Math.min(...xs)), y = Math.max(0, Math.min(...ys))
      faceBox = { x, y, width: Math.min(1, Math.max(...xs)) - x, height: Math.min(1, Math.max(...ys)) - y }
    }
    send({ type: 'result', value: { at, faceCount: result.faceLandmarks.length, faceBox } })
  } finally { frame.close(); busy = false }
}

scope.onmessage = (event: MessageEvent<VisionRequest>) => {
  const message = event.data
  const task = message.type === 'init' ? initialize(message.baseUrl) : analyze(message.frame, message.at)
  void task.catch((error: unknown) => {
    console.error('Local vision failed', error)
    const message = error instanceof Error && error.message === 'WEBGL_REQUIRED'
      ? '얼굴 감지에 필요한 WebGL을 사용할 수 없어요. 다른 브라우저에서 다시 확인해 주세요.'
      : '감지를 시작하지 못했어요. 다시 시도해 주세요.'
    send({ type: 'status', value: { status: 'error', error: message } })
  })
}
