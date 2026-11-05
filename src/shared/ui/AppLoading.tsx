import { Brand } from './Brand'
import { QuarterRingSpinner } from './QuarterRingSpinner'
import './app-loading.css'

export function AppLoading({ label = '화면을 불러오고 있어요.' }: { label?: string }) {
  return <main id="main-content" tabIndex={-1} role="status" aria-busy="true" data-loading-screen="auth" className="app-loading focus:outline-none">
    <span className="sr-only">{label}</span>
    <div aria-hidden="true" className="app-loading-content">
      <Brand className="app-loading-brand" />
      <QuarterRingSpinner />
    </div>
  </main>
}
