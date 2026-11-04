import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import assert from 'node:assert/strict'

const root = new URL('../', import.meta.url)
const tokens = JSON.parse(await readFile(new URL('docs/DESIGN_TOKENS.json', root), 'utf8'))
function fontStack(key) {
  const { family, fallback } = tokens.font[key]
  return [family, ...fallback].map(name => /^(sans-serif|serif)$/.test(name) ? name : `'${name}'`).join(', ')
}
function luminance(hex) {
  assert.match(hex, /^#[0-9a-f]{6}$/i, 'Static contrast checks require opaque RGB colors')
  const channels = hex.slice(1).match(/../g).map(value => parseInt(value, 16) / 255)
    .map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4)
  return channels.reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0)
}
for (const sample of tokens.contrast.cases) {
  const foreground = tokens.color[sample.foreground]?.value ?? sample.foreground
  const background = tokens.color[sample.background]?.value ?? sample.background
  assert.equal(foreground, sample.foregroundHex, `${sample.name}: stale foreground`)
  assert.equal(background, sample.backgroundHex, `${sample.name}: stale background`)
  const [low, high] = [luminance(foreground), luminance(background)].sort((a, b) => a - b)
  const ratio = (high + .05) / (low + .05)
  assert.ok(Math.abs(ratio - sample.ratio) < 1e-10, `${sample.name}: stale contrast ratio`)
  assert.equal(ratio >= sample.minimum, sample.expectedPass, `${sample.name}: contrast requirement changed`)
  assert.equal(sample.passes, sample.expectedPass, `${sample.name}: stale result`)
}
const css = ['/* Generated from docs/DESIGN_TOKENS.json. Run npm run tokens:sync. */', '@theme {',
  `  --font-sans: ${fontStack('sans')};`,
  `  --font-story: ${fontStack('story')};`,
  ...Object.entries(tokens.color).map(([name, token]) => `  --color-${name}: ${token.value};`),
  ...Object.entries(tokens.typography).flatMap(([name, t]) => [
    `  --text-${name}: ${t.fontSizePx}px;`,
    `  --text-${name}--line-height: ${t.lineHeightPx}px;`,
  ]),
  '  --spacing-section: 40px;', '  --spacing-content: 24px;', '  --spacing-content-compact: 16px;',
  '  --spacing-panel: 24px;', '  --spacing-panel-compact: 20px;', '  --spacing-panel-roomy: 32px;',
  '  --radius-control: 12px;', '  --radius-card: 20px;', '  --radius-panel: 24px;', '}', '',
  '@media (max-width: 639px) { :root {',
  ...Object.entries(tokens.typography).filter(([, t]) => t.smallViewport).flatMap(([name, t]) => [`  --text-${name}: ${t.smallViewport.fontSizePx}px;`, `  --text-${name}--line-height: ${t.smallViewport.lineHeightPx}px;`]),
  '} }', '',
  `:root { --glass-background: ${tokens.surfaces.glass.background}; --floating-shadow: ${tokens.surfaces.dialogShadow}; --popover-shadow: ${tokens.surfaces.popoverShadow}; }`, '',
  ...Object.entries(tokens.typography).flatMap(([name, t]) => [
    `@utility type-${name} {`,
    `  font-family: var(--font-${t.fontFamily});`,
    `  font-size: var(--text-${name});`,
    `  line-height: var(--text-${name}--line-height);`,
    `  font-weight: ${t.fontWeight};`,
    `  letter-spacing: ${t.letterSpacingEm}em;`,
    ...(t.tabularNums ? ['  font-variant-numeric: tabular-nums lining-nums;'] : []),
    '}', '',
  ]),
].join('\n')
const runtime = `// Generated from docs/DESIGN_TOKENS.json. Run npm run tokens:sync.\nexport const designColors = ${JSON.stringify(Object.fromEntries(Object.entries(tokens.color).map(([name, t]) => [name, t.value])), null, 2)} as const\n\nexport const designPalette = ${JSON.stringify(tokens.palette, null, 2)} as const\n\nexport const designTypography = ${JSON.stringify(tokens.typography, null, 2)} as const\n`
const outputs = [['src/styles/design-tokens.css', css], ['src/shared/design/tokens.ts', runtime]]
// Landing_Page keeps its own design; generate tokens only within Front_Web.
for (const [path, content] of outputs) {
  const url = new URL(path, root)
  if (process.argv.includes('--check')) {
    if (await readFile(url, 'utf8').catch(() => '') !== content) throw new Error(`${path} is stale. Run npm run tokens:sync.`)
  } else {
    await mkdir(fileURLToPath(new URL('.', url)), { recursive: true })
    await writeFile(url, content)
  }
}
