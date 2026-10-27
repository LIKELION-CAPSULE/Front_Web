export type SceneVariant =
  'card' | 'hero' | 'backdrop' | 'scene' | 'portrait' | 'thumb' | 'fullbody' | 'seated' | 'welcome'

type SubjectPlacement = { width: number; center: number; anchor: number; maxHeight: number }

export type SceneComposition = {
  subjectSize: readonly [number, number]
  subjectLayout: SubjectPlacement
  seatedLayout?: SubjectPlacement & { bottom?: number }
  welcomeLayout?: Partial<SubjectPlacement> & { bottom?: number }
  deskSurface: number
}

export type SceneRect = { x: number; y: number; width: number; height: number }

export function hasSceneDesk(variant: SceneVariant) {
  return variant !== 'seated' && variant !== 'welcome' && variant !== 'fullbody'
}

export function getSceneBackground(
  art: { background: string; seatedBackground: string },
  variant: SceneVariant,
) {
  return variant === 'seated' || variant === 'welcome' ? art.seatedBackground : art.background
}

/** One geometry contract shared by CSS composition and Canvas export. */
export function getSceneSettings(art: SceneComposition, variant: SceneVariant) {
  const surface = variant === 'portrait' ? 0.66 : variant === 'thumb' ? 0.8 : 0.74
  const seatedWidth = Math.min(art.subjectLayout.width, 0.86)
  const isSeated = variant === 'seated' || variant === 'welcome'
  const seatedOverrides = {
    ...art.seatedLayout,
    ...(variant === 'welcome' ? { bottom: 0.78, ...art.welcomeLayout } : undefined),
  }
  const layout = isSeated
    ? {
        ...art.subjectLayout,
        width: seatedWidth,
        center: 0.99 - seatedWidth / 2,
        anchor: 1,
        maxHeight: 0.84,
        ...seatedOverrides,
      }
    : variant === 'backdrop'
      ? { ...art.subjectLayout, width: 0.48, center: 0.74 }
      : variant === 'fullbody'
        ? { width: 0.94, center: 0.5, anchor: 1, maxHeight: 0.94 }
        : art.subjectLayout
  // Main scenes sit to the right with a small intentional crop at the shoes/paws.
  const surfaceY =
    variant === 'fullbody' ? 0.98 : isSeated ? (seatedOverrides.bottom ?? 1.035) : surface
  return {
    ...layout,
    surfaceY,
    // Tall tails, hair and head ornaments must stay above the desktop and inside the frame.
    maxHeight: Math.min(layout.maxHeight, (surfaceY - 0.02) / layout.anchor),
    aspect: art.subjectSize[0] / art.subjectSize[1],
    deskFactor: 1 / (1 - art.deskSurface),
  }
}

export function getSceneLayout(
  art: SceneComposition,
  frame: SceneRect,
  variant: SceneVariant = 'portrait',
) {
  const settings = getSceneSettings(art, variant)
  const height = Math.min(
    (frame.width * settings.width) / settings.aspect,
    frame.height * settings.maxHeight,
  )
  const width = height * settings.aspect
  const deskHeight = Math.max(0, frame.height * (1 - settings.surfaceY) * settings.deskFactor)
  return {
    subject: {
      x: frame.x + frame.width * settings.center - width / 2,
      y: frame.y + frame.height * settings.surfaceY - height * settings.anchor,
      width,
      height,
    },
    desk: {
      x: frame.x,
      y: frame.y + frame.height - deskHeight,
      width: frame.width,
      height: deskHeight,
    },
    surfaceY: frame.y + frame.height * settings.surfaceY,
  }
}
