import './Hotbar.css'

export default function Hotbar() {
  return (
    <div className="hotbar" aria-label="Hotbar">
      <div className="hotbar__strip">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="hotbar__slot" />
        ))}
      </div>
    </div>
  )
}
