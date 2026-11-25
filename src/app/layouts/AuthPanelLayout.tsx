import { Outlet } from 'react-router'
import { SiteHeader } from '@/app/components/SiteHeader'
import { Brand } from '@/shared/ui/Brand'

/**
 * Simple form surface for onboarding and account recovery. Onboarding (`appHeader`) shows the home app header with the
 * logo only in place of the centred logo; password reset keeps the centred logo (it is reached signed out, from mail).
 */
export function AuthPanelLayout({ appHeader = false }: { appHeader?: boolean }) {
  return <div className="auth-panel-layout" data-app-header={appHeader || undefined}>
    {appHeader ? <SiteHeader sticky variant="logo-only" /> : <Brand />}
    <section className="app-panel auth-panel-content"><Outlet /></section>
  </div>
}
