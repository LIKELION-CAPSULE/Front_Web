import type { ReactNode } from 'react'
import { SiteHeader } from '@/app/components/SiteHeader'
import { Icon } from '@/shared/ui/Icon'

export function AppFrame({ navigation, account, children }: { navigation: ReactNode; account: ReactNode; children: ReactNode }) {
  return <div className="app-shell min-h-dvh bg-canvas">
    <a href="#main-content" className="skip-link">본문으로 건너뛰기</a>
    <SiteHeader navigation={navigation} account={account} />
    <main id="main-content" tabIndex={-1} className="page-container app-main focus:outline-none">
      {children}
    </main>
    <footer className="app-footer page-container">
      <span>CAPSULE <span className="mx-2 text-divider">/</span> 같이 공부하는 시간의 힘.</span>
      <span>작은 집중이 쌓이는 곳 <Icon name="sparkle" size={14} className="ml-3 text-text-accent" /></span>
    </footer>
  </div>
}
