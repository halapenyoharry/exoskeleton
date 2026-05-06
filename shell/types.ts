import type { ComponentType, ReactNode } from 'react'

export interface ModuleManifest {
  id: string
  title: string
}

export interface ModuleComponents {
  Provider?: ComponentType<{ children: ReactNode }>
  Side?: ComponentType
  Main: ComponentType
  Hud?: ComponentType
}

export interface RegisteredModule extends ModuleComponents {
  manifest: ModuleManifest
}
