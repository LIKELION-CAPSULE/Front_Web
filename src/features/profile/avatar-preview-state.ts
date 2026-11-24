/**
 * Which avatar models the picker keeps mounted (AvatarDial).
 *
 * - `current`: the chosen avatar's model (loading, ready or failed).
 * - `shown`: the last model that was drawn. It stays on screen while `current` loads, so a switch never flashes an
 *   empty stage, and is released once `current` is drawn.
 * - When `current` fails, `shown` is released at once: the stage must not keep showing the previous avatar while the
 *   name (and what would be saved) is the new one. The failed avatar's still and 「다시 시도」 take its place.
 * At most two models exist at once.
 */
export type PreviewEntry = { key: string }
export type PreviewView<E extends PreviewEntry> = { current: E | null; shown: E | null }

/** The choice changed (`instant`: reduced motion, no overlap). */
export function choosePreview<E extends PreviewEntry>(view: PreviewView<E>, current: E | null, instant: boolean): PreviewView<E> {
  if (view.current?.key === current?.key) return view
  return { current, shown: current && !instant ? view.shown : null }
}

/** `key` was drawn (and has faded in): it becomes the shown model and the previous one is released. */
export function previewShown<E extends PreviewEntry>(view: PreviewView<E>, key: string): PreviewView<E> {
  return view.current?.key === key && view.shown?.key !== key ? { current: view.current, shown: view.current } : view
}

/** `key` failed to load: release the previous model so the stage shows the chosen avatar's still. */
export function previewFailed<E extends PreviewEntry>(view: PreviewView<E>, key: string): PreviewView<E> {
  return view.current?.key === key && view.shown ? { current: view.current, shown: null } : view
}

/** Models to keep mounted, bottom first. */
export function mountedPreviews<E extends PreviewEntry>(view: PreviewView<E>): E[] {
  const shown = view.shown && view.shown.key !== view.current?.key ? view.shown : null
  return [shown, view.current].filter((entry): entry is E => entry !== null)
}
