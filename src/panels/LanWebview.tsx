import { useState } from "react";
import type { IDockviewPanelProps } from "dockview";
import "./LanWebview.css";

const FALLBACK_URL = "https://dockview.dev";

interface LanWebviewParams {
  url?: string;
}

export default function LanWebview(props: IDockviewPanelProps<LanWebviewParams>) {
  // The URL is held in panel params (Dockview's per-panel state), so it
  // persists across restarts as part of the serialized layout.
  const initialUrl = props.params?.url ?? FALLBACK_URL;
  const [url, setUrl] = useState(initialUrl);
  const [loadedUrl, setLoadedUrl] = useState(initialUrl);
  const [reloadKey, setReloadKey] = useState(0);

  function go() {
    setLoadedUrl(url);
    setReloadKey((k) => k + 1);
    // Write the new URL back into params so it'll be saved with the layout.
    props.api.updateParameters({ url });
  }

  return (
    <div className="panel-pad panel-pad--webview">
      <div className="panel-header">webview</div>
      <div className="panel-toolbar">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") go();
          }}
          placeholder="https://example.com or http://lan-host:port"
          spellCheck={false}
        />
        <button onClick={go}>go</button>
        <button onClick={() => setReloadKey((k) => k + 1)}>reload</button>
      </div>
      <div className="panel-body">
        <iframe
          key={reloadKey}
          className="webview-frame"
          src={loadedUrl}
          title="webview"
          allow="clipboard-write; fullscreen"
        />
      </div>
    </div>
  );
}
