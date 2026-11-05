import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './App'
import { DemoProvider } from '@/features/demo/DemoProvider'
import { MediaProvider } from '@/features/media/MediaProvider'
import type { SessionModelFactory } from '@/features/live2d/session-model'
import '@/features/media/media.css'

export function mountApp(root: HTMLElement, extra?: ReactNode, page?: ReactNode, modelFactory?: SessionModelFactory) {
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <DemoProvider modelFactory={modelFactory}>
          <MediaProvider>{page ?? <App />}{extra}</MediaProvider>
        </DemoProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}
