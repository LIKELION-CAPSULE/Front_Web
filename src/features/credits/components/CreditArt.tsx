import hero from '@/assets/credits/credit-hero.webp'

/**
 * Decorative art for 내 크레딧 (src/assets/credits/README.md). aria-hidden: the numbers beside it carry the meaning.
 */

/** The balance card: the open capsule with its coins and orbit. */
export function CreditHeroArt() {
  return (
    <div className="credit-hero-art" aria-hidden="true">
      <img src={hero} width={947} height={691} alt="" draggable={false} />
    </div>
  )
}
