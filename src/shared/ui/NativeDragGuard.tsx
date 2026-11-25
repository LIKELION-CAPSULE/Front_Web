import { useEffect } from 'react'

const visualControls = [
  '.site-header-brand', '.app-navigation', '.detail-breadcrumb', '.ui-button',
  '.payment-receipt[data-phase="ready"] .receipt-paper',
  '[data-no-native-drag]',
].join(', ')

/** Suppress browser image/link ghosts without intercepting pointer gestures or text selection. */
export function NativeDragGuard() {
  useEffect(() => {
    const preventDecorativeDrag = (event: DragEvent) => {
      if (!(event.target instanceof Element)) return
      const target = event.target
      // Editable text and explicit native drag targets keep their normal browser behavior.
      if (target.closest('input, textarea, [contenteditable]:not([contenteditable="false"]), [data-native-drag="allow"], [draggable="true"]')) return
      if (target.closest('img, svg image') || target.closest(visualControls)) event.preventDefault()
    }
    document.addEventListener('dragstart', preventDecorativeDrag)
    return () => document.removeEventListener('dragstart', preventDecorativeDrag)
  }, [])
  return null
}
