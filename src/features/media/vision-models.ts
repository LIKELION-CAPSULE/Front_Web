/**
 * Behavior-detection models that are not deployed with the app (the build drops them from `dist`, see
 * `public/models/manifest.json` `"delivery": "remote"`). Production fetches them from Google's official bucket and
 * accepts them only when the SHA-256 matches the pinned digest; the dev server keeps serving the copies in
 * `public/models`. The face model and the MediaPipe runtime stay self-hosted.
 */
export const REMOTE_VISION_MODELS = {
  gesture: {
    file: 'gesture_recognizer.task',
    source: 'https://storage.googleapis.com/mediapipe-models/gesture_recognizer/gesture_recognizer/float16/1/gesture_recognizer.task',
    sha256: '97952348cf6a6a4915c2ea1496b4b37ebabc50cbbf80571435643c455f2b0482',
  },
  phone: {
    file: 'efficientdet_lite2.tflite',
    source: 'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float16/1/efficientdet_lite2.tflite',
    sha256: '5d4ebec1029bc9907aeadb9e7b4ac9cb1da6a19d01ad375210a9ae18ba173302',
  },
} as const

export type RemoteVisionModel = (typeof REMOTE_VISION_MODELS)[keyof typeof REMOTE_VISION_MODELS]

async function sha256Hex(bytes: ArrayBuffer) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

/** Downloads a model from its official source; throws when the download fails or the digest differs. */
export async function fetchVerifiedModel(model: RemoteVisionModel, fetcher: typeof fetch = fetch) {
  // No credentials or referrer leave the app for a public file.
  const response = await fetcher(model.source, { credentials: 'omit', referrerPolicy: 'no-referrer' })
  if (!response.ok) throw new Error(`MODEL_DOWNLOAD_${response.status}`)
  const bytes = await response.arrayBuffer()
  if ((await sha256Hex(bytes)) !== model.sha256) throw new Error('MODEL_DIGEST_MISMATCH')
  return new Uint8Array(bytes)
}
