/**
 * Pixel snow / hearts behind the 내 메이트 page (PixelSnow.tsx draws it). Pure and dependency-free so the stage mix,
 * counts and particle motion are unit-tested (tests/pixel-snow.test.ts).
 *
 * Units: positions and speeds are in *art pixels* (one sprite pixel). PixelSnow shows one art pixel as about
 * `ART_PIXEL_CSS` CSS px (an integer number of device pixels, so the sprites stay crisp).
 */

export type SnowKind = 'dot' | 'flake' | 'heartSmall' | 'heart' | 'heartBig' | 'capsule'

/** What falls at an affinity stage (1 처음 만남 … 5 단짝). */
export type SnowMix = {
  stage: 1 | 2 | 3 | 4 | 5
  /** Particles per `SNOW_UNIT_AREA` CSS px² of the page background. */
  perUnit: number
  /** Share of hearts among new particles (the rest is snow). */
  heart: number
  /** Share of hearts that twinkle softly. */
  sparkle: number
  /** Chance that a new heart is the one big heart (at most one on screen). */
  big: number
  /** Chance that a new particle is the one capsule (at most one on screen). */
  capsule: number
}

/** One art pixel in CSS px (rounded to whole device pixels by PixelSnow). */
export const ART_PIXEL_CSS = 2
export const SNOW_UNIT_AREA = 100_000
export const SNOW_MIN = 6
export const SNOW_MAX = 70
/** Under reduced motion a few still particles stay (this share of the target), drawn once. */
export const SNOW_STILL_SHARE = 0.35

/**
 * The five stages. Sparse snow at first; more snow; a few hearts among the snow; more hearts, some twinkling;
 * mostly hearts with now and then one big heart or one capsule. Background (the window width × main height):
 * 1280×720 → 12 / 20 / 25 / 30 / 36, 1440×900 → 18 / 28 / 35 / 43 / 50, 1920×1080 → 26 / 40 / 51 / 62 / 70 (cap).
 */
export const SNOW_STAGES: Readonly<Record<1 | 2 | 3 | 4 | 5, SnowMix>> = {
  1: { stage: 1, perUnit: 1.4, heart: 0, sparkle: 0, big: 0, capsule: 0 },
  2: { stage: 2, perUnit: 2.2, heart: 0, sparkle: 0, big: 0, capsule: 0 },
  3: { stage: 3, perUnit: 2.8, heart: 0.18, sparkle: 0, big: 0, capsule: 0 },
  4: { stage: 4, perUnit: 3.4, heart: 0.45, sparkle: 0.35, big: 0, capsule: 0 },
  5: { stage: 5, perUnit: 4, heart: 0.75, sparkle: 0.45, big: 0.05, capsule: 0.03 },
}

/** Mix for a stage; no stage (affinity off) or anything out of range → stage 1 / the nearest stage. */
export function snowMix(stage: number | null | undefined): SnowMix {
  if (stage === null || stage === undefined || !Number.isFinite(stage)) return SNOW_STAGES[1]
  const clamped = Math.min(5, Math.max(1, Math.round(stage))) as 1 | 2 | 3 | 4 | 5
  return SNOW_STAGES[clamped]
}

/** How many particles a background of this size holds (CSS px), within [SNOW_MIN, SNOW_MAX]; fewer when still. */
export function snowTarget(widthCss: number, heightCss: number, mix: SnowMix, still = false): number {
  if (widthCss <= 0 || heightCss <= 0) return 0
  const raw = Math.round(((widthCss * heightCss) / SNOW_UNIT_AREA) * mix.perUnit)
  const target = Math.min(SNOW_MAX, Math.max(SNOW_MIN, raw))
  return still ? Math.max(3, Math.round(target * SNOW_STILL_SHARE)) : target
}

/** Kind of a new particle from three random numbers in [0, 1); the big heart and the capsule only when free. */
export function pickKind(mix: SnowMix, r1: number, r2: number, free: { big: boolean; capsule: boolean }): SnowKind {
  if (free.capsule && r1 < mix.capsule) return 'capsule'
  if (r2 < mix.heart) {
    if (free.big && r1 >= mix.capsule && r1 < mix.capsule + mix.big) return 'heartBig'
    return r1 < 0.55 ? 'heartSmall' : 'heart'
  }
  return r1 < 0.6 ? 'dot' : 'flake'
}

export type SnowParticle = {
  kind: SnowKind
  /** Colour index into the sprite's palette list. */
  tone: number
  x: number
  y: number
  /** Fall speed, art px per second. */
  speed: number
  swayAmp: number
  /** Sway angular speed (rad/s). */
  swayRate: number
  phase: number
  /** Resting opacity (0.15–0.35). */
  alpha: number
  twinkle: boolean
  /** Seconds since it appeared (fades in over `FADE_IN`). */
  age: number
}

export const FADE_IN = 1.2

/** Fall speed (art px/s) and opacity ranges per kind: hearts drift more slowly than snow, the big ones slowest. */
export const KIND_MOTION: Readonly<Record<SnowKind, { speed: [number, number]; alpha: [number, number] }>> = {
  dot: { speed: [11, 17], alpha: [0.15, 0.3] },
  flake: { speed: [9, 14], alpha: [0.18, 0.35] },
  heartSmall: { speed: [7, 11], alpha: [0.18, 0.32] },
  heart: { speed: [6, 10], alpha: [0.2, 0.35] },
  heartBig: { speed: [4.5, 6.5], alpha: [0.22, 0.32] },
  capsule: { speed: [5, 7], alpha: [0.22, 0.32] },
}

const lerp = (range: readonly [number, number], t: number) => range[0] + (range[1] - range[0]) * t

/**
 * A new particle in a background `width` × `height` art px. `y`: where it starts (default just above the top);
 * `random` returns numbers in [0, 1).
 */
export function spawnParticle(
  mix: SnowMix,
  width: number,
  random: () => number,
  free: { big: boolean; capsule: boolean },
  y?: number,
): SnowParticle {
  const kind = pickKind(mix, random(), random(), free)
  const motion = KIND_MOTION[kind]
  const isHeart = kind === 'heart' || kind === 'heartSmall' || kind === 'heartBig'
  return {
    kind,
    tone: Math.floor(random() * 2),
    x: random() * width,
    y: y ?? -SPRITE_SIZE[kind][1] - random() * 20,
    speed: lerp(motion.speed, random()),
    swayAmp: 1.5 + random() * 3.5,
    swayRate: (2 * Math.PI) / (4 + random() * 4),
    phase: random() * Math.PI * 2,
    alpha: lerp(motion.alpha, random()),
    twinkle: isHeart && random() < mix.sparkle,
    age: y === undefined ? FADE_IN : 0,
  }
}

/** Moves a particle by `dt` seconds; false once it has left the bottom (`height` art px). */
export function stepParticle(particle: SnowParticle, dt: number, height: number): boolean {
  particle.y += particle.speed * dt
  particle.age += dt
  return particle.y < height + 2
}

/** Drawn position and opacity at time `t` (s): a gentle sideways sway, the fade-in and the soft twinkle. */
export function particleLook(particle: SnowParticle, t: number): { x: number; y: number; alpha: number } {
  const fade = Math.min(1, particle.age / FADE_IN)
  const twinkle = particle.twinkle ? 1 + 0.35 * Math.sin(t * 2.6 + particle.phase * 3) : 1
  return {
    x: Math.round(particle.x + Math.sin(t * particle.swayRate + particle.phase) * particle.swayAmp),
    y: Math.round(particle.y),
    alpha: Math.min(0.42, particle.alpha * fade * twinkle),
  }
}

/**
 * Sprites as rows of characters: `.` empty, `a` the main colour, `b` the second colour, `w` a white highlight.
 * Snow is white or pale lilac; hearts pale pink or pale lilac; the capsule pale white and lilac. No saturated colour.
 */
export const SPRITES: Readonly<Record<SnowKind, readonly string[]>> = {
  dot: ['.a.', 'aaa', '.a.'],
  flake: ['...a...', '.a.a.a.', '..aaa..', 'aaa.aaa', '..aaa..', '.a.a.a.', '...a...'],
  heartSmall: ['.a.a.', 'aaaaa', 'aaaaa', '.aaa.', '..a..'],
  heart: ['.aa.aa.', 'awaaaaa', 'aaaaaaa', '.aaaaa.', '..aaa..', '...a...'],
  heartBig: [
    '.aaa...aaa.',
    'awwaa.aaaaa',
    'awaaaaaaaaa',
    'aaaaaaaaaaa',
    'aaaaaaaaaaa',
    '.aaaaaaaaa.',
    '..aaaaaaa..',
    '...aaaaa...',
    '....aaa....',
    '.....a.....',
  ],
  capsule: ['.aaaabbb.', 'awaaabbbb', 'aaaaabbbb', 'aaaaabbbb', '.aaaabbb.'],
}

export const SPRITE_SIZE: Readonly<Record<SnowKind, readonly [number, number]>> = Object.fromEntries(
  Object.entries(SPRITES).map(([kind, rows]) => [kind, [rows[0]!.length, rows.length] as const]),
) as Record<SnowKind, readonly [number, number]>

/** Palettes per kind (two tones each): main colour `a`, second colour `b`. */
export const SPRITE_TONES: Readonly<Record<SnowKind, readonly { a: string; b: string }[]>> = {
  dot: [{ a: '#FFFFFF', b: '#FFFFFF' }, { a: '#E6DEFF', b: '#E6DEFF' }],
  flake: [{ a: '#FFFFFF', b: '#FFFFFF' }, { a: '#E6DEFF', b: '#E6DEFF' }],
  heartSmall: [{ a: '#FFC8DD', b: '#FFC8DD' }, { a: '#E9D6FF', b: '#E9D6FF' }],
  heart: [{ a: '#FFC8DD', b: '#FFC8DD' }, { a: '#E9D6FF', b: '#E9D6FF' }],
  heartBig: [{ a: '#FFC8DD', b: '#FFC8DD' }, { a: '#F1D2F2', b: '#F1D2F2' }],
  capsule: [{ a: '#F4F0FF', b: '#C7B6FF' }, { a: '#F4F0FF', b: '#FFC8DD' }],
}

/** A small seeded random (mulberry32) so a layout is repeatable (tests, the still picture under reduced motion). */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
