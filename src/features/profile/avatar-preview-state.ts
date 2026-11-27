/**
 * Which avatar models the picker keeps mounted (AvatarDial). Two avatars are never on the stage at the same moment:
 *
 * 1. A new choice sends the model on screen out: it fades out quickly (`AVATAR_LEAVE_MS`) and is then released
 *    (`previewReleased`). A model passed over before it was drawn is simply dropped.
 * 2. Only when nothing is leaving is the chosen model mounted. Until it is drawn, the stage keeps only its light — no
 *    still flashes in (user decision 2026-11-26: a still then the model looked busy). A wait past
 *    `AVATAR_WAIT_PULSE_MS` lets the light pulse softly; past `AVATAR_STILL_FALLBACK_MS` the chosen avatar's still
 *    (thumbnail) stands in after all (`waitingPhase`), and the model fades in over it when it comes.
 * 3. Drawn (`previewShown`) or failed (`previewFailed`, its own still and 「다시 시도」 take over): the waiting ends.
 *
 * At most two models exist at once (one fading out, one loading), and never two visible.
 */
export type PreviewEntry = { key: string }
export type PreviewView<E extends PreviewEntry> = {
  current: E | null
  /** Models fading out (mounted until released). */
  leaving: E[]
  /** Key of the current model once it is drawn and faded in, or once it failed: the stand-in still is gone. */
  settled: string | null
  /** Increments every time `current` changes so stale callbacks/retry handlers from earlier mounts are ignored. */
  generation: number
}

/** How long the previous model takes to fade out before it is released (avatar-dial.css). */
export const AVATAR_LEAVE_MS = 150
/** A model still loading after this long: the stage's light pulses softly (the only loading sign). */
export const AVATAR_WAIT_PULSE_MS = 600
/** A model still loading after this long: the avatar's still stands in until the model comes (a fallback only). */
export const AVATAR_STILL_FALLBACK_MS = 4000

/** What a wait of `elapsedMs` for the chosen model shows: nothing but the light, a pulse, or the still as well. */
export function waitingPhase(elapsedMs: number): 'quiet' | 'pulse' | 'still' {
  return elapsedMs >= AVATAR_STILL_FALLBACK_MS ? 'still' : elapsedMs >= AVATAR_WAIT_PULSE_MS ? 'pulse' : 'quiet'
}

export const emptyPreview = <E extends PreviewEntry>(current: E | null = null): PreviewView<E> => ({
  current,
  leaving: [],
  settled: null,
  generation: 0,
})

/** The current model is mounted (nothing is leaving any more). */
export const currentMounted = <E extends PreviewEntry>(view: PreviewView<E>) => view.current !== null && view.leaving.length === 0

/** The choice changed (`instant`: reduced motion — no fade, the previous model is released at once). */
export function choosePreview<E extends PreviewEntry>(view: PreviewView<E>, current: E | null, instant: boolean): PreviewView<E> {
  if (view.current?.key === current?.key) return view
  const generation = view.generation + 1
  if (instant) return { current, leaving: [], settled: null, generation }
  // The model on screen (mounted current) fades out; one that never got mounted is just dropped.
  const outgoing = currentMounted(view) && view.current ? [view.current] : []
  return { current, leaving: [...view.leaving, ...outgoing], settled: null, generation }
}

/** A leaving model has faded out: release it. */
export function previewReleased<E extends PreviewEntry>(view: PreviewView<E>, key: string): PreviewView<E> {
  return view.leaving.some((entry) => entry.key === key)
    ? { ...view, leaving: view.leaving.filter((entry) => entry.key !== key) }
    : view
}

/** `key` was drawn and has faded in: the stand-in still goes. */
export function previewShown<E extends PreviewEntry>(view: PreviewView<E>, key: string): PreviewView<E> {
  return view.current?.key === key && view.settled !== key ? { ...view, settled: key } : view
}

/** `key` failed to load: its own still and 「다시 시도」 show, so the stand-in goes too. */
export function previewFailed<E extends PreviewEntry>(view: PreviewView<E>, key: string): PreviewView<E> {
  return previewShown(view, key)
}

/** Models to keep mounted, bottom first: the leaving ones, then the chosen one once nothing is leaving. */
export function mountedPreviews<E extends PreviewEntry>(view: PreviewView<E>): { entry: E; leaving: boolean }[] {
  return [
    ...view.leaving.map((entry) => ({ entry, leaving: true })),
    ...(currentMounted(view) ? [{ entry: view.current!, leaving: false }] : []),
  ]
}

/** The chosen model is not drawn yet (mounted or not): the wait `waitingPhase` measures. */
export const awaitingModel = <E extends PreviewEntry>(view: PreviewView<E>) => view.current !== null && view.settled !== view.current.key

/**
 * The stand-in may be on screen: the chosen model is mounted but not drawn yet (and nothing is leaving). AvatarDial shows
 * it only once the wait reached `AVATAR_STILL_FALLBACK_MS`; it fades out as soon as this turns false.
 */
export function standInVisible<E extends PreviewEntry>(view: PreviewView<E>): boolean {
  return view.current !== null && view.leaving.length === 0 && view.settled !== view.current.key
}
