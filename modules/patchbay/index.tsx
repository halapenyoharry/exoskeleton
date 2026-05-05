import { useLayoutEffect, useRef, useState } from 'react'
import styles from './patchbay.module.css'

interface Source { id: string; label: string; value?: number }
interface Target { id: string; label: string }
interface Edge { id: string; source_id: string; target_id: string }

const defaultSources: Source[] = [
  { id: 's1', label: 'Raw Source 1' },
  { id: 's2', label: 'Raw Source 2' },
  { id: 's3', label: 'Raw Source 3' },
]

const defaultTargets: Target[] = [
  { id: 't1', label: 'Target Parameter A' },
  { id: 't2', label: 'Target Parameter B' },
  { id: 't3', label: 'Target Parameter C' },
]

interface Props {
  sources?: Source[]
  targets?: Target[]
}

export default function GenericPatchBay({
  sources = defaultSources,
  targets = defaultTargets,
}: Props) {
  const [edges, setEdges] = useState<Edge[]>([])
  const [activeSource, setActiveSource] = useState<string | null>(null)
  const [portCoords, setPortCoords] = useState<Record<string, { x: number; y: number }>>({})
  const containerRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return

    const updateCoordinates = () => {
      const rect = el.getBoundingClientRect()
      const next: Record<string, { x: number; y: number }> = {}
      el.querySelectorAll<HTMLElement>('.graph-port').forEach(port => {
        const r = port.getBoundingClientRect()
        const id = port.dataset.nodeId
        if (!id) return
        next[id] = {
          x: r.left - rect.left + r.width / 2,
          y: r.top - rect.top + r.height / 2,
        }
      })
      setPortCoords(next)
    }

    updateCoordinates()
    const ro = new ResizeObserver(updateCoordinates)
    ro.observe(el)
    window.addEventListener('resize', updateCoordinates)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', updateCoordinates)
    }
  }, [sources, targets])

  const handleSourceClick = (sourceId: string) => setActiveSource(sourceId)

  const handleTargetClick = (targetId: string) => {
    if (!activeSource) return
    const exists = edges.some(e => e.source_id === activeSource && e.target_id === targetId)
    if (!exists) {
      setEdges(prev => [
        ...prev,
        {
          id: `edge_${activeSource}_${targetId}`,
          source_id: activeSource,
          target_id: targetId,
        },
      ])
    }
    setActiveSource(null)
  }

  return (
    <div className={styles.patchbay}>
      <div ref={containerRef} className={styles.graph}>
        <svg className={styles.svg}>
          {edges.map(edge => {
            const start = portCoords[edge.source_id]
            const end = portCoords[edge.target_id]
            if (!start || !end) return null
            return (
              <line
                key={edge.id}
                x1={start.x}
                y1={start.y}
                x2={end.x}
                y2={end.y}
                stroke="#18ffff"
                strokeWidth={2}
              />
            )
          })}
        </svg>

        <div className={styles.column}>
          {sources.map(src => (
            <div key={src.id} className={styles.row}>
              <div className={styles.node}>{src.label}</div>
              <div
                className={`graph-port ${styles.port} ${styles['port--source']} ${
                  activeSource === src.id ? styles['port--active'] : ''
                }`}
                data-node-id={src.id}
                onClick={() => handleSourceClick(src.id)}
              />
            </div>
          ))}
        </div>

        <div className={styles.column}>
          {targets.map(tgt => (
            <div key={tgt.id} className={styles.row}>
              <div
                className={`graph-port ${styles.port} ${styles['port--target']} ${
                  activeSource ? styles['port--armed'] : ''
                }`}
                data-node-id={tgt.id}
                onClick={() => handleTargetClick(tgt.id)}
              />
              <div className={styles.node}>{tgt.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className={styles.output}>
        <div className={styles.output__head}>
          <span className={styles.output__title}>Resulting JSON State</span>
          <button onClick={() => setEdges([])}>Clear All Edges</button>
        </div>
        <pre className={styles.output__pre}>
          {JSON.stringify({ edges }, null, 2)}
        </pre>
      </div>
    </div>
  )
}
