import { NavLink } from 'react-router'
import { cn } from '@/shared/lib/cn'
import { Icon, type IconName } from '@/shared/ui/Icon'

const navigation = [
  { to: '/', label: '홈', end: true, icon: 'home' },
  { to: '/records', label: '내 기록', end: false, icon: 'chart' },
  { to: '/characters', label: '친구', end: false, icon: 'heart' },
]

export function AppNavigation() {
  return <nav aria-label="주요 메뉴" className="app-navigation">
    {navigation.map(item => (
      <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn('app-nav-item', isActive && 'is-active')}>
        <Icon name={item.icon as IconName} size={17} />{item.label}
      </NavLink>
    ))}
  </nav>
}
