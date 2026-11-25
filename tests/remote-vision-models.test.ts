import test from 'node:test'
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { remoteModelFiles } from '../server/remote-vision-models.ts'
import { fetchVerifiedModel, REMOTE_VISION_MODELS } from '../src/features/media/vision-models.ts'

type ManifestModel = { file: string; source: string; sha256: string; delivery: string }
const manifest = JSON.parse(readFileSync(new URL('../public/models/manifest.json', import.meta.url), 'utf8')) as { models: ManifestModel[] }

test('the build drops only the behavior-detection models; the face model stays self-hosted', () => {
  assert.deepEqual(remoteModelFiles().sort(), ['efficientdet_lite2.tflite', 'gesture_recognizer.task'])
  assert.equal(manifest.models.find((model) => model.file === 'face_landmarker.task')?.delivery, 'self-hosted')
})

test('the worker downloads each remote model from the manifest source and checks the manifest digest', () => {
  const remote = manifest.models.filter((model) => model.delivery === 'remote')
  assert.equal(Object.keys(REMOTE_VISION_MODELS).length, remote.length)
  for (const model of Object.values(REMOTE_VISION_MODELS)) {
    const entry = remote.find((item) => item.file === model.file)
    assert.ok(entry, model.file)
    assert.equal(model.source, entry.source)
    assert.equal(model.sha256, entry.sha256)
    assert.match(model.source, /^https:\/\/storage\.googleapis\.com\/mediapipe-models\//)
  }
})

const bytes = new TextEncoder().encode('model bytes')
const model = { ...REMOTE_VISION_MODELS.gesture, sha256: createHash('sha256').update(bytes).digest('hex') } as unknown as typeof REMOTE_VISION_MODELS.gesture
const serve = (body: Uint8Array, status = 200) => (async (url: string | URL | Request, init?: RequestInit) => {
  assert.equal(String(url), model.source)
  assert.equal(init?.credentials, 'omit')
  return new Response(body, { status })
}) as typeof fetch

test('a download with the pinned digest is accepted', async () => {
  assert.deepEqual(await fetchVerifiedModel(model, serve(bytes)), bytes)
})

test('a changed file or a failed download is rejected, so the task fails quietly', async () => {
  await assert.rejects(fetchVerifiedModel(model, serve(new TextEncoder().encode('other bytes'))), /MODEL_DIGEST_MISMATCH/)
  await assert.rejects(fetchVerifiedModel(model, serve(bytes, 404)), /MODEL_DOWNLOAD_404/)
})
