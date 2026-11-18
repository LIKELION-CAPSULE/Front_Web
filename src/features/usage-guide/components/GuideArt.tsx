import { GUIDE_COLORS } from '../guide-timeline'

const PANEL = '#191823'
const BODY = '#1C1A24'
const SOFT = '#292733'

/**
 * The desk, monitor, notebook and pencil drawn flat for small screens and reduced motion. The monitor shows what
 * each step is about, and step 3 brings the notebook forward, echoing the 3D version without any WebGL.
 */
export function GuideArt({ step }: { step: number }) {
  return (
    <svg className="guide-art" data-step={step} viewBox="0 0 360 220" aria-hidden="true">
      <rect x="10" y="186" width="340" height="8" rx="4" fill="#2A2534" />
      <rect x="150" y="164" width="16" height="22" fill={BODY} />
      <rect x="122" y="182" width="72" height="5" rx="2.5" fill={BODY} />
      <rect x="58" y="44" width="200" height="124" rx="8" fill={BODY} />
      <rect x="65" y="51" width="186" height="104" rx="4" fill={PANEL} />

      <g className="guide-art-screen" data-screen="0">
        <rect x="75" y="60" width="70" height="6" rx="3" fill="#403E4B" />
        {[0, 1, 2].map((i) => (
          <rect key={i} x={75 + i * 58} y="74" width="50" height="70" rx="5" fill={i === 1 ? GUIDE_COLORS.purple : SOFT} opacity={i === 1 ? 0.7 : 1} />
        ))}
      </g>
      <g className="guide-art-screen" data-screen="1">
        <circle cx="158" cy="98" r="18" fill={GUIDE_COLORS.lavender} />
        <path d="M124 155 q34 -44 68 0 Z" fill={GUIDE_COLORS.purple} />
        <rect x="186" y="62" width="58" height="22" rx="11" fill={GUIDE_COLORS.paper} />
        <path d="M194 84 l-6 8 l12 -8 Z" fill={GUIDE_COLORS.paper} />
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={203 + i * 12} cy="73" r="2.4" fill={GUIDE_COLORS.ink} />
        ))}
        <rect x="74" y="128" width="34" height="20" rx="4" fill={SOFT} />
        <circle cx="82" cy="135" r="2.5" fill="#FF6B7A" />
      </g>
      <g className="guide-art-screen" data-screen="2">
        <rect x="82" y="62" width="58" height="82" rx="7" fill={GUIDE_COLORS.purple} />
        <rect x="88" y="68" width="46" height="56" rx="4" fill={GUIDE_COLORS.lavender} />
        <rect x="152" y="86" width="86" height="8" rx="4" fill={SOFT} />
        <rect x="152" y="86" width="58" height="8" rx="4" fill={GUIDE_COLORS.purple} />
        <path d="M160 116 c0 -6 8 -6 8 0 c0 -6 8 -6 8 0 c0 6 -8 10 -8 12 c0 -2 -8 -6 -8 -12 Z" fill="#FF8FB1" />
      </g>
      <g className="guide-art-screen" data-screen="3">
        <circle cx="158" cy="103" r="26" fill={GUIDE_COLORS.purple} />
        <path d="M151 91 L170 103 L151 115 Z" fill={GUIDE_COLORS.paper} />
      </g>

      <rect x="270" y="160" width="22" height="26" rx="4" fill={GUIDE_COLORS.lavender} />

      <g className="guide-art-float">
        <g transform="translate(272 40) rotate(-12)">
          <rect x="0" y="0" width="34" height="46" rx="3" fill={GUIDE_COLORS.purple} />
          <rect x="36" y="0" width="34" height="46" rx="3" fill={GUIDE_COLORS.purple} />
          <rect x="2" y="2" width="31" height="42" rx="2" fill={GUIDE_COLORS.paper} />
          <rect x="37" y="2" width="31" height="42" rx="2" fill={GUIDE_COLORS.paper} />
          {[12, 20, 28, 36].map((y) => (
            <path key={y} d={`M41 ${y} q6 -4 12 0 t12 0`} stroke={GUIDE_COLORS.ink} strokeWidth="1.2" fill="none" opacity="0.7" />
          ))}
        </g>
        <g transform="translate(330 56) rotate(35)">
          <rect x="-3" y="0" width="6" height="18" fill={GUIDE_COLORS.lavender} />
          <rect x="-3" y="18" width="6" height="18" fill={GUIDE_COLORS.purple} />
          <path d="M-3 36 L0 44 L3 36 Z" fill="#E9CFA4" />
        </g>
      </g>
    </svg>
  )
}
