import { copyFile, mkdir, rm } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
await mkdir(new URL('public/runtime/mediapipe/', root), { recursive: true })
await rm(new URL('public/runtime/ort/', root), { recursive: true, force: true })
for (const extension of ['js', 'wasm']) await copyFile(
  new URL(`node_modules/@mediapipe/tasks-vision/wasm/vision_wasm_module_internal.${extension}`, root),
  new URL(`public/runtime/mediapipe/vision_wasm_module_internal.${extension}`, root),
)
console.log(`Prepared local vision runtimes in ${fileURLToPath(new URL('public/runtime/', root))}`)
