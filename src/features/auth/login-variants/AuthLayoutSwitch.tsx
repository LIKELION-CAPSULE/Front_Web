import { useMemo } from 'react'
import { useLocation } from 'react-router'
import DesktopAuthLayout from '@/features/auth/login-backgrounds/desktop/DesktopAuthLayout'
import LoginVariantLayout from './LoginVariantLayout'
import { hasExplicitLoginVariant, isLoginVariantPath, resolveLoginVariant } from './login-variant'

function sessionStore(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage
  } catch {
    return null
  }
}

/**
 * Auth routes use the desktop shell. `/login` can instead show one of the PM comparison concepts
 * (`?login=illustration|portrait`); the login form itself is the same component in every concept.
 */
export default function AuthLayoutSwitch() {
  const { pathname, search } = useLocation()
  const variant = useMemo(() => resolveLoginVariant(search, sessionStore()), [search])
  const explicit = useMemo(() => hasExplicitLoginVariant(search, sessionStore()), [search])

  if (variant === 'desktop' || !isLoginVariantPath(pathname)) {
    return <DesktopAuthLayout key="desktop" />
  }
  return <LoginVariantLayout key={variant} variant={variant} showSwitcher={explicit} />
}
