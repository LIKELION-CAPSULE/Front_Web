import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import '@fontsource-variable/noto-sans-kr'
import { App } from '@/app/App'
import '@/styles/index.css'

const root = document.getElementById('root')

if (!root) throw new Error('CAPSULE root element was not found.')

createRoot(root).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
