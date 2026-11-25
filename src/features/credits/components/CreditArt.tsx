import hero from '@/assets/credits/credit-hero.webp'
import attendance from '@/assets/credits/credit-attendance.webp'
import invite from '@/assets/credits/credit-invite.webp'

/**
 * Decorative art for 내 크레딧 (src/assets/credits/README.md). All of it is aria-hidden: the numbers beside it carry
 * the meaning.
 */

/** The balance card: the open capsule with its coins and orbit. */
export function CreditHeroArt() {
  return (
    <div className="credit-hero-art" aria-hidden="true">
      <img src={hero} width={947} height={691} alt="" draggable={false} />
    </div>
  )
}

/** 출석 보상: the calendar with a check. */
export function CreditAttendanceArt() {
  return (
    <div className="credit-card-art" aria-hidden="true">
      <img src={attendance} width={480} height={431} alt="" draggable={false} />
    </div>
  )
}

/** 친구 초대: the gift box. */
export function CreditInviteArt() {
  return (
    <div className="credit-card-art" aria-hidden="true">
      <img src={invite} width={480} height={471} alt="" draggable={false} />
    </div>
  )
}
