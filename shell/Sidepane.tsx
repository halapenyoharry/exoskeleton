import { modules } from './moduleRegistry'
import './Sidepane.css'

interface Props {
  open: boolean
}

export default function Sidepane({ open }: Props) {
  return (
    <aside className={`sidepane ${open ? 'sidepane--open' : 'sidepane--closed'}`}>
      <div className="sidepane__inner">
        <div className="sidepane__header">Modules</div>
        <ul className="sidepane__list">
          {modules.map(m => (
            <li key={m.manifest.id} className="sidepane__item">
              {m.manifest.title}
            </li>
          ))}
          {modules.length === 0 && (
            <li className="sidepane__empty">no modules registered</li>
          )}
        </ul>
      </div>
    </aside>
  )
}
