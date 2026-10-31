import type { SVGProps } from 'react'
import './icon-motion.css'

const paths = {
  search: 'm21 21-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z',
  home: 'm3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z',
  chart: 'M4 20V11m8 9V4m8 16v-6',
  heart:
    'M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z',
  arrow: 'M4 12h16m-6-6 6 6-6 6',
  chevron: 'm9 5 7 7-7 7',
  chevronsVertical: 'm8 9 4-4 4 4m-8 6 4 4 4-4',
  bookmark: 'M6 3h12v18l-6-4-6 4Z',
  book: 'M12 5C8 2 3 4 3 4v15s5-2 9 1c4-3 9-1 9-1V4s-5-2-9 1Zm0 0v15',
  clock: 'M12 8v5l3 2M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  calendar: 'M8 2v4m8-4v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z',
  sparkle: 'm12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z',
  coin: 'M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v12M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  play: 'm9 5 11 7-11 7Z',
  pause: 'M8 5v14M16 5v14',
  stop: 'M7 5h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z',
  zoomIn: 'm21 21-5.1-5.1M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0ZM10 7v6m-3-3h6',
  chat: 'M21 11a9 9 0 0 1-9 9 10 10 0 0 1-4-.9L3 21l1.9-5A9 9 0 1 1 21 11Z',
  gift: 'M3 8h18v4H3Zm2 4v9h14v-9M12 8v13m0-13H7a3 3 0 1 1 3-3Zm0 0h5a3 3 0 1 0-3-3Z',
  headphones: 'M3 15v-3a9 9 0 0 1 18 0v3M3 13h4v8H4a1 1 0 0 1-1-1Zm18 0h-4v8h3a1 1 0 0 0 1-1Z',
  check: 'm5 12 4 4L19 6',
  help: 'M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3m.08 4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z',
  camera: 'M8 6 9 3h6l1 3h5v14H3V6Zm8 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z',
  video: 'M4 6h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2Zm13 4 5-3v10l-5-3',
  videoOff: 'm2 2 20 20M7 6h8a2 2 0 0 1 2 2v3m0-1 5-3v10l-5-3M3 6a2 2 0 0 0-1 2v8a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2',
  microphone: 'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0ZM5 10v2a7 7 0 0 0 14 0v-2M12 19v3m-4 0h8',
  microphoneOff: 'm2 2 20 20M9 5a3 3 0 0 1 6 0v6M9 9v3a3 3 0 0 0 5 2M5 10v2a7 7 0 0 0 12 5m2-5v-2M12 19v3m-4 0h8',
  user: 'M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2',
  sliders: 'M4 3v5m0 4v9m8-18v11m0 4v3m8-18v2m0 4v12M1 8h6m2 6h6m2-9h6',
  expand: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5',
  shrink: 'M3 8h5V3m8 0v5h5M3 16h5v5m8 0v-5h5',
  moon: 'M21 13a9 9 0 0 1-10-10 9 9 0 1 0 10 10Z',
  lock: 'M6 10h12v11H6Zm2 0V6a4 4 0 0 1 8 0v4',
  close: 'm6 6 12 12M6 18 18 6',
  ban: 'M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0ZM4.9 4.9l14.2 14.2',
  droplet: 'M12 2.7 6.3 8.4a8 8 0 1 0 11.4 0Z',
  image: 'M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm-2 12 5-5 4 4 3-3 6 6M17 9.5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z',
} as const

export type IconName = keyof typeof paths
export function Icon({
  name,
  size = 20,
  motion,
  ...props
}: SVGProps<SVGSVGElement> & { name: IconName; size?: number; motion?: 'draw' | 'nudge' | 'pulse' }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-icon-motion={motion}
      {...props}
    >
      <path d={paths[name]} pathLength={motion === 'draw' ? 1 : undefined} />
    </svg>
  )
}
