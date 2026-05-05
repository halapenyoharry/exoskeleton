import type { ReactNode } from 'react'
import './HudLayer.css'

interface Props {
  children?: ReactNode
}

export default function HudLayer({ children }: Props) {
  return <div className="hud-layer">{children}</div>
}
