import { NavLink } from 'react-router'
import { cn } from '@/shared/lib/cn'
import { Icon, type IconName } from '@/shared/ui/Icon'

const navigation = [
  { to: '/', label: '홈', end: true, icon: 'home' },
  { to: '/mates/me', label: '내 메이트', end: false, icon: 'heart' },
  { to: '/records', label: '내 기록', end: false, icon: 'chart' },
]

export function AppNavigation() {
  return <nav aria-label="주요 메뉴" className="app-navigation">
    {navigation.map(item => (
      <NavLink key={item.to} to={item.to} end={item.end} aria-label={item.label} className={({ isActive }) => cn('app-nav-item', isActive && 'is-active')}>
        <Icon name={item.icon as IconName} size={17} />
        <span className="app-nav-label">{item.label}</span>
      </NavLink>
    ))}
  </nav>
}
