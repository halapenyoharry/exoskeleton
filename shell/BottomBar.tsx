import './BottomBar.css'

interface Props {
  viewTitle: string
  sideToggleLabel: string | null
  sideOpen: boolean
  onToggleSide: () => void
  onPickView?: () => void
}

export default function BottomBar({
  viewTitle,
  sideToggleLabel,
  sideOpen,
  onToggleSide,
  onPickView,
}: Props) {
  return (
    <div className="bottom">
      <button
        className="bottom__view"
        onClick={onPickView}
        disabled={!onPickView}
        title={onPickView ? 'switch view' : viewTitle}
      >
        {viewTitle}
      </button>
      <div className="bottom__spacer" />
      {sideToggleLabel ? (
        <button
          className={`bottom__side ${sideOpen ? 'bottom__side--on' : ''}`}
          onClick={onToggleSide}
          title="toggle side (cmd+b)"
        >
          {sideToggleLabel}
        </button>
      ) : null}
    </div>
  )
}
