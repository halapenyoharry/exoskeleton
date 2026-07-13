import { useEffect, useMemo, useState } from "react";
import type { IDockviewPanelProps } from "dockview";
import {
  getActiveDocumentId,
  onActiveDocumentIdChange,
  areGraphsConnected,
  onGraphsConnectionChange,
} from "../../data/json-bus";
import { useJsonDoc } from "../../data/useJsonDoc";
import { getDocStats } from "../../data/json-utils/docStats";
import {
  parseTopology,
  emptyTopology,
  type LayerData,
  type ParsedTopology,
  type ReifiedRelation,
} from "./parse";
import { CATEGORY_TOKENS } from "./categories";
import type {
  EdgeCategory,
  RenderableNode,
  TopoLink,
} from "./types";
import "./JsonDyadicPanel.css";

// ─── params ─────────────────────────────────────────────────────────────

export interface JsonDyadicParams {
  documentId: string;
  /** null on first open — the directive forbids a default whole-graph view. */
  selectedLayer: string | null;
  /** Additional layers stacked beneath the primary, each in its own register. */
  overlayLayers: string[];
  showMetadata: boolean;
  showCategoryLegend: boolean;
}

/** Doc-size (JSON node count) above which parseTopology is gated behind a
 *  "Parse anyway" click. Generous: the parse is a single O(N) pass and the
 *  render is layer-scoped, so this only guards truly enormous documents. */
const PARSE_THRESHOLD = 100000;

export const jsonDyadicDefaults: JsonDyadicParams = {
  documentId: "default",
  selectedLayer: null,
  overlayLayers: [],
  showMetadata: false,
  showCategoryLegend: true,
};

// ─── label / role helpers ───────────────────────────────────────────────

function nodeLabel(n: RenderableNode): string {
  return n.attrs?.label ?? n.label ?? n.id;
}

function nodeKindTag(n: RenderableNode): string | undefined {
  const k = n.attrs?.["i2t:kind"];
  return typeof k === "string" ? k : undefined;
}

function linkSpokeRole(link: TopoLink): string | undefined {
  if (link.role) return link.role;
  if (link.target_role) return link.target_role;
  return undefined;
}

// ─── category renderers ────────────────────────────────────────────────
//
// Hard rule per the directive: c:-prefixed reifications NEVER render as
// node-shapes. They are the region, the field, the flow. The participants
// of each relation are looked up via topology.nodesById — that map is the
// only source of node-tiles.

interface RenderArgs {
  layer: LayerData;
  topology: ParsedTopology;
}

function NodeTile({
  node,
  role,
  size = "md",
}: {
  node: RenderableNode;
  role?: string;
  size?: "sm" | "md";
}) {
  const kind = nodeKindTag(node);
  return (
    <div
      className={`dp-tile dp-tile--${size}`}
      data-kind={kind ?? "node"}
      data-node-id={node.id}
      title={node.id}
    >
      <span className="dp-tile-label">{nodeLabel(node)}</span>
      {kind && <span className="dp-tile-kind">{kind}</span>}
      {role && <span className="dp-tile-role">{role}</span>}
    </div>
  );
}

function MissingTile({ id }: { id: string }) {
  return (
    <div
      className="dp-tile dp-tile--missing"
      title={`Referenced id not in nodes: ${id}`}
    >
      <span className="dp-tile-label">{id}</span>
      <span className="dp-tile-kind">unresolved</span>
    </div>
  );
}

function renderContainment({ layer, topology }: RenderArgs) {
  const tokens = CATEGORY_TOKENS.containment;
  // The reifications drive the visual: each one is a region containing
  // its spokes' participants. Plain dyadic containment links (e.g. embeds)
  // get one region per link, nesting target inside source.
  return (
    <div className="dp-layer dp-layer--containment">
      {layer.reifications.map(({ relation, spokes }) => (
        <ReificationRegion
          key={relation.id}
          relation={relation}
          spokes={spokes}
          topology={topology}
          color={tokens.color}
          fill={tokens.fill}
          stroke={tokens.stroke}
        />
      ))}
      {layer.dyadicLinks.map((link, i) => {
        const source = topology.nodesById.get(link.source);
        const target = topology.nodesById.get(link.target);
        if (!source || !target) return null;
        return (
          <div
            key={`${link.source}-${link.target}-${i}`}
            className="dp-containment-pair"
            style={{ borderColor: tokens.stroke, background: tokens.fill }}
          >
            <div className="dp-containment-pair-heading">
              <span className="dp-region-predicate">
                {link.attrs?.["i2t:predicate"] ?? link.layer}
              </span>
              {link.label && (
                <span className="dp-region-note">{link.label}</span>
              )}
            </div>
            <NodeTile node={source} role={link.source_role} />
            <div className="dp-containment-nested">
              <NodeTile node={target} role={link.target_role} size="sm" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ReificationRegion({
  relation,
  spokes,
  topology,
  color,
  fill,
  stroke,
}: {
  relation: ReifiedRelation["relation"];
  spokes: TopoLink[];
  topology: ParsedTopology;
  color: string;
  fill: string;
  stroke: string;
}) {
  const predicate =
    relation.attrs?.["i2t:predicate"] ?? relation.attrs?.label ?? relation.id;
  return (
    <section
      className="dp-region"
      style={{ borderColor: stroke, background: fill }}
      data-reification-id={relation.id}
    >
      <header className="dp-region-header">
        <span className="dp-region-predicate" style={{ color }}>
          {predicate}
        </span>
        <span className="dp-region-count">{spokes.length} participants</span>
      </header>
      <div className="dp-region-body">
        {spokes.map((spoke, i) => {
          const node = topology.nodesById.get(spoke.target);
          const role = linkSpokeRole(spoke);
          if (!node) return <MissingTile key={i} id={spoke.target} />;
          return <NodeTile key={spoke.target + i} node={node} role={role} />;
        })}
      </div>
    </section>
  );
}

function renderStateChange({ layer, topology }: RenderArgs) {
  return (
    <div className="dp-layer dp-layer--state-change">
      {layer.reifications.map(({ relation, spokes }) => (
        <StateChangeRegion
          key={relation.id}
          relation={relation}
          spokes={spokes}
          topology={topology}
        />
      ))}
      {layer.dyadicLinks.map((link, i) => {
        const source = topology.nodesById.get(link.source);
        const target = topology.nodesById.get(link.target);
        if (!source || !target) return null;
        return (
          <div
            key={`${link.source}-${link.target}-${i}`}
            className="dp-state-pair"
          >
            <NodeTile node={source} role={link.source_role} />
            <div className="dp-state-flow">
              <span className="dp-state-flow-label">
                {link.attrs?.["i2t:predicate"] ?? link.layer}
              </span>
            </div>
            <NodeTile node={target} role={link.target_role} />
          </div>
        );
      })}
    </div>
  );
}

function StateChangeRegion({
  relation,
  spokes,
  topology,
}: {
  relation: ReifiedRelation["relation"];
  spokes: TopoLink[];
  topology: ParsedTopology;
}) {
  // Split spokes into inputs and outputs by role. Convention from the
  // file: roles named "output" / "result" land on the right; everything
  // else lands on the left (engine, model, voice, agent, …).
  const outputs: TopoLink[] = [];
  const inputs: TopoLink[] = [];
  for (const spoke of spokes) {
    const role = linkSpokeRole(spoke) ?? "";
    if (/output|result|sink|to/i.test(role)) {
      outputs.push(spoke);
    } else {
      inputs.push(spoke);
    }
  }
  const predicate =
    relation.attrs?.["i2t:predicate"] ?? relation.attrs?.label ?? relation.id;
  return (
    <section className="dp-state-region" data-reification-id={relation.id}>
      <header className="dp-region-header">
        <span
          className="dp-region-predicate"
          style={{ color: CATEGORY_TOKENS.state_change.color }}
        >
          {predicate}
        </span>
        <span className="dp-region-count">
          {inputs.length} → {outputs.length}
        </span>
      </header>
      <div className="dp-state-region-body">
        <div className="dp-state-side dp-state-side--from">
          {inputs.map((spoke, i) => {
            const node = topology.nodesById.get(spoke.target);
            const role = linkSpokeRole(spoke);
            if (!node) return <MissingTile key={i} id={spoke.target} />;
            return <NodeTile key={spoke.target + i} node={node} role={role} />;
          })}
        </div>
        <div className="dp-state-side dp-state-side--to">
          {outputs.map((spoke, i) => {
            const node = topology.nodesById.get(spoke.target);
            const role = linkSpokeRole(spoke);
            if (!node) return <MissingTile key={i} id={spoke.target} />;
            return <NodeTile key={spoke.target + i} node={node} role={role} />;
          })}
        </div>
      </div>
    </section>
  );
}

function renderInteractivity({ layer, topology }: RenderArgs) {
  return (
    <div className="dp-layer dp-layer--interactivity">
      {layer.reifications.map(({ relation, spokes }) => (
        <InteractivityRegion
          key={relation.id}
          relation={relation}
          spokes={spokes}
          topology={topology}
        />
      ))}
      {layer.dyadicLinks.map((link, i) => {
        const source = topology.nodesById.get(link.source);
        const target = topology.nodesById.get(link.target);
        if (!source || !target) return null;
        return (
          <div
            key={`${link.source}-${link.target}-${i}`}
            className="dp-interactivity-pair"
          >
            <div className="dp-interactivity-blob dp-interactivity-blob--a">
              <NodeTile node={source} role={link.source_role} />
            </div>
            <div className="dp-interactivity-blob dp-interactivity-blob--b">
              <NodeTile node={target} role={link.target_role} />
            </div>
            <span className="dp-interactivity-label">
              {link.attrs?.["i2t:predicate"] ?? link.layer}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function InteractivityRegion({
  relation,
  spokes,
  topology,
}: {
  relation: ReifiedRelation["relation"];
  spokes: TopoLink[];
  topology: ParsedTopology;
}) {
  const predicate =
    relation.attrs?.["i2t:predicate"] ?? relation.attrs?.label ?? relation.id;
  return (
    <section
      className="dp-interactivity-region"
      data-reification-id={relation.id}
    >
      <header className="dp-region-header">
        <span
          className="dp-region-predicate"
          style={{ color: CATEGORY_TOKENS.interactivity.color }}
        >
          {predicate}
        </span>
        <span className="dp-region-count">{spokes.length} participants</span>
      </header>
      <div className="dp-interactivity-region-body">
        {spokes.map((spoke, i) => {
          const node = topology.nodesById.get(spoke.target);
          const role = linkSpokeRole(spoke);
          if (!node) return <MissingTile key={i} id={spoke.target} />;
          return (
            <div key={spoke.target + i} className="dp-interactivity-participant">
              <NodeTile node={node} role={role} />
            </div>
          );
        })}
      </div>
    </section>
  );
}

function renderReference({ layer, topology }: RenderArgs) {
  // References must not dominate. Render as low-weight floating tags
  // beside the source tile, with the target id as text.
  return (
    <div className="dp-layer dp-layer--reference">
      {layer.dyadicLinks.map((link, i) => {
        const source = topology.nodesById.get(link.source);
        const target = topology.nodesById.get(link.target);
        if (!source) return null;
        const targetLabel = target ? nodeLabel(target) : link.target;
        const predicate = link.attrs?.["i2t:predicate"] ?? link.layer;
        return (
          <div
            key={`${link.source}-${link.target}-${i}`}
            className="dp-reference-row"
          >
            <NodeTile node={source} />
            <span className="dp-reference-tag">
              <span className="dp-reference-predicate">{predicate}</span>
              {link.directed && (
                <span className="dp-reference-arrow" aria-hidden>
                  ›
                </span>
              )}
              <span className="dp-reference-target">{targetLabel}</span>
            </span>
          </div>
        );
      })}
      {layer.reifications.map(({ relation, spokes }) => (
        <div key={relation.id} className="dp-reference-bundle">
          <span className="dp-reference-predicate">
            {relation.attrs?.["i2t:predicate"] ?? relation.id}
          </span>
          {spokes.map((spoke, i) => {
            const node = topology.nodesById.get(spoke.target);
            return (
              <span key={i} className="dp-reference-target">
                {node ? nodeLabel(node) : spoke.target}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
}

const RENDERERS: Record<
  EdgeCategory,
  (args: RenderArgs) => React.ReactElement
> = {
  containment: renderContainment,
  state_change: renderStateChange,
  interactivity: renderInteractivity,
  reference: renderReference,
};

// ─── panel ─────────────────────────────────────────────────────────────

export default function JsonDyadicPanel(
  props: IDockviewPanelProps<JsonDyadicParams>,
) {
  const params: JsonDyadicParams = {
    ...jsonDyadicDefaults,
    ...(props.params ?? {}),
  };

  const updateParam = <K extends keyof JsonDyadicParams>(
    key: K,
    value: JsonDyadicParams[K],
  ) => {
    props.api.updateParameters({ ...params, [key]: value });
  };

  // active-document coordination — mirrors json-circles
  const [activeDocId, setActiveDocId] = useState(params.documentId);
  const [connected, setConnected] = useState(areGraphsConnected());
  useEffect(() => onGraphsConnectionChange(setConnected), []);
  useEffect(() => {
    if (!connected) {
      setActiveDocId(params.documentId);
      return;
    }
    setActiveDocId(getActiveDocumentId());
    return onActiveDocumentIdChange(setActiveDocId);
  }, [connected, params.documentId]);

  // Visibility-aware doc subscription (hidden tabs buffer, not render).
  const doc = useJsonDoc(props.api, activeDocId);

  // Generous parse gate: the render is already layer-scoped (only the
  // selected layer's tiles hit the DOM), so only the O(N) parse needs
  // guarding against truly enormous documents. Session-only bypass.
  const [bypassPerf, setBypassPerf] = useState(false);
  const docNodeCount =
    doc === undefined ? 0 : getDocStats(doc).hierarchyNodeCount;
  const perfBlocked = docNodeCount > PARSE_THRESHOLD && !bypassPerf;

  const topology = useMemo<ParsedTopology>(() => {
    if (doc === undefined || perfBlocked) return emptyTopology();
    return parseTopology(doc);
  }, [doc, perfBlocked]);

  // surface warnings once per parse (dev console only)
  useEffect(() => {
    if (topology.warnings.length > 0) {
      console.warn(
        "[json-dyadic] parse warnings:",
        topology.warnings,
      );
    }
  }, [topology]);

  const layerOrder = topology.layerOrder;
  const hasLayers = layerOrder.length > 0;
  const selected =
    params.selectedLayer && topology.layers.has(params.selectedLayer)
      ? topology.layers.get(params.selectedLayer)!
      : null;
  const overlays = params.overlayLayers
    .filter((l) => l !== params.selectedLayer)
    .map((l) => topology.layers.get(l))
    .filter((l): l is LayerData => Boolean(l));

  return (
    <>
      <div className="panel-header dp-header">
        <span>json-dyadic</span>
        <span className="dp-header-doc">{activeDocId}</span>
      </div>

      <div className="panel-toolbar dp-toolbar">
        <label className="dp-picker">
          layer
          <select
            value={params.selectedLayer ?? ""}
            onChange={(e) =>
              updateParam("selectedLayer", e.target.value || null)
            }
          >
            <option value="">— pick a layer —</option>
            {layerOrder.map((id) => {
              const l = topology.layers.get(id)!;
              return (
                <option key={id} value={id}>
                  {CATEGORY_TOKENS[l.primaryCategory].label.charAt(0).toUpperCase()}
                  ·{l.layer} ({l.linkCount})
                </option>
              );
            })}
          </select>
        </label>

        <label className="dp-toggle">
          <input
            type="checkbox"
            checked={params.showCategoryLegend}
            onChange={(e) =>
              updateParam("showCategoryLegend", e.target.checked)
            }
          />
          legend
        </label>

        <label className="dp-toggle">
          <input
            type="checkbox"
            checked={params.showMetadata}
            onChange={(e) => updateParam("showMetadata", e.target.checked)}
          />
          metadata
        </label>

        {params.showCategoryLegend && <CategoryLegend />}
      </div>

      <div className="panel-body dp-body">
        {topology.warnings.length > 0 && doc === undefined && (
          <p className="dp-hint">Waiting for JSON…</p>
        )}

        {topology.warnings.length > 0 && doc !== undefined && !hasLayers && (
          <div className="dp-error">
            <p>This document doesn't look like a TopoThink dyadic graph.</p>
            <ul>
              {topology.warnings.slice(0, 5).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          </div>
        )}

        {perfBlocked && (
          <div className="dp-empty">
            <p>
              <strong>{docNodeCount.toLocaleString()}</strong> JSON nodes
              (threshold {PARSE_THRESHOLD.toLocaleString()}).
            </p>
            <button onClick={() => setBypassPerf(true)}>Parse anyway</button>
          </div>
        )}

        {hasLayers && !selected && (
          <div className="dp-empty">
            <p>Pick a layer to start.</p>
            <p className="dp-empty-sub">
              {layerOrder.length} layers · {topology.nodesById.size} nodes ·
              {" "}
              {topology.reificationsById.size} reified relations
            </p>
          </div>
        )}

        {selected && (
          <LayerView
            layer={selected}
            topology={topology}
            primary
          />
        )}
        {overlays.map((overlay) => (
          <LayerView
            key={overlay.layer}
            layer={overlay}
            topology={topology}
            primary={false}
          />
        ))}

        {params.showMetadata && topology.metadata && (
          <details className="dp-metadata">
            <summary>document metadata</summary>
            <pre>{JSON.stringify(topology.metadata, null, 2)}</pre>
          </details>
        )}
      </div>
    </>
  );
}

function LayerView({
  layer,
  topology,
  primary,
}: {
  layer: LayerData;
  topology: ParsedTopology;
  primary: boolean;
}) {
  const tokens = CATEGORY_TOKENS[layer.primaryCategory];
  return (
    <section
      className={`dp-layer-view${primary ? "" : " dp-layer-view--overlay"}`}
      data-layer={layer.layer}
      data-category={layer.primaryCategory}
    >
      <header className="dp-layer-view-header">
        <span
          className="dp-layer-view-dot"
          style={{ background: tokens.color }}
        />
        <span className="dp-layer-view-name">{layer.layer}</span>
        <span className="dp-layer-view-category">{tokens.label}</span>
        <span className="dp-layer-view-count">{layer.linkCount}</span>
      </header>
      {RENDERERS[layer.primaryCategory]({ layer, topology })}
    </section>
  );
}

function CategoryLegend() {
  return (
    <div className="dp-legend">
      {(["containment", "state_change", "interactivity", "reference"] as EdgeCategory[]).map(
        (c) => (
          <span key={c} className="dp-legend-item">
            <span
              className="dp-legend-dot"
              style={{ background: CATEGORY_TOKENS[c].color }}
            />
            {CATEGORY_TOKENS[c].label}
          </span>
        ),
      )}
    </div>
  );
}
