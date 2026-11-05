import type { ReviewLiveMessage, ReviewMessageTone } from './messages'

/** Inspect visibility inside the preview, even when its parent panel is displaying another tab. */
export function captureReviewMessages(document: Document): ReviewLiveMessage[] {
  const view = document.defaultView
  if (!view) return []
  const messages: ReviewLiveMessage[] = []
  const scope = [...document.querySelectorAll('dialog:modal')].at(-1) ?? document
  for (const element of scope.querySelectorAll<HTMLElement>('[data-feedback], [role="alert"], [role="status"], [aria-busy="true"], button:disabled, .room-empty, section.min-h-72, .schedule-list-scroll > p')) {
    let visible = true
    for (let parent: HTMLElement | null = element; parent; parent = parent.parentElement) {
      const style = view.getComputedStyle(parent)
      if (parent.hidden || parent.inert || parent.getAttribute('aria-hidden') === 'true' || style.display === 'none' || style.visibility === 'hidden') { visible = false; break }
    }
    if (!visible || (!element.hasAttribute('data-feedback') && element.querySelector('[data-feedback]'))) continue
    const content = element.classList.contains('page-skeleton') ? element.querySelector('.sr-only')?.textContent
      : element.classList.contains('notification-card') ? element.querySelector('.notification-description')?.textContent : element.textContent
    const text = (content ?? '').replace(/\s+/g, ' ').trim()
    if (!text) continue
    const loading = /하고 있어요|불러오고|연결 중|로그인하고|답장을 기다/.test(text)
    if (element.matches('button:disabled') && !loading) continue
    const tone = (element.dataset.feedback || (loading || element.hasAttribute('aria-busy') || element.classList.contains('page-skeleton') ? 'loading'
      : element.getAttribute('role') === 'alert' ? 'error' : element.matches('.room-empty, section.min-h-72, .schedule-list-scroll > p') ? 'empty' : 'info')) as ReviewMessageTone
    if (!messages.some(message => message.text === text && message.tone === tone)) messages.push({ text, tone })
  }
  return messages
}
