import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Brand } from '@/shared/ui/Brand'

export function SiteHeader({ navigation, account }: { navigation: ReactNode; account: ReactNode }) {
  return (
    <header className="site-header">
      <div className="page-container site-header-inner">
        <Link to="/" aria-label="CAPSULE 홈" className="site-header-brand">
          <Brand />
        </Link>
        {navigation}
        <div className="site-header-account">{account}</div>
      </div>
    </header>
  )
}
