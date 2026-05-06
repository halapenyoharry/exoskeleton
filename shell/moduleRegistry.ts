import type {
  ModuleComponents,
  ModuleManifest,
  RegisteredModule,
} from './types'

interface ManifestModule { default: ModuleManifest }
type IndexModule = ModuleComponents

const manifestGlob = import.meta.glob<ManifestModule>(
  '../modules/*/manifest.ts',
  { eager: true },
)

const indexGlob = import.meta.glob<IndexModule>(
  '../modules/*/index.tsx',
  { eager: true },
)

function folderOf(path: string): string {
  const m = path.match(/\/modules\/([^/]+)\//)
  return m ? m[1] : ''
}

function buildRegistry(): RegisteredModule[] {
  const out: RegisteredModule[] = []

  for (const manifestPath in manifestGlob) {
    const folder = folderOf(manifestPath)
    if (!folder || folder === '_template') continue

    const manifest = manifestGlob[manifestPath].default
    const indexPath = `../modules/${folder}/index.tsx`
    const idx = indexGlob[indexPath]

    if (!idx) {
      console.warn(`[hud] module "${folder}" has manifest but no index.tsx`)
      continue
    }
    if (!idx.Main) {
      console.warn(`[hud] module "${folder}" must export a Main component`)
      continue
    }
    if (manifest.id !== folder) {
      console.warn(
        `[hud] module folder "${folder}" has manifest id "${manifest.id}" — they should match`,
      )
    }

    out.push({
      manifest,
      Provider: idx.Provider,
      Side: idx.Side,
      Main: idx.Main,
      Hud: idx.Hud,
    })
  }

  return out
}

export const modules: RegisteredModule[] = buildRegistry()
