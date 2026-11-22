import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './App'
import { DemoProvider } from '@/features/demo/DemoProvider'
import { MediaProvider } from '@/features/media/MediaProvider'
import { ConnectionPreferencesProvider } from '@/features/mates/ConnectionPreferencesProvider'
import type { SessionModelFactory } from '@/features/live2d/session-model'
import type { ConnectionReducer } from '@/features/backend/beta-reducer'
import type { BetaAccountPort } from '@/features/auth/beta-account'
import type { MateContentPort } from '@/features/mates/mate-contract'
import type { BetaFeaturePort } from '@/features/backend/beta-feature-port'
import { NativeDragGuard } from '@/shared/ui/NativeDragGuard'
import '@/features/media/media.css'

export function mountApp(root: HTMLElement, extra?: ReactNode, page?: ReactNode, modelFactory?: SessionModelFactory, legacyReducer?: ConnectionReducer, accountPort?: BetaAccountPort, matePort?: MateContentPort, featurePort?: BetaFeaturePort) {
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <NativeDragGuard />
        <DemoProvider modelFactory={modelFactory} reducer={legacyReducer} accountPort={accountPort} matePort={matePort} featurePort={featurePort}>
          <ConnectionPreferencesProvider><MediaProvider>{page ?? <App />}{extra}</MediaProvider></ConnectionPreferencesProvider>
        </DemoProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}
