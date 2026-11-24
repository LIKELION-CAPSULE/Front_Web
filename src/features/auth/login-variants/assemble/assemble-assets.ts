import { capsuleLogo } from '@/shared/design/brand-logo'
import manifestData from '@/assets/login-assemble/chaerin/manifest.json'

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
}

const chaerinWebpModules = import.meta.glob('/src/assets/login-assemble/chaerin/*.webp', {
  eager: true,
  import: 'default',
  query: '?url',
}) as Record<string, string>

function resolveChaerinWebp(filename: string): string {
  const suffix = `/chaerin/${filename}`
  const match = Object.entries(chaerinWebpModules).find(([path]) => path.endsWith(suffix))
  return match ? match[1] : ''
}

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
    })),
  full: {
    image: manifestData.full.image,
    url: resolveChaerinWebp(manifestData.full.image),
    x: manifestData.full.x,
    y: manifestData.full.y,
    width: manifestData.full.width,
    height: manifestData.full.height,
  },
}

export const ASSEMBLE_APP_ICON_URL: string = capsuleLogo.symbol.color
