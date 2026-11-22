import { LocalBetaStore } from './store'
import { createLocalTransport } from './transport'
import { createLocalStorageScope } from './storage'
import { readStoredReferralCode } from '@/features/auth/referral-code'

export async function mountLocalDemo(root: HTMLElement) {
  document.body.dataset.localDemo = 'true'
  let storage: Storage | null = null
  try { storage = localStorage } catch { /* An in-memory demo still works. */ }
  const store = new LocalBetaStore(storage)
  Object.defineProperty(window, 'localStorage', { configurable: true, value: createLocalStorageScope(storage) })
  // Mirror any ?ref= captured before local-demo storage scoping into the scoped storage.
  readStoredReferralCode()
  let session: Storage | null = null
  try { session = sessionStorage } catch { /* Use an isolated in-memory session. */ }
  Object.defineProperty(window, 'sessionStorage', { configurable: true, value: createLocalStorageScope(session) })
  // ApiClient captures fetch at construction; install before importing any app runtime or ports.
  globalThis.fetch = createLocalTransport(store, globalThis.fetch.bind(globalThis), location.origin)
  document.addEventListener('click', event => {
    const target = event.target instanceof Element ? event.target.closest('button.kakao-button') : null
    if (!target) return
    event.preventDefault(); event.stopImmediatePropagation()
    window.dispatchEvent(new Event('capsule-local:kakao'))
  }, true)
  const [{ mountApp }, { LocalControls }, { createLocalPorts }, { Live2DStage }] = await Promise.all([
    import('@/app/bootstrap'), import('./LocalControls'), import('./ports'), import('../live2d/live2d-stage'),
  ])
  const stages = new Set<InstanceType<typeof Live2DStage>>()
  const { accountPort, matePort, featurePort } = createLocalPorts(store)
  mountApp(root, <LocalControls store={store} stages={stages} />, undefined, (url, layout) => {
    const stage = new Live2DStage(url, layout, new URL(import.meta.env.BASE_URL, location.href).href)
    stage.setExpression(store.previewExpression)
    stages.add(stage)
    const destroy = stage.destroy.bind(stage)
    stage.destroy = () => { stages.delete(stage); destroy() }
    return stage
  }, undefined, accountPort, matePort, featurePort)
}
