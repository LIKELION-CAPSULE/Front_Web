import type { ReactNode } from 'react'
import { SiteHeader } from '@/app/components/SiteHeader'
import { SiteFooter } from '@/app/components/SiteFooter'

export function AppFrame({ navigation, account, children }: { navigation: ReactNode; account: ReactNode; children: ReactNode }) {
  return <div className="app-shell min-h-dvh">
    <a href="#main-content" className="skip-link">본문으로 건너뛰기</a>
    <SiteHeader sticky navigation={navigation} account={account} />
    <main id="main-content" tabIndex={-1} className="page-container app-main focus:outline-none">
      {children}
    </main>
    <SiteFooter />
  </div>
}
