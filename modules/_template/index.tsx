import type { ReactNode } from 'react'

export function Provider({ children }: { children: ReactNode }) {
  return <>{children}</>
}

export function Main() {
  return (
    <div style={{ padding: 24, color: 'var(--text)' }}>
      <p>main slot — fills the viewport corner-to-corner</p>
    </div>
  )
}

export function Side() {
  return (
    <div style={{ padding: 16, color: 'var(--text-dim)' }}>
      <p>side slot — optional, owned by this module</p>
    </div>
  )
}
