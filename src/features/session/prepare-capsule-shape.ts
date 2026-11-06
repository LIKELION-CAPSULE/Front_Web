import { createCapsuleHalves } from '../reports/capsule-shell.ts'
import { FrontSide } from 'three'
import type { Material } from 'three'

/** Reserve the front half of the depth buffer for the exterior, preserving shell-to-shell depth.
 * Cavity walls keep physical depth so particles can enter the opening and disappear inside it.
 * Install after engraving, which also customizes the exterior shader.
 */
export function keepPrepareCapsuleInFront(...materials: Material[]) {
  for (const material of materials) {
    const compile = material.onBeforeCompile
    const key = material.customProgramCacheKey()
    material.onBeforeCompile = (shader, renderer) => {
      compile.call(material, shader, renderer)
      shader.fragmentShader = shader.fragmentShader.replace('#include <dithering_fragment>',
        '#include <dithering_fragment>\ngl_FragDepth = gl_FragCoord.z * 0.5;')
    }
    material.customProgramCacheKey = () => `${key}-prepare-foreground-v1`
    material.needsUpdate = true
  }
}

/** The card's actual shell geometry, with opaque cavity walls for incoming particle occlusion. */
export function createPrepareCapsuleHalves(bodyColor: string, capColor: string) {
  const halves = createCapsuleHalves(bodyColor, capColor)
  // Opaque depth-writing walls occlude incoming circles, instead of blending over their whole mesh.
  for (const half of [halves.body, halves.cap]) {
    half.outer.side = FrontSide
    half.materials.forEach(material => { material.transparent = false; material.depthWrite = true })
    const inner = half.materials[1]!
    inner.color.multiplyScalar(.45)
    inner.envMapIntensity = .18
  }
  return halves
}
