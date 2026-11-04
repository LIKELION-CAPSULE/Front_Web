import { passwordResetLocation } from './password-reset-location.ts'

type ResetLocation = ReturnType<typeof passwordResetLocation>
declare global {
  interface Window { __capsulePasswordReset?: ResetLocation }
}

// Read the temporary head-script value once; keep initializer replay side-effect free.
let initialReset: ResetLocation | undefined
if (typeof window !== 'undefined') {
  initialReset = window.__capsulePasswordReset
  delete window.__capsulePasswordReset
}

export function initialPasswordResetLocation() {
  const current = passwordResetLocation(window.location.href)
  return current.token ? current : initialReset?.cleanPath === current.cleanPath ? initialReset : current
}

export function clearPasswordResetBootstrap() { initialReset = undefined }
