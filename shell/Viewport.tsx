import { Children, type ReactNode } from 'react'
import HudLayer from './HudLayer'
import './Viewport.css'

interface Props {
  children: ReactNode
}

export default function Viewport({ children }: Props) {
  const kids = Children.toArray(children)
  const main = kids[0] ?? null
  const hud = kids[1] ?? null

  return (
    <div className="viewport">
      <div className="viewport__main">{main}</div>
      {hud ? <HudLayer>{hud}</HudLayer> : null}
    </div>
  )
}
