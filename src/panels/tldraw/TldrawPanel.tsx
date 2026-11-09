import type { IDockviewPanelProps } from "dockview-react";
import { Tldraw } from "tldraw";
import { getAssetUrlsByImport } from "@tldraw/assets/imports.vite";
import "tldraw/tldraw.css";
import "./TldrawPanel.css";

// tldraw's fonts, icons and translations are bundled by Vite and served by this app; tldraw's default would load them from its CDN.
const assetUrls = getAssetUrlsByImport();

/** Each panel id gets its own drawing saved in this browser's IndexedDB via tldraw's persistenceKey. */
export default function TldrawPanel(props: IDockviewPanelProps) {
  return (
    <div className="tldraw-panel">
      <Tldraw persistenceKey={`exoskeleton-tldraw-${props.api.id}`} assetUrls={assetUrls} />
    </div>
  );
}
