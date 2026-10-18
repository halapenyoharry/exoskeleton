// Per-panel visibility of the controls cell (the top cell of the Splitview
// PanelPanes builds). The cell can be snapped away with its sash; the
// group's header actions (HeaderActions.tsx) show a restore button while it
// is hidden. The two live in different React subtrees, so they meet here.

type Entry = { visible: boolean; show: () => void };
const entries = new Map<string, Entry>();
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function registerPanesVisibility(panelId: string, entry: Entry): () => void {
  entries.set(panelId, entry);
  emit();
  return () => {
    entries.delete(panelId);
    emit();
  };
}

export function setPanesVisible(panelId: string, visible: boolean): void {
  const e = entries.get(panelId);
  if (!e || e.visible === visible) return;
  entries.set(panelId, { ...e, visible });
  emit();
}

export function getPanesVisibility(panelId: string): Entry | undefined {
  return entries.get(panelId);
}

export function subscribePanesVisibility(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
