import { DESKTOP_LOGIN_ASSETS } from './desktop-config'
import './desktop.css'

/** Horizontal color SVG lockup at the top of the login / password-reset forms (respects H/4 clear space). */
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
