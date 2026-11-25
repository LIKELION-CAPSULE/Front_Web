import { readFileSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import type { Plugin, ResolvedConfig } from 'vite'

type ManifestModel = { file: string; delivery?: string }

/** Exported for tests: the model files `public/models/manifest.json` marks `"delivery": "remote"`. */
export function remoteModelFiles(manifestPath = new URL('../public/models/manifest.json', import.meta.url)) {
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as { models: ManifestModel[] }
  // Only plain file names, so nothing outside `models/` can be removed.
  return manifest.models.filter((model) => model.delivery === 'remote' && /^[\w.-]+$/.test(model.file)).map((model) => model.file)
}

/**
 * Drops the behavior-detection models from the build output. Vite copies all of `public/` into `dist`; these files stay
 * there only for the dev server, and production downloads them from Google (src/features/media/vision-models.ts).
 */
export function remoteVisionModelsPlugin(): Plugin {
  let config: ResolvedConfig
  return {
    name: 'capsule-remote-vision-models',
    apply: 'build',
    configResolved: (resolved) => { config = resolved },
    async closeBundle() {
      if (!config.build.copyPublicDir) return
      const models = resolve(config.root, config.build.outDir, 'models')
      for (const file of remoteModelFiles()) await rm(resolve(models, file), { force: true })
    },
  }
}
