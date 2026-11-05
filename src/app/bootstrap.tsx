import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from './App'
import { DemoProvider } from '@/features/demo/DemoProvider'
import { MediaProvider } from '@/features/media/MediaProvider'
import '@/features/media/media.css'

export function mountApp(root: HTMLElement, extra?: ReactNode, page?: ReactNode) {
  createRoot(root).render(
    <StrictMode>
      <BrowserRouter>
        <DemoProvider>
          <MediaProvider>{page ?? <App />}{extra}</MediaProvider>
        </DemoProvider>
      </BrowserRouter>
    </StrictMode>,
  )
}
