import type { AvatarSettings } from '@/features/demo/types'

const hairColors = [
  '#45405f',
  '#efd5b2',
  '#865e5d',
  '#292c49',
  '#e4a8b7',
  '#8a74bd',
  '#b37851',
  '#7c9b9b',
]
const shirtColors = [
  '#a88be9',
  '#c6d8c5',
  '#eca0a4',
  '#8ba5d3',
  '#dbc68a',
  '#afb8db',
  '#d6a68c',
  '#83bca9',
]

/** Code-native illustration: customization needs no generated or external portrait. */
export function AvatarIllustration({ settings }: { settings: AvatarSettings }) {
  const hair = hairColors[settings.hair % hairColors.length]
  const shirt = shirtColors[settings.outfit % shirtColors.length]
  const longHair = settings.hair % 2 === 1
  return (
    <svg viewBox="0 0 240 280" fill="none" aria-hidden="true" className="avatar-illustration">
      <ellipse cx="120" cy="262" rx="97" ry="10" fill="#0c1017" opacity=".14" />
      <path d="M50 261v-38a70 70 0 0 1 140 0v38" fill={shirt} />
      <path d="m95 160 25 28 25-28" fill="#ffe2cd" />
      <path d="m92 170 28 18-19 22-17-35m64-5-28 18 19 22 17-35" fill="white" opacity=".8" />
      <path
        d={
          longHair
            ? 'M58 94a62 62 0 0 1 124 0v92l-39-14H90l-32 14Z'
            : 'M58 94a62 62 0 0 1 124 0v25H58Z'
        }
        fill={hair}
      />
      <ellipse cx="120" cy="111" rx={48 - (settings.appearance % 4)} ry="55" fill="#ffe2cd" />
      <path
        d={
          settings.hair % 3 === 0
            ? 'M66 94c0-60 108-64 108 0-30-2-44-15-49-29-7 18-26 28-59 29Z'
            : 'M67 93c-2-60 109-61 107 9-24-10-45-14-67-39-7 22-23 32-40 30Z'
        }
        fill={hair}
      />
      <path d="M99 112v5m42-5v5" stroke="#453e54" strokeWidth="5" strokeLinecap="round" />
      <ellipse cx="90" cy="130" rx="8" ry="4" fill="#edb3ab" />
      <ellipse cx="150" cy="130" rx="8" ry="4" fill="#edb3ab" />
      <path
        d={settings.appearance % 2 ? 'M111 135q9 12 18 0Z' : 'M112 137q8 7 16 0'}
        stroke="#ab746d"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      {settings.appearance > 3 && (
        <g stroke="#51485e" strokeWidth="2.5">
          <rect x="85" y="103" width="27" height="22" rx="8" />
          <rect x="128" y="103" width="27" height="22" rx="8" />
          <path d="M112 110h16" />
        </g>
      )}
      <path d="M72 238h96v31H72Z" fill="#f6f0e8" />
      <path d="m120 239-42-11v33l42 10 42-10v-33Z" fill="#e4d5f7" />
      <path d="M120 239v32" stroke="#9c86b9" strokeWidth="2" />
      <ellipse cx="73" cy="242" rx="12" ry="17" fill="#ffe2cd" transform="rotate(-25 73 242)" />
      <ellipse cx="167" cy="242" rx="12" ry="17" fill="#ffe2cd" transform="rotate(25 167 242)" />
    </svg>
  )
}
