/**
 * Which avatar models the picker keeps mounted (AvatarDial). Two avatars are never on the stage at the same moment:
 *
 * 1. A new choice sends the model on screen out: it fades out quickly (`AVATAR_LEAVE_MS`) and is then released
 *    (`previewReleased`). A model passed over before it was drawn is simply dropped.
 * 2. Only when nothing is leaving is the chosen model mounted. Until it is drawn and has faded in, the chosen avatar's
 *    still (thumbnail) stands in, softly, so the stage never flashes empty.
 * 3. Drawn (`previewShown`) or failed (`previewFailed`, its own still and 「다시 시도」 take over): the stand-in goes.
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
}

/** How long the previous model takes to fade out before it is released (avatar-dial.css). */
export const AVATAR_LEAVE_MS = 150

export const emptyPreview = <E extends PreviewEntry>(current: E | null = null): PreviewView<E> => ({ current, leaving: [], settled: null })

/** The current model is mounted (nothing is leaving any more). */
export const currentMounted = <E extends PreviewEntry>(view: PreviewView<E>) => view.current !== null && view.leaving.length === 0

/** The choice changed (`instant`: reduced motion — no fade, the previous model is released at once). */
export function choosePreview<E extends PreviewEntry>(view: PreviewView<E>, current: E | null, instant: boolean): PreviewView<E> {
  if (view.current?.key === current?.key) return view
  if (instant) return { current, leaving: [], settled: null }
  // The model on screen (mounted current) fades out; one that never got mounted is just dropped.
  const outgoing = currentMounted(view) && view.current ? [view.current] : []
  return { current, leaving: [...view.leaving, ...outgoing], settled: null }
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

/** The chosen avatar's still stands in: while its model is not mounted yet or not drawn yet (and nothing is leaving). */
export function standInVisible<E extends PreviewEntry>(view: PreviewView<E>): boolean {
  return view.current !== null && view.leaving.length === 0 && view.settled !== view.current.key
}
