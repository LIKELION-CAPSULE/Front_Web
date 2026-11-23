import capsuleSymbolUrl from '@/assets/brand/capsule-symbol.svg'
import manifestData from '@/assets/login-assemble/chaerin/manifest.json'
import { parsePolySvg, type ParsedPolyMesh } from './poly-mesh'

export interface AssembleLayerSpec {
  id: string
  label: string
  z: number
  image: string
  url: string
  x: number
  y: number
  width: number
  height: number
  poly: ParsedPolyMesh
}

export type RigJointId =
  | 'head'
  | 'neck'
  | 'chest'
  | 'hip'
  | 'shoulderL'
  | 'shoulderR'
  | 'elbowL'
  | 'elbowR'
  | 'wristL'
  | 'wristR'

export interface AssembleRigSpec {
  joints: Record<RigJointId, readonly [number, number]>
  bones: readonly (readonly [RigJointId, RigJointId])[]
}

export interface AssembleManifest {
  frame: { width: number; height: number; scale: number }
  layers: readonly AssembleLayerSpec[]
  full: {
    image: string
    url: string
    x: number
    y: number
    width: number
    height: number
  }
  rig: AssembleRigSpec
}

const chaerinWebpModules = import.meta.glob('/src/assets/login-assemble/chaerin/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

const chaerinPolyModules = import.meta.glob('/src/assets/login-assemble/chaerin/*.poly.svg', {
  eager: true,
  import: 'default',
  query: '?raw',
}) as Record<string, string>

function resolveChaerinWebp(filename: string): string {
  const suffix = `/chaerin/${filename}`
  const match = Object.entries(chaerinWebpModules).find(([path]) => path.endsWith(suffix))
  return match ? match[1] : ''
}

function resolveChaerinPoly(filename: string): ParsedPolyMesh {
  const suffix = `/chaerin/${filename}`
  const match = Object.entries(chaerinPolyModules).find(([path]) => path.endsWith(suffix))
  return parsePolySvg(match ? match[1] : '')
}

const rawRig = manifestData.rig
const rigJoints = rawRig.joints as unknown as Record<RigJointId, readonly [number, number]>
const rigBones = rawRig.bones as unknown as readonly (readonly [RigJointId, RigJointId])[]

export const CHAERIN_ASSEMBLE_MANIFEST: AssembleManifest = {
  frame: {
    width: manifestData.frame.width,
    height: manifestData.frame.height,
    scale: manifestData.frame.scale,
  },
  layers: manifestData.layers
    .slice()
    .sort((a, b) => a.z - b.z)
    .map((layer) => ({
      id: layer.id,
      label: layer.label,
      z: layer.z,
      image: layer.image,
      url: resolveChaerinWebp(layer.image),
      x: layer.x,
      y: layer.y,
      width: layer.width,
      height: layer.height,
      poly: resolveChaerinPoly(layer.poly.image),
    })),
  full: {
    image: manifestData.full.image,
    url: resolveChaerinWebp(manifestData.full.image),
    x: manifestData.full.x,
    y: manifestData.full.y,
    width: manifestData.full.width,
    height: manifestData.full.height,
  },
  rig: {
    joints: rigJoints,
    bones: rigBones,
  },
}

export const ASSEMBLE_APP_ICON_URL: string = capsuleSymbolUrl
