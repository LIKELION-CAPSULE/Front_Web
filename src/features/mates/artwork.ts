import chaerinCard from '@/assets/characters/chaerin-v2/chaerin-v2-card.webp'
import chaerinHero from '@/assets/characters/chaerin-v2/chaerin-v2-hero.webp'
import chaerinAvatar from '@/assets/characters/chaerin-v2/chaerin-v2-avatar.webp'
import chaerinFull from '@/assets/characters/chaerin-v2/chaerin-v2-full.webp'
import chaerinCallBgPortrait from '@/assets/characters/chaerin-live2d-v1/chaerin-call-bg-portrait.webp'
import chaerinCallBgLandscape from '@/assets/characters/chaerin-live2d-v1/chaerin-call-bg-landscape.webp'

/** Fallback violet gradient shown while callBackground loads or if it fails. */
export const CALL_STAGE_GRADIENT =
  'radial-gradient(ellipse 72% 62% at 50% 42%, rgba(150, 109, 252, 0.24) 0%, rgba(107, 44, 209, 0.08) 48%, transparent 76%), linear-gradient(180deg, #161326 0%, #110f1d 100%)'

export interface CallBackgroundAssets {
  portrait: string
  landscape: string
}

const portraits: Readonly<Record<string, string>> = { chaerin: chaerinCard }

export const chaerinArtwork = {
  portrait: chaerinCard,
  card: chaerinCard,
  hero: chaerinHero,
  avatar: chaerinAvatar,
  full: chaerinFull,
  callBackground: {
    portrait: chaerinCallBgPortrait,
    landscape: chaerinCallBgLandscape,
  } satisfies CallBackgroundAssets,
}

export function matePortrait(id: string, serverImage?: string) {
  return portraits[id] || serverImage
}

export function mateAvatar(id: string, serverImage?: string) {
  return id === 'chaerin' ? chaerinAvatar : portraits[id] || serverImage
}

export function mateHeroPortrait(id: string, serverImage?: string) {
  if (id === 'chaerin') return chaerinHero
  return portraits[id] || serverImage
}
