import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './App'
import { DemoProvider } from '@/features/demo/DemoProvider'
import { MediaProvider } from '@/features/media/MediaProvider'
import { ConnectionPreferencesProvider } from '@/features/mates/ConnectionPreferencesProvider'
import type { SessionModelFactory } from '@/features/live2d/session-model'
import type { BetaAccountPort } from '@/features/auth/beta-account'
import type { MateContentPort } from '@/features/mates/mate-contract'
import type { BetaFeaturePort } from '@/features/backend/beta-feature-port'
import { NativeDragGuard } from '@/shared/ui/NativeDragGuard'
import { api } from '@/shared/api/client'
import { createServerAccountPort, createServerMatePort } from '@/features/backend/server-ports'
import '@/features/media/media.css'

/** Account (4 · 8 · 10 · 35 · 36 · 39) and mate detail (31) ports default to the 11-25 API, in production and local mock alike. */
export function mountApp(root: HTMLElement, extra?: ReactNode, page?: ReactNode, modelFactory?: SessionModelFactory, accountPort: BetaAccountPort = createServerAccountPort(api), matePort: MateContentPort = createServerMatePort(api), featurePort?: BetaFeaturePort) {
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <NativeDragGuard />
        <DemoProvider modelFactory={modelFactory} accountPort={accountPort} matePort={matePort} featurePort={featurePort}>
          <ConnectionPreferencesProvider><MediaProvider>{page ?? <App />}{extra}</MediaProvider></ConnectionPreferencesProvider>
        </DemoProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}
