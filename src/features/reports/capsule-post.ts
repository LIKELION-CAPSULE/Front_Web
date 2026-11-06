import { HalfFloatType, NoBlending, Vector2, WebGLRenderTarget } from 'three'
import type { Camera, Scene, WebGLRenderer } from 'three'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { TexturePass } from 'three/addons/postprocessing/TexturePass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'

const BLOOM_THRESHOLD = 2.5

/**
 * UnrealBloomPass writes alpha 1 everywhere, which would make the canvas opaque over the card. Keep the scene's own
 * alpha and add only as much as the glow the bloom spread around it.
 */
const RestoreAlphaShader = {
  uniforms: { tDiffuse: { value: null }, tScene: { value: null } },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform sampler2D tScene;
    varying vec2 vUv;
    void main() {
      vec4 bloom = texture2D(tDiffuse, vUv);
      vec4 scene = texture2D(tScene, vUv);
      vec3 glow = max(bloom.rgb - scene.rgb, 0.0);
      float a = clamp(scene.a + max(glow.r, max(glow.g, glow.b)) * 0.8, 0.0, 1.0);
      gl_FragColor = vec4(bloom.rgb, a);
    }
  `,
}

/**
 * High quality rendering: the scene goes to a multisampled half-float target with a transparent background, then
 * bloom, alpha restore and the usual tone mapping / color space output.
 */
export function createPost(renderer: WebGLRenderer) {
  const sceneTarget = new WebGLRenderTarget(1, 1, { type: HalfFloatType, samples: 4 })
  const composer = new EffectComposer(renderer)
  const base = new TexturePass(sceneTarget.texture)
  base.material.blending = NoBlending
  base.clear = true
  // Bloom reads linear light before tone mapping, where the lit pill is well above 1. The threshold sits above the
  // pill's body so only its highlights and the HDR ribbons and sparkles bloom; at 0.86 the whole pill glowed and
  // the cracks washed out.
  const bloom = new UnrealBloomPass(new Vector2(1, 1), 0.45, 0.22, BLOOM_THRESHOLD)
  const restore = new ShaderPass(RestoreAlphaShader)
  // ShaderPass clones its uniforms and drops texture values, so the scene texture is set after construction.
  restore.uniforms.tScene!.value = sceneTarget.texture
  const output = new OutputPass()
  composer.addPass(base)
  composer.addPass(bloom)
  composer.addPass(restore)
  composer.addPass(output)

  function setSize(width: number, height: number, pixelRatio: number) {
    sceneTarget.setSize(Math.round(width * pixelRatio), Math.round(height * pixelRatio))
    composer.setPixelRatio(pixelRatio)
    composer.setSize(width, height)
  }

  function render(scene: Scene, camera: Camera) {
    renderer.setRenderTarget(sceneTarget)
    renderer.setClearColor(0x000000, 0)
    renderer.clear()
    renderer.render(scene, camera)
    renderer.setRenderTarget(null)
    composer.render()
  }

  /** Compiles the scene's shaders for the render target, whose variants differ from the screen's. */
  function precompile(scene: Scene, camera: Camera) {
    renderer.setRenderTarget(sceneTarget)
    const done = renderer.compileAsync(scene, camera)
    renderer.setRenderTarget(null)
    return done
  }

  function dispose() {
    sceneTarget.dispose()
    base.dispose()
    bloom.dispose()
    restore.dispose()
    output.dispose()
    composer.dispose()
  }

  return { setSize, render, precompile, dispose }
}
