import { Navigate, useLocation } from 'react-router'
import { legacyAccountDestination } from '@/features/profile/account-location'

export function AccountRedirect() {
  const { search, hash } = useLocation()
  return <Navigate to={legacyAccountDestination(search, hash)} replace />
}
