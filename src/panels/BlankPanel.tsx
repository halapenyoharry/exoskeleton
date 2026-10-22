import type { IDockviewPanelProps } from "dockview-react";
import PanelPicker from "../PanelPicker";
import { ensureCompanions, getRegistryEntry } from "../persistence/default-layout";
import "./BlankPanel.css";

/**
 * Blank pane created by the header "+". Shows the component picker; choosing
 * one swaps this pane for the chosen panel in the same group, same position.
 */
export default function BlankPanel(props: IDockviewPanelProps) {
  function pick(component: string) {
    const api = props.containerApi;
    const blankId = props.api.id;
    // Clone-id convention (`<component>-<4 chars>`) so resolveComponentKey
    // maps the new panel back to its family for glyph/accent.
    const newId = `${component}-${Math.random().toString(36).slice(2, 6)}`;
    const entry = getRegistryEntry(component);
    api.addPanel({
      id: newId,
      component,
      title: entry?.title ?? component,
      params: entry?.params,
      position: { referencePanel: blankId, direction: "within" },
    });
    ensureCompanions(api, component);
    props.api.close();
  }

  return (
    <div className="blank-panel">
      <div className="blank-panel-hint">open a component here</div>
      <PanelPicker variant="list" onPick={pick} />
    </div>
  );
}
