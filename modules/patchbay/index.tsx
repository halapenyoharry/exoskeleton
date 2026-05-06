import {
  createContext,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import styles from './patchbay.module.css'

interface Source { id: string; label: string }
interface Target { id: string; label: string }
interface Edge { id: string; source_id: string; target_id: string }

const defaultSources: Source[] = [
  { id: 's1', label: 'raw source 1' },
  { id: 's2', label: 'raw source 2' },
  { id: 's3', label: 'raw source 3' },
]

const defaultTargets: Target[] = [
  { id: 't1', label: 'target parameter a' },
  { id: 't2', label: 'target parameter b' },
  { id: 't3', label: 'target parameter c' },
]

interface Ctx {
  sources: Source[]
  targets: Target[]
  edges: Edge[]
  addEdge: (sourceId: string, targetId: string) => void
  clearEdges: () => void
}

const PatchbayCtx = createContext<Ctx | null>(null)

function usePatchbay(): Ctx {
  const v = useContext(PatchbayCtx)
  if (!v) throw new Error('PatchbayCtx missing — use the module Provider')
  return v
}

export function Provider({ children }: { children: ReactNode }) {
  const [edges, setEdges] = useState<Edge[]>([])

  const value = useMemo<Ctx>(
    () => ({
      sources: defaultSources,
      targets: defaultTargets,
      edges,
      addEdge: (source_id, target_id) => {
        const id = `edge_${source_id}_${target_id}`
        setEdges(prev =>
          prev.some(e => e.source_id === source_id && e.target_id === target_id)
            ? prev
            : [...prev, { id, source_id, target_id }],
        )
      },
      clearEdges: () => setEdges([]),
    }),
    [edges],
  )

  return <PatchbayCtx.Provider value={value}>{children}</PatchbayCtx.Provider>
}

export function Main() {
  const { sources, targets, edges, addEdge } = usePatchbay()
  const [activeSource, setActiveSource] = useState<string | null>(null)
  const [coords, setCoords] = useState<Record<string, { x: number; y: number }>>({})
  const ref = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const rect = el.getBoundingClientRect()
      const next: Record<string, { x: number; y: number }> = {}
      el.querySelectorAll<HTMLElement>('[data-port-id]').forEach(p => {
        const r = p.getBoundingClientRect()
        const id = p.dataset.portId
        if (!id) return
        next[id] = {
          x: r.left - rect.left + r.width / 2,
          y: r.top - rect.top + r.height / 2,
        }
      })
      setCoords(next)
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [sources, targets])

  const onTarget = (targetId: string) => {
    if (!activeSource) return
    addEdge(activeSource, targetId)
    setActiveSource(null)
  }

  return (
    <div ref={ref} className={styles.graph}>
      <svg className={styles.svg}>
        {edges.map(e => {
          const a = coords[e.source_id]
          const b = coords[e.target_id]
          if (!a || !b) return null
          return (
            <line
              key={e.id}
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              className={styles.line}
            />
          )
        })}
      </svg>

      <div className={styles.column}>
        {sources.map(src => (
          <div key={src.id} className={styles.row}>
            <div className={styles.node}>{src.label}</div>
            <button
              type="button"
              data-port-id={src.id}
              onClick={() => setActiveSource(src.id)}
              className={`${styles.port} ${styles.portSource} ${
                activeSource === src.id ? styles.portActive : ''
              }`}
              aria-label={`source ${src.label}`}
            />
          </div>
        ))}
      </div>

      <div className={styles.column}>
        {targets.map(tgt => (
          <div key={tgt.id} className={styles.row}>
            <button
              type="button"
              data-port-id={tgt.id}
              onClick={() => onTarget(tgt.id)}
              className={`${styles.port} ${styles.portTarget} ${
                activeSource ? styles.portArmed : ''
              }`}
              aria-label={`target ${tgt.label}`}
            />
            <div className={styles.node}>{tgt.label}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

export function Side() {
  const { edges, clearEdges } = usePatchbay()
  return (
    <div className={styles.side}>
      <pre className={styles.json}>{JSON.stringify({ edges }, null, 2)}</pre>
      <button
        type="button"
        className={styles.clear}
        onClick={clearEdges}
        disabled={edges.length === 0}
      >
        clear
      </button>
    </div>
  )
}
