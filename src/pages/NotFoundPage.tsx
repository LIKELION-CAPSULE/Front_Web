import { Navigate } from 'react-router'

export default function NotFoundPage() {
  return <Navigate to="/" replace state={{ notice: 'page-not-found' }} />
}
