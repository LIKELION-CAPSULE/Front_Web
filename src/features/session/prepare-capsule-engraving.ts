import { CanvasTexture, Mesh, RepeatWrapping, ShaderChunk, SRGBColorSpace } from 'three'
import type { createCapsuleShell } from '../reports/capsule-shell'
import type { CapsuleInscription } from './prepare-capsule-personalization'
import { PREPARE_SHAPE } from './prepare-capsule-motion'

type Shell = ReturnType<typeof createCapsuleShell>
const SIZE = 1024

/** Real material color and bump maps, so the text follows the shell and responds to its moving light. */
export function engravePrepareCapsule(body: Shell, cap: Shell, inscription: CapsuleInscription) {
  const strength = { value: 0 }
  const textures: CanvasTexture[] = []
  const font = getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim() || 'sans-serif'

  function engrave(shell: Shell, minY: number, maxY: number, labelY: number, labelWidth: number, capSide = false) {
    const mesh = shell.group.children[0] as Mesh
    const uv = mesh.geometry.attributes.uv!, position = mesh.geometry.attributes.position!
    // Lathe UVs spend almost all their height on the rounded end. Use physical height for legible letters.
    for (let index = 0; index < position.count; index++) uv.setY(index, (position.getY(index) - minY) / (maxY - minY))
    uv.needsUpdate = true
    const lip = shell.group.children[2] as Mesh
    const lipMaterial = shell.outer.clone()
    lip.material = lipMaterial
    shell.materials.push(lipMaterial)

    const mask = document.createElement('canvas')
    mask.width = mask.height = SIZE
    const ctx = mask.getContext('2d')!
    // The pill's local +Y becomes screen-right when it lies down. Compensate the curved UV's aspect ratio.
    ctx.translate(SIZE / 2, SIZE * (1 - (labelY - minY) / (maxY - minY)))
    ctx.rotate(-Math.PI / 2)
    ctx.scale(1, (maxY - minY) / (2 * Math.PI * shell.radius))
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillStyle = '#fff'
    const maxWidth = labelWidth / (maxY - minY) * SIZE
    function line(text: string, y: number, size: number, weight: number) {
      ctx.font = `${weight} ${size}px ${font}`
      const fitted = Math.min(size, size * maxWidth / Math.max(1, ctx.measureText(text).width))
      ctx.font = `${weight} ${fitted}px ${font}`
      ctx.fillText(text, 0, y)
    }
    if (capSide) line(inscription.date, 0, 72, 600)
    else { line(inscription.nickname, 8, 76, 600); line(inscription.detail, 85, 48, 500) }
    // Treat emoji and other multicolored glyphs as a cut-out silhouette, too.
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, SIZE, SIZE)
    function texture(alpha: number, color: boolean) {
      const canvas = document.createElement('canvas')
      canvas.width = canvas.height = SIZE
      const paint = canvas.getContext('2d')!
      paint.fillStyle = '#fff'; paint.fillRect(0, 0, SIZE, SIZE)
      paint.globalAlpha = alpha; paint.drawImage(mask, 0, 0)
      const map = new CanvasTexture(canvas)
      if (color) map.colorSpace = SRGBColorSpace
      map.wrapS = RepeatWrapping; map.offset.x = .5
      textures.push(map)
      return map
    }
    shell.outer.map = texture(capSide ? .68 : .66, true)
    shell.outer.bumpMap = texture(.88, false)
    shell.outer.bumpScale = 0
    shell.outer.onBeforeCompile = shader => {
      shader.uniforms.uCapsuleEngraving = strength
      const mapFragment = ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;',
        'diffuseColor *= vec4( mix( vec3( 1.0 ), sampledDiffuseColor.rgb, uCapsuleEngraving ), sampledDiffuseColor.a );')
      shader.fragmentShader = 'uniform float uCapsuleEngraving;\n' + shader.fragmentShader.replace('#include <map_fragment>', mapFragment)
    }
    shell.outer.customProgramCacheKey = () => 'prepare-capsule-engraving-v1'
    shell.outer.needsUpdate = true
  }
  engrave(body, PREPARE_SHAPE.minY, PREPARE_SHAPE.bodyRim, (PREPARE_SHAPE.minY + PREPARE_SHAPE.capRim) / 2, .64)
  engrave(cap, PREPARE_SHAPE.capRim, PREPARE_SHAPE.maxY, (PREPARE_SHAPE.capRim + PREPARE_SHAPE.maxY) / 2, .72, true)
  return {
    update(amount: number) {
      strength.value = amount
      body.outer.bumpScale = cap.outer.bumpScale = .004 * amount
      body.outer.clearcoat = cap.outer.clearcoat = 1 - .55 * amount
      body.outer.clearcoatRoughness = cap.outer.clearcoatRoughness = .03 + .1 * amount
    },
    dispose() { textures.forEach(texture => texture.dispose()) },
  }
}
