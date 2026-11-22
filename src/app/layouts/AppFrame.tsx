import type { ReactNode } from 'react'
import { SiteHeader } from '@/app/components/SiteHeader'

export function AppFrame({ navigation, account, children }: { navigation: ReactNode; account: ReactNode; children: ReactNode }) {
  return <div className="app-shell min-h-dvh">
    <a href="#main-content" className="skip-link">본문으로 건너뛰기</a>
    <SiteHeader sticky navigation={navigation} account={account} />
    <main id="main-content" tabIndex={-1} className="page-container app-main focus:outline-none">
      {children}
    </main>
    <footer className="app-footer page-container">
      <span>CAPSULE <span className="mx-2 text-divider">/</span> 노트북 앞의 시간, 이제 혼자가 아니에요</span>
    </footer>
  </div>
}
