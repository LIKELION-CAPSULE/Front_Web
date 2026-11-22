import { DESKTOP_LOGIN_ASSETS } from './desktop-config'

/** Dev-only horizontal color SVG lockup for the desktop login window (respects H/4 clear space). */
export default function DesktopBrand() {
  return (
    <span className="desktop-login-brand">
      <img
        src={DESKTOP_LOGIN_ASSETS.logo.lockup}
        alt="CAPSULE"
        className="desktop-login-brand-img"
        draggable={false}
      />
    </span>
  )
}
