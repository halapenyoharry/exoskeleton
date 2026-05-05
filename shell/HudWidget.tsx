import { useState, type ReactNode } from 'react'
import type { ModuleManifest } from './types'
import './HudWidget.css'

interface Props {
  manifest: ModuleManifest
  children: ReactNode
}

export default function HudWidget({ manifest, children }: Props) {
  const [closed, setClosed] = useState(false)
  if (closed) return null

  const style: React.CSSProperties = {
    width: manifest.w,
    height: manifest.h,
    transform: `translate(calc(-50% + ${manifest.x}px), calc(-50% + ${manifest.y}px))`,
  }

  return (
    <section className="hud-widget" style={style} data-module-id={manifest.id}>
      <header className="hud-widget__bar" data-drag-handle>
        <span className="hud-widget__title">{manifest.title}</span>
        <button
          className="hud-widget__close"
          onClick={() => setClosed(true)}
          aria-label="Close"
          title="Close"
        >
          ×
        </button>
      </header>
      <div className="hud-widget__body">{children}</div>
    </section>
  )
}
