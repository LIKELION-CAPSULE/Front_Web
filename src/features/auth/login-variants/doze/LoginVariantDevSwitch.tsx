import { Link, useLocation } from 'react-router'
import { parseDozeQuery } from './doze-motion'
import './dev-switch.css'

/**
 * DEV-only switch between the login drafts: 변신 (`/login`, the assemble stage), 졸기 (`?variant=doze`) and 졸기·정지
 * (`?variant=doze&static=1`, the still-image path). Other query params (mode, next, …) are kept.
 */
export default function LoginVariantDevSwitch() {
  const location = useLocation()
  const current = parseDozeQuery(location.search)
  const active = !current.doze ? 'assemble' : current.forceStatic ? 'doze-static' : 'doze'
  const href = (variant: 'assemble' | 'doze' | 'doze-static') => {
    const search = new URLSearchParams(location.search)
    search.delete('variant')
    search.delete('static')
    if (variant !== 'assemble') search.set('variant', 'doze')
    if (variant === 'doze-static') search.set('static', '1')
    return `${location.pathname}${search.size ? `?${search}` : ''}`
  }
  const items = [
    { id: 'assemble', label: '변신' },
    { id: 'doze', label: '졸기' },
    { id: 'doze-static', label: '졸기·정지' },
  ] as const
  return (
    <nav className="login-dev-switch" aria-label="로그인 시안 전환 (개발용)">
      <span className="login-dev-switch-tag" aria-hidden="true">
        DEV
      </span>
      {items.map((item) => (
        <Link
          key={item.id}
          to={href(item.id)}
          replace
          className="login-dev-switch-link"
          aria-current={active === item.id ? 'page' : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  )
}
