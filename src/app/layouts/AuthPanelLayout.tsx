import { Outlet } from 'react-router'
import { Brand } from '@/shared/ui/Brand'

/** Simple form surface for onboarding and account recovery. */
export function AuthPanelLayout() {
  return <div className="auth-panel-layout">
    <Brand />
    <section className="app-panel auth-panel-content"><Outlet /></section>
  </div>
}
