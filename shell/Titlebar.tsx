import './Titlebar.css'

interface Props {
  sidepaneOpen: boolean
  onToggleSidepane: () => void
}

export default function Titlebar({ sidepaneOpen, onToggleSidepane }: Props) {
  return (
    <div className="titlebar">
      <button
        className="titlebar__toggle"
        onClick={onToggleSidepane}
        aria-label={sidepaneOpen ? 'Collapse sidepane' : 'Expand sidepane'}
        title={sidepaneOpen ? 'Collapse sidepane' : 'Expand sidepane'}
      >
        {sidepaneOpen ? '◧' : '◨'}
      </button>
      <div className="titlebar__title">HUD</div>
      <div className="titlebar__spacer" />
    </div>
  )
}
