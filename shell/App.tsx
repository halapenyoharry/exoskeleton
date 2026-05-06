import { Fragment, useEffect, useState } from 'react'
import Viewport from './Viewport'
import BottomBar from './BottomBar'
import { modules } from './moduleRegistry'
import './App.css'

const NoProvider = ({ children }: { children: React.ReactNode }) => (
  <Fragment>{children}</Fragment>
)

export default function App() {
  const [sideOpen, setSideOpen] = useState(true)
  const [activeId, setActiveId] = useState<string>(
    () => modules[0]?.manifest.id ?? '',
  )

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault()
        setSideOpen(v => !v)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const view = modules.find(m => m.manifest.id === activeId)

  if (!view) {
    return (
      <div className="frame">
        <div className="empty">no modules registered</div>
      </div>
    )
  }

  const Provider = view.Provider ?? NoProvider
  const showSide = sideOpen && Boolean(view.Side)

  return (
    <Provider>
      <div className="frame" data-side={showSide ? 'open' : 'closed'}>
        {showSide && view.Side && (
          <aside className="frame__side">
            <view.Side />
          </aside>
        )}
        <main className="frame__main">
          <Viewport>
            <view.Main />
            {view.Hud ? <view.Hud /> : null}
          </Viewport>
        </main>
        <BottomBar
          viewTitle={view.manifest.title.toLowerCase()}
          sideToggleLabel={view.Side ? 'side' : null}
          sideOpen={sideOpen}
          onToggleSide={() => setSideOpen(v => !v)}
          onPickView={
            modules.length > 1
              ? () => {
                  const i = modules.findIndex(m => m.manifest.id === activeId)
                  setActiveId(modules[(i + 1) % modules.length].manifest.id)
                }
              : undefined
          }
        />
      </div>
    </Provider>
  )
}
