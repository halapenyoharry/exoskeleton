import { useState } from "react";
import "./WebviewPanel.css";

const DEFAULT_URL = "http://lumen.local:8188"; // ComfyUI on the RTX 3090

export default function WebviewPanel() {
  const [url, setUrl] = useState(DEFAULT_URL);
  const [loadedUrl, setLoadedUrl] = useState(DEFAULT_URL);
  const [reloadKey, setReloadKey] = useState(0);

  function go() {
    setLoadedUrl(url);
    setReloadKey((k) => k + 1);
  }

  return (
    <div className="panel-pad">
      <div className="panel-toolbar">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") go();
          }}
          placeholder="http://lumen.local:8188"
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
