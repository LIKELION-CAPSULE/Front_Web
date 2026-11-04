import { useId } from 'react'
import { classroomClearRegions } from './policy'

export function MvpClassroomImage({ src, width, height, className, variant = 'group' }: {
  src: string
  width: number
  height: number
  className: string
  variant?: keyof typeof classroomClearRegions
}) {
  const id = useId()
  return (
    <svg aria-hidden="true" className={className} width={width} height={height}
      viewBox={`0 0 ${width} ${height}`} preserveAspectRatio={variant === 'banner' ? 'xMaxYMid slice' : 'xMidYMid meet'}>
      <defs>
        <filter id={`${id}-blur`} x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation={width * 0.016} />
        </filter>
        <filter id={`${id}-feather`} x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation={width * 0.012} />
        </filter>
        <mask id={`${id}-mask`} maskUnits="userSpaceOnUse" x="0" y="0" width={width} height={height}>
          <rect width={width} height={height} fill="white" />
          <g fill="black" filter={`url(#${id}-feather)`}>
            {variant === 'banner' && <rect x={-width} y={-height} width={width * 1.38} height={height * 3} />}
            <polygon points={classroomClearRegions[variant].map(([x, y]) => `${x * width},${y * height}`).join(' ')} />
          </g>
        </mask>
      </defs>
      <image href={src} width={width} height={height} />
      <image href={src} width={width} height={height} filter={`url(#${id}-blur)`} mask={`url(#${id}-mask)`} />
    </svg>
  )
}
