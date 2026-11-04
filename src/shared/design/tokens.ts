// Generated from docs/DESIGN_TOKENS.json. Run npm run tokens:sync.
export const designColors = {
  "canvas": "#0F0E17",
  "panel": "#191823",
  "surface": "#292733",
  "surface-raised": "#292733",
  "surface-soft": "#0F0E17",
  "surface-hover": "#403E4B",
  "ink": "#FAFAFD",
  "muted": "#CAC9D4",
  "subtle": "#A4A3B0",
  "placeholder": "#A4A3B0",
  "text-disabled": "#807E8D",
  "on-solid": "#FFFFFF",
  "divider": "#403E4B",
  "input-border": "#807E8D",
  "focus-ring": "#AC95F8",
  "primary": "#7E54F6",
  "primary-hover": "#6B2CD1",
  "primary-active": "#502D96",
  "text-accent": "#C4B9F3",
  "text-accent-hover": "#D9D5F1",
  "primary-soft": "#241C3E",
  "primary-soft-hover": "#392766",
  "primary-soft-active": "#502D96",
  "selected": "#241C3E",
  "selected-text": "#C4B9F3",
  "control": "#403E4B",
  "control-hover": "#5E5C69",
  "control-active": "#292733",
  "disabled": "#292733",
  "affection": "#F971B3",
  "affection-text": "#F4A9C9",
  "affection-soft": "#341925",
  "overlay": "#0F0E17B8",
  "transparent": "#00000000",
  "success": "#5BE09C",
  "success-bg": "#173126",
  "warning": "#F4B95F",
  "warning-bg": "#352A18",
  "danger": "#F4AFA8",
  "danger-bg": "#3D2028",
  "danger-bg-hover": "#4A242E",
  "danger-bg-active": "#572833",
  "danger-solid": "#D62332",
  "danger-solid-hover": "#B51E2B",
  "danger-solid-active": "#941927",
  "info": "#8AD0F4",
  "info-bg": "#172D39",
  "floating": "#403E4B",
  "floating-hover": "#5E5C69"
} as const

export const designPalette = {
  "violet": {
    "50": "#F5F4F8",
    "100": "#EAE8F3",
    "200": "#D9D5F1",
    "300": "#C4B9F3",
    "400": "#AC95F8",
    "500": "#966DFC",
    "600": "#7E54F6",
    "700": "#6B2CD1",
    "800": "#502D96",
    "900": "#392766",
    "950": "#241C3E"
  },
  "blush": {
    "50": "#F8F4F5",
    "100": "#F3E5EB",
    "200": "#F1CEDC",
    "300": "#F4A9C9",
    "400": "#F971B3",
    "500": "#E24C9A",
    "600": "#C62F82",
    "700": "#A12569",
    "800": "#772650",
    "900": "#53223A",
    "950": "#341925"
  },
  "neutral": {
    "50": "#FAFAFD",
    "100": "#F0EFF5",
    "200": "#E1E0E8",
    "300": "#CAC9D4",
    "400": "#A4A3B0",
    "500": "#807E8D",
    "600": "#5E5C69",
    "700": "#403E4B",
    "800": "#292733",
    "900": "#191823",
    "950": "#0F0E17"
  },
  "utility": {
    "white": "#FFFFFF",
    "transparent": "#00000000",
    "overlay": "#0F0E17B8"
  },
  "status": {
    "success": "#5BE09C",
    "success-bg": "#173126",
    "warning": "#F4B95F",
    "warning-bg": "#352A18",
    "danger": "#F4AFA8",
    "danger-bg": "#3D2028",
    "danger-bg-hover": "#4A242E",
    "danger-bg-active": "#572833",
    "danger-solid": "#D62332",
    "danger-solid-hover": "#B51E2B",
    "danger-solid-active": "#941927",
    "info": "#8AD0F4",
    "info-bg": "#172D39"
  }
} as const

export const designTypography = {
  "hero-title": {
    "fontFamily": "sans",
    "fontSizePx": 48,
    "lineHeightPx": 60,
    "fontWeight": 700,
    "letterSpacingEm": -0.02,
    "smallViewport": {
      "fontSizePx": 32,
      "lineHeightPx": 42
    }
  },
  "page-title": {
    "fontFamily": "sans",
    "fontSizePx": 30,
    "lineHeightPx": 40,
    "fontWeight": 700,
    "letterSpacingEm": -0.02,
    "smallViewport": {
      "fontSizePx": 26,
      "lineHeightPx": 36
    }
  },
  "section-title": {
    "fontFamily": "sans",
    "fontSizePx": 20,
    "lineHeightPx": 28,
    "fontWeight": 700,
    "letterSpacingEm": -0.01
  },
  "dialog-title": {
    "fontFamily": "sans",
    "fontSizePx": 20,
    "lineHeightPx": 28,
    "fontWeight": 700,
    "letterSpacingEm": -0.01
  },
  "card-title": {
    "fontFamily": "sans",
    "fontSizePx": 16,
    "lineHeightPx": 24,
    "fontWeight": 600,
    "letterSpacingEm": 0
  },
  "body": {
    "fontFamily": "sans",
    "fontSizePx": 16,
    "lineHeightPx": 26,
    "fontWeight": 400,
    "letterSpacingEm": 0
  },
  "body-compact": {
    "fontFamily": "sans",
    "fontSizePx": 14,
    "lineHeightPx": 22,
    "fontWeight": 400,
    "letterSpacingEm": 0
  },
  "label": {
    "fontFamily": "sans",
    "fontSizePx": 14,
    "lineHeightPx": 20,
    "fontWeight": 500,
    "letterSpacingEm": 0
  },
  "control": {
    "fontFamily": "sans",
    "fontSizePx": 16,
    "lineHeightPx": 24,
    "fontWeight": 400,
    "letterSpacingEm": 0
  },
  "button": {
    "fontFamily": "sans",
    "fontSizePx": 16,
    "lineHeightPx": 24,
    "fontWeight": 600,
    "letterSpacingEm": 0
  },
  "button-compact": {
    "fontFamily": "sans",
    "fontSizePx": 14,
    "lineHeightPx": 20,
    "fontWeight": 600,
    "letterSpacingEm": 0
  },
  "button-micro": {
    "fontFamily": "sans",
    "fontSizePx": 12,
    "lineHeightPx": 18,
    "fontWeight": 600,
    "letterSpacingEm": 0
  },
  "caption": {
    "fontFamily": "sans",
    "fontSizePx": 12,
    "lineHeightPx": 18,
    "fontWeight": 400,
    "letterSpacingEm": 0
  },
  "stat": {
    "fontFamily": "sans",
    "fontSizePx": 32,
    "lineHeightPx": 40,
    "fontWeight": 700,
    "letterSpacingEm": 0,
    "tabularNums": true
  },
  "timer": {
    "fontFamily": "sans",
    "fontSizePx": 32,
    "lineHeightPx": 40,
    "fontWeight": 700,
    "letterSpacingEm": 0,
    "tabularNums": true
  },
  "timer-compact": {
    "fontFamily": "sans",
    "fontSizePx": 22,
    "lineHeightPx": 30,
    "fontWeight": 700,
    "letterSpacingEm": 0,
    "tabularNums": true
  },
  "story-title": {
    "fontFamily": "story",
    "fontSizePx": 32,
    "lineHeightPx": 40,
    "fontWeight": 700,
    "letterSpacingEm": 0,
    "smallViewport": {
      "fontSizePx": 26,
      "lineHeightPx": 36
    },
    "usage": [
      "room-detail-banner-title",
      "capsule-story-title"
    ],
    "wrapping": {
      "allowMultipleLines": true,
      "wordBreak": "keep-all",
      "overflowWrap": "anywhere",
      "truncate": false
    }
  },
  "story-quote": {
    "fontFamily": "story",
    "fontSizePx": 24,
    "lineHeightPx": 36,
    "fontWeight": 500,
    "letterSpacingEm": 0,
    "smallViewport": {
      "fontSizePx": 22,
      "lineHeightPx": 34
    }
  },
  "home-greeting": {
    "fontFamily": "sans",
    "fontSizePx": 16,
    "lineHeightPx": 24,
    "fontWeight": 500,
    "letterSpacingEm": 0,
    "smallViewport": {
      "fontSizePx": 14,
      "lineHeightPx": 22
    }
  }
} as const
