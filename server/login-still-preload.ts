import type { Plugin } from 'vite'

/** /login's first picture: the dozing 채린 still (DozeMateStage), its LCP element. */
export const LOGIN_STILL_SOURCE = 'src/assets/characters/chaerin-v2/chaerin-v2-doze.webp'

/**
 * The inline script for index.html: on the login layout's paths (/login, /login/kakao-terms; after the reset-link
 * script above has moved /login?token to /password/reset) and not on a phone (the mobile notice draws the same still
 * with a plain <img>, so a CORS preload would not be reused there), it asks for the still at once with high priority.
 * `crossorigin="anonymous"` matches the stage's <img crossorigin> and its CSS mask (masks always load in CORS mode),
 * so the one download serves all three. Before, the still was found only after the app bundle ran.
 */
export function loginStillPreloadScript(href: string): string {
  return `<script>
      // /login's LCP picture (the dozing 채린, DozeMateStage): fetched while the HTML loads, high priority (server/login-still-preload.ts).
      (() => {
        if (!/^\\/login(\\/kakao-terms)?\\/?$/.test(location.pathname)) return
        const phone = matchMedia('(pointer: coarse) and (hover: none)').matches && Math.min(innerWidth, innerHeight, screen.width || innerWidth, screen.height || innerHeight) < 600
        if (phone) return
        const link = document.createElement('link')
        link.rel = 'preload'
        link.as = 'image'
        link.href = ${JSON.stringify(href)}
        link.crossOrigin = 'anonymous'
        link.fetchPriority = 'high'
        document.head.appendChild(link)
      })()
    </script>`
}

type BundleLike = Record<string, { type: string; fileName: string; originalFileNames?: readonly string[]; names?: readonly string[] }>

/** The built file of a source asset (its hashed name under assets/), or null when it is not in the bundle. */
export function builtAssetFile(bundle: BundleLike, source: string): string | null {
  const name = source.split('/').pop()!
  for (const output of Object.values(bundle)) {
    if (output.type !== 'asset') continue
    if (output.originalFileNames?.some(file => file.replace(/\\/g, '/').endsWith(source))) return output.fileName
  }
  const stem = name.replace(/\.[^.]+$/, '')
  const byName = Object.values(bundle).find(output => output.type === 'asset' && (output.names?.includes(name) || new RegExp(`^assets/${stem}-[\\w-]+\\.webp$`).test(output.fileName)))
  return byName?.fileName ?? null
}

/** Puts the preload script into index.html with the URL the page itself will use (dev: the source path; build: the hashed file). */
export function loginStillPreload(): Plugin {
  let base = '/'
  return {
    name: 'capsule-login-still-preload',
    configResolved(config) { base = config.base },
    transformIndexHtml: {
      order: 'post',
      handler(html, ctx) {
        const file = ctx.bundle ? builtAssetFile(ctx.bundle as unknown as BundleLike, LOGIN_STILL_SOURCE) : null
        if (ctx.bundle && !file) throw new Error(`login-still-preload: ${LOGIN_STILL_SOURCE} is not in the build`)
        const href = file ? `${base}${file}` : `/${LOGIN_STILL_SOURCE}`
        return html.replace('<!-- login-still-preload -->', loginStillPreloadScript(href))
      },
    },
  }
}
