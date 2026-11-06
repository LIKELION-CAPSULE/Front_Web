import { BackSide, Color, DoubleSide, Group, LatheGeometry, Mesh, MeshPhysicalMaterial, MeshStandardMaterial, TorusGeometry, Vector2 } from 'three'

export const CAPSULE_RADIUS = 0.34
export const CAPSULE_CAP_RADIUS = CAPSULE_RADIUS * 1.04
export const CAPSULE_SEAM_Y = -0.12

function profile(radius: number, center: number, rim: number, cap: boolean) {
  const arc = Array.from({ length: 33 }, (_, step) => {
    const angle = step / 32 * Math.PI / 2
    return cap
      ? new Vector2(radius * Math.cos(angle), center + radius * Math.sin(angle))
      : new Vector2(radius * Math.sin(angle), center - radius * Math.cos(angle))
  })
  return cap ? [new Vector2(radius, rim), ...arc] : [...arc, new Vector2(radius, rim)]
}

/** The same two-tone shell is used to put a plan away and to reveal its finished card. */
export function createCapsuleShell(hex: string, radius: number, center: number, rim: number, cap: boolean) {
  const color = new Color(hex)
  const outer = new MeshPhysicalMaterial({
    color, roughness: 0.2, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03,
    sheen: 0.35, sheenRoughness: 0.5, sheenColor: color.clone().lerp(new Color('#ffffff'), 0.65),
    iridescence: 0.3, iridescenceIOR: 1.3, iridescenceThicknessMinimum: 200, iridescenceThicknessMaximum: 520,
    envMapIntensity: 1.25, side: DoubleSide, transparent: true,
  })
  const inner = new MeshStandardMaterial({ color: color.clone().multiplyScalar(0.3), roughness: 0.7, side: BackSide, transparent: true })
  const group = new Group()
  const lip = new Mesh(new TorusGeometry(radius * 0.983, radius * 0.022, 16, 96), outer)
  lip.rotation.x = Math.PI / 2
  lip.position.y = rim
  group.add(
    new Mesh(new LatheGeometry(profile(radius, center, rim, cap), 96), outer),
    new Mesh(new LatheGeometry(profile(radius * 0.965, center, rim, cap), 96), inner),
    lip,
  )
  return { group, outer, materials: [outer, inner], radius, color, direction: (cap ? 1 : -1) as 1 | -1 }
}
