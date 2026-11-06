export type PreparePaper = { canvas: HTMLCanvasElement; bounds: DOMRect }

const visibleColor = (color: string) => color !== 'transparent' && color !== 'rgba(0, 0, 0, 0)'

/** Rasterize this form's visible shapes and text locally, without cloning controls or loading remote images. */
export function capturePreparePaper(card: HTMLElement): PreparePaper {
  const bounds = card.getBoundingClientRect()
  if (!bounds.width || !bounds.height) throw new Error('The preparation card has no visible size.')
  const canvas = document.createElement('canvas')
  const ratio = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = Math.ceil(bounds.width * ratio)
  canvas.height = Math.ceil(bounds.height * ratio)
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is unavailable.')
  ctx.scale(ratio, ratio)
  const cardStyle = getComputedStyle(card)
  ctx.beginPath()
  ctx.roundRect(0, 0, bounds.width, bounds.height, parseFloat(cardStyle.borderTopLeftRadius) || 24)
  ctx.clip()
  ctx.fillStyle = cardStyle.backgroundColor
  ctx.fillRect(0, 0, bounds.width, bounds.height)
  const walker = document.createTreeWalker(card, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT)
  const range = document.createRange()
  let node: Node | null
  while ((node = walker.nextNode())) {
    const element = node instanceof Element ? node : node.parentElement
    if (!element || element.closest('svg, .sr-only, .prepare-folder-paper')) continue
    const style = getComputedStyle(element)
    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') continue
    const gated = element.closest('.mvp-gate-content')
    const gatedStyle = gated ? getComputedStyle(gated) : null
    ctx.filter = gatedStyle?.filter ?? 'none'
    ctx.globalAlpha = gatedStyle ? Number(gatedStyle.opacity) : 1
    if (node instanceof HTMLElement) {
      const rect = node.getBoundingClientRect()
      const x = rect.x - bounds.x, y = rect.y - bounds.y
      if (!rect.width || !rect.height || y >= bounds.height || y + rect.height <= 0) continue
      if (visibleColor(style.backgroundColor)) {
        ctx.fillStyle = style.backgroundColor
        ctx.beginPath(); ctx.roundRect(x, y, rect.width, rect.height, parseFloat(style.borderTopLeftRadius) || 0); ctx.fill()
      }
      if (node instanceof HTMLInputElement && node.type === 'range') {
        const progress = (Number(node.value) - Number(node.min)) / Math.max(1, Number(node.max) - Number(node.min))
        const primary = cardStyle.getPropertyValue('--color-primary').trim()
        ctx.fillStyle = cardStyle.getPropertyValue('--color-control').trim()
        ctx.beginPath(); ctx.roundRect(x, y + rect.height / 2 - 3, rect.width, 6, 3); ctx.fill()
        ctx.fillStyle = primary
        ctx.beginPath(); ctx.roundRect(x, y + rect.height / 2 - 3, rect.width * progress, 6, 3); ctx.fill()
        ctx.beginPath(); ctx.arc(x + rect.width * progress, y + rect.height / 2, 9, 0, Math.PI * 2); ctx.fill()
      }
      if (node instanceof HTMLImageElement && node.complete && node.naturalWidth) {
        // Cross-origin portraits never enter a WebGL texture; their decorative slot keeps its background.
        if (new URL(node.currentSrc, location.href).origin === location.origin) {
          ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, rect.width, rect.height, parseFloat(style.borderTopLeftRadius) || 0); ctx.clip()
          const scale = Math.max(rect.width / node.naturalWidth, rect.height / node.naturalHeight)
          const width = node.naturalWidth * scale, height = node.naturalHeight * scale
          ctx.drawImage(node, x + (rect.width - width) / 2, y + (rect.height - height) / 2, width, height)
          ctx.restore()
        }
      }
    } else if (node instanceof Text && node.textContent?.trim()) {
      ctx.fillStyle = style.color
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`
      ctx.textBaseline = 'top'
      // Range positions preserve flex gaps, wrapping and the form's current scroll position.
      const text = node.textContent
      for (let index = 0; index < text.length; index++) {
        if (!text[index]?.trim()) continue
        range.setStart(node, index); range.setEnd(node, index + 1)
        const rect = range.getBoundingClientRect()
        if (rect.width && rect.height) ctx.fillText(text[index]!, rect.x - bounds.x, rect.y - bounds.y)
      }
    }
  }
  return { canvas, bounds }
}
