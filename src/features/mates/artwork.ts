import chaerinCard from '@/assets/characters/chaerin-v2/chaerin-v2-card.webp'
import chaerinHero from '@/assets/characters/chaerin-v2/chaerin-v2-hero.webp'
import chaerinAvatar from '@/assets/characters/chaerin-v2/chaerin-v2-avatar.webp'
import chaerinFull from '@/assets/characters/chaerin-v2/chaerin-v2-full.webp'
import dohyunCard from '@/assets/characters/seojin/seojin-card.webp'
import dohyunHero from '@/assets/characters/seojin/seojin-hero.webp'
import dohyunAvatar from '@/assets/characters/seojin/seojin-avatar.webp'
import dohyunFull from '@/assets/characters/seojin/seojin-full.webp'
import chaerinCallBgPortrait from '@/assets/characters/chaerin-call-bg/chaerin-call-bg-portrait.webp'
import chaerinCallBgLandscape from '@/assets/characters/chaerin-call-bg/chaerin-call-bg-landscape.webp'

/** Fallback violet gradient shown while callBackground loads or if it fails. */
export const CALL_STAGE_GRADIENT =
  'radial-gradient(ellipse 72% 62% at 50% 42%, rgba(150, 109, 252, 0.24) 0%, rgba(107, 44, 209, 0.08) 48%, transparent 76%), linear-gradient(180deg, #161326 0%, #110f1d 100%)'

export interface CallBackgroundAssets {
  portrait: string
  landscape: string
}

/**
 * A v2 mate's still images, all rendered from its model in the same engine views (renders.json in each folder, the
 * same values for every mate), so the framing code (aliving-view.ts) lines a still and the live model up for any mate.
 * card: head → chest (home card, call fallback) · hero: head → waist (previews) · avatar: head → shoulders · full.
 */
export interface MateArtwork {
  portrait: string
  card: string
  hero: string
  avatar: string
  full: string
  /** The room behind the mate (card, previews, call). */
  callBackground: CallBackgroundAssets
}

/** The classroom room picture has no character in it; it is the shared room until a mate gets its own. */
const sharedCallBackground: CallBackgroundAssets = { portrait: chaerinCallBgPortrait, landscape: chaerinCallBgLandscape }

export const chaerinArtwork = {
  portrait: chaerinCard,
  card: chaerinCard,
  hero: chaerinHero,
  avatar: chaerinAvatar,
  full: chaerinFull,
  callBackground: sharedCallBackground,
} satisfies MateArtwork

/**
 * 서도현 (model bundle `seojin`): temporary stills rendered from the model (scripts/render-mate-stills.mjs) until the
 * illustrated ones arrive. 서도현's own room picture (the neighbourhood study room) does not exist yet: shared room.
 */
export const dohyunArtwork = {
  portrait: dohyunCard,
  card: dohyunCard,
  hero: dohyunHero,
  avatar: dohyunAvatar,
  full: dohyunFull,
  callBackground: sharedCallBackground,
} satisfies MateArtwork

const artworks: Readonly<Record<string, MateArtwork>> = { chaerin: chaerinArtwork, dohyun: dohyunArtwork }

/** The bundled stills of a launch mate (undefined for others: they use the server's image). */
export function mateArtwork(id: string | undefined): MateArtwork | undefined {
  return id ? artworks[id] : undefined
}

/** The room picture behind a mate (shared room for mates without their own). */
export function mateCallBackground(id: string | undefined): CallBackgroundAssets {
  return mateArtwork(id)?.callBackground ?? sharedCallBackground
}

export function matePortrait(id: string, serverImage?: string) {
  return artworks[id]?.portrait || serverImage
}

export function mateAvatar(id: string, serverImage?: string) {
  return artworks[id]?.avatar || serverImage
}

export function mateHeroPortrait(id: string, serverImage?: string) {
  return artworks[id]?.hero || serverImage
}
