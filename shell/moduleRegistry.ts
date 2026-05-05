import { lazy, type ComponentType, type LazyExoticComponent } from 'react'
import type { ModuleManifest } from './types'

interface ManifestModule { default: ModuleManifest }
interface ComponentModule { default: ComponentType }

const manifestGlob = import.meta.glob<ManifestModule>(
  '../modules/*/manifest.ts',
  { eager: true },
)

const componentGlob = import.meta.glob<ComponentModule>(
  '../modules/*/index.tsx',
)

export interface RegisteredModule {
  manifest: ModuleManifest
  Component: LazyExoticComponent<ComponentType>
  folder: string
}

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
    const componentPath = `../modules/${folder}/index.tsx`
    const loader = componentGlob[componentPath]

    if (!loader) {
      console.warn(`[hud] module "${folder}" has manifest but no index.tsx`)
      continue
    }

    if (manifest.id !== folder) {
      console.warn(
        `[hud] module folder "${folder}" has manifest id "${manifest.id}" — they should match`,
      )
    }

    out.push({
      manifest,
      Component: lazy(loader as () => Promise<ComponentModule>),
      folder,
    })
  }

  return out
}

export const modules: RegisteredModule[] = buildRegistry()
