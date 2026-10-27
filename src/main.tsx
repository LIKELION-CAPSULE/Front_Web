import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { App } from '@/app/App'
import { DemoProvider } from '@/features/demo/DemoProvider'
import '@/styles/index.css'

const root = document.getElementById('root')

if (!root) throw new Error('CAPSULE root element was not found.')

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <DemoProvider>
        <App />
      </DemoProvider>
    </BrowserRouter>
  </StrictMode>,
)
