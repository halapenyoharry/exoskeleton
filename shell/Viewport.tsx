import { Suspense } from 'react'
import SceneLayer from './SceneLayer'
import HudLayer from './HudLayer'
import HudWidget from './HudWidget'
import Hotbar from './Hotbar'
import { modules } from './moduleRegistry'
import './Viewport.css'

export default function Viewport() {
  return (
    <div className="viewport">
      <div className="viewport__stage">
        <SceneLayer />
        <HudLayer>
          {modules.map(({ manifest, Component }) => (
            <HudWidget key={manifest.id} manifest={manifest}>
              <Suspense fallback={<div className="hud-widget__loading">loading…</div>}>
                <Component />
              </Suspense>
            </HudWidget>
          ))}
        </HudLayer>
      </div>
      <Hotbar />
    </div>
  )
}
