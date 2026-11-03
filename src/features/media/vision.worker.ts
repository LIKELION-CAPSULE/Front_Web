/// <reference lib="webworker" />
import { FaceLandmarker, FilesetResolver, GestureRecognizer, ObjectDetector } from '@mediapipe/tasks-vision'
import { PHONE_DETECTOR_SCORE } from './behavior-constants'
import { yawFromMatrix, type FaceSignal, type HandSignal } from './behavior-rules'
import type { FrameResult, VisionMessage, VisionRequest, VisionTask } from './types'

type Fileset = Awaited<ReturnType<typeof FilesetResolver.forVisionTasks>>
type StudyTask = Exclude<VisionTask, 'face'>

const scope = self as unknown as DedicatedWorkerGlobalScope
let files: Fileset | undefined
let modelsUrl = ''
let face: FaceLandmarker | undefined
let gesture: GestureRecognizer | null | undefined
let phone: ObjectDetector | null | undefined
const loading = new Set<StudyTask>()
// The runtime hands each task its module through one global, so task loads must not overlap.
let loadQueue = Promise.resolve()
// Each MediaPipe graph needs strictly increasing timestamps of its own.
const clock: Record<VisionTask, number> = { face: -1, gesture: -1, phone: -1 }
let busy = false
function send(message: VisionMessage) { scope.postMessage(message) }
function timestamp(task: VisionTask, at: number) { return (clock[task] = Math.max(clock[task] + 1, at)) }

/** Tries the GPU first; a failed GPU graph has consumed the module factory, so the CPU retry needs a distinct module URL. */
async function create<T>(task: VisionTask, build: (fileset: Fileset, delegate: 'GPU' | 'CPU') => Promise<T>) {
  // Every task after the first needs its own module URL too, because ES modules execute only once.
  const loader = task === 'face' ? files!.wasmLoaderPath : `${files!.wasmLoaderPath}?task=${task}`
  try {
    return { model: await build({ ...files!, wasmLoaderPath: loader }, 'GPU'), backend: 'GPU' as const }
  } catch {
    const cpu = `${loader}${loader.includes('?') ? '&' : '?'}delegate=cpu`
    return { model: await build({ ...files!, wasmLoaderPath: cpu }, 'CPU'), backend: 'CPU' as const }
  }
}

async function initialize(baseUrl: string) {
  send({ type: 'status', value: { status: 'loading' } })
  files = await FilesetResolver.forVisionTasks(`${baseUrl}runtime/mediapipe`, true)
  modelsUrl = `${baseUrl}models/`
  // MediaPipe's image upload needs WebGL even when TFLite inference uses CPU.
  const probe = new OffscreenCanvas(1, 1)
  const graphics = probe.getContext('webgl2') ?? probe.getContext('webgl')
  if (!graphics) throw new Error('WEBGL_REQUIRED')
  graphics.getExtension('WEBGL_lose_context')?.loseContext()
  const created = await create('face', (fileset, delegate) => FaceLandmarker.createFromOptions(fileset, {
    runningMode: 'VIDEO', numFaces: 1, canvas: new OffscreenCanvas(640, 480),
    outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
    baseOptions: { modelAssetPath: `${modelsUrl}face_landmarker.task`, delegate },
  }))
  face = created.model
  send({ type: 'status', value: { status: 'ready', faceBackend: created.backend } })
}

/** Gesture and phone models load the first time a study frame asks for them, one at a time. */
function load(task: StudyTask) {
  if (loading.has(task)) return
  loading.add(task)
  loadQueue = loadQueue.then(async () => {
    try {
      if (task === 'gesture') {
        gesture = (await create(task, (fileset, delegate) => GestureRecognizer.createFromOptions(fileset, {
          runningMode: 'VIDEO', numHands: 1, canvas: new OffscreenCanvas(640, 480),
          baseOptions: { modelAssetPath: `${modelsUrl}gesture_recognizer.task`, delegate },
        }))).model
      } else {
        phone = (await create(task, (fileset, delegate) => ObjectDetector.createFromOptions(fileset, {
          runningMode: 'VIDEO', maxResults: 1, scoreThreshold: PHONE_DETECTOR_SCORE,
          categoryAllowlist: ['cell phone'], canvas: new OffscreenCanvas(640, 480),
          baseOptions: { modelAssetPath: `${modelsUrl}efficientdet_lite2.tflite`, delegate },
        }))).model
      }
    } catch (error) {
      console.error(`Local ${task} model failed`, error)
      if (task === 'gesture') gesture = null
      else phone = null
      send({ type: 'task-error', task })
    }
  })
}

function readFace(frame: ImageBitmap, at: number): FrameResult['face'] {
  const result = face!.detectForVideo(frame, timestamp('face', at))
  const landmarks = result.faceLandmarks[0]
  if (!landmarks?.length) return { faceCount: 0, faceBox: null, signal: { present: false } }
  const xs = landmarks.map((point) => point.x), ys = landmarks.map((point) => point.y)
  const x = Math.max(0, Math.min(...xs)), y = Math.max(0, Math.min(...ys))
  const scores = new Map(result.faceBlendshapes[0]?.categories.map((category) => [category.categoryName, category.score]))
  const signal: FaceSignal = {
    present: true,
    eyeBlinkLeft: scores.get('eyeBlinkLeft') ?? 0,
    eyeBlinkRight: scores.get('eyeBlinkRight') ?? 0,
    jawOpen: scores.get('jawOpen') ?? 0,
    yaw: yawFromMatrix(result.facialTransformationMatrixes[0]?.data ?? []),
  }
  return {
    faceCount: result.faceLandmarks.length,
    faceBox: { x, y, width: Math.min(1, Math.max(...xs)) - x, height: Math.min(1, Math.max(...ys)) - y },
    signal,
  }
}

function readHand(frame: ImageBitmap, at: number): HandSignal {
  const result = gesture!.recognizeForVideo(frame, timestamp('gesture', at))
  const landmarks = result.landmarks[0]
  const wrist = landmarks?.[0], palm = landmarks?.[9]
  if (!wrist || !palm) return null
  // Pixels keep the hand-size ratio independent of the frame's aspect ratio.
  return {
    gesture: result.gestures[0]?.[0]?.categoryName ?? 'None',
    wrist: { x: wrist.x * frame.width, y: wrist.y * frame.height },
    palm: { x: palm.x * frame.width, y: palm.y * frame.height },
  }
}

function readPhone(frame: ImageBitmap, at: number) {
  const result = phone!.detectForVideo(frame, timestamp('phone', at))
  return Math.max(0, ...result.detections.flatMap((detection) => detection.categories.map((category) => category.score)))
}

async function analyze(frame: ImageBitmap, at: number, tasks: readonly VisionTask[]) {
  if (!face || busy) { frame.close(); return }
  busy = true
  try {
    const value: FrameResult = { at }
    if (tasks.includes('face')) value.face = readFace(frame, at)
    if (tasks.includes('gesture')) {
      if (gesture) value.hand = readHand(frame, at)
      else if (gesture === undefined) load('gesture')
    }
    if (tasks.includes('phone')) {
      if (phone) value.phoneScore = readPhone(frame, at)
      else if (phone === undefined) load('phone')
    }
    send({ type: 'result', value })
  } finally { frame.close(); busy = false }
}

scope.onmessage = (event: MessageEvent<VisionRequest>) => {
  const message = event.data
  const task = message.type === 'init' ? initialize(message.baseUrl) : analyze(message.frame, message.at, message.tasks)
  void task.catch((error: unknown) => {
    console.error('Local vision failed', error)
    const message = error instanceof Error && error.message === 'WEBGL_REQUIRED'
      ? '얼굴 감지에 필요한 WebGL을 사용할 수 없어요. 다른 브라우저에서 다시 확인해 주세요.'
      : '감지를 시작하지 못했어요. 다시 시도해 주세요.'
    send({ type: 'status', value: { status: 'error', error: message } })
  })
}
