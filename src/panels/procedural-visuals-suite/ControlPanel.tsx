import { useEffect, useState } from "react";
import type { IDockviewPanelProps } from "dockview";
import { subscribeOsc, sendOsc } from "./channels";
import type { ProceduralSuiteParams } from "./types";
import { VIZ_PANELS, getAvailableAddress, getControlAddress, getPingAddress } from "./channels";
import type { OscArg } from "../../osc";
import "./Panel.css";

const FOUNTAIN_PALETTES = [
  { id: 'viridis', gradient: 'linear-gradient(90deg, #440154, #21908d, #fde725)' },
  { id: 'turbo',   gradient: 'linear-gradient(90deg, #30123b, #28bbec, #a2fc3c, #fb8022, #7a0403)' },
  { id: 'magma',   gradient: 'linear-gradient(90deg, #000004, #51127c, #b63679, #fb8861, #fcfdbf)' },
  { id: 'rainbow', gradient: 'linear-gradient(90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff)' },
  { id: 'cool',    gradient: 'linear-gradient(90deg, #6dd5ed, #2193b0)' },
];

const TOPO_SURFACES = [
  { id: 'sphere',  glyph: '○', title: 'Sphere' },
  { id: 'torus',   glyph: '◎', title: 'Torus' },
  { id: 'mobius',  glyph: '∞', title: 'Möbius' },
  { id: 'klein',   glyph: '⚲', title: 'Klein' },
  { id: 'trefoil', glyph: '⌘', title: 'Trefoil' },
];

const TOPO_SHADERS = [
  { id: 0, glyph: '≋', title: 'Wave' },
  { id: 1, glyph: '⊞', title: 'UV Grid' },
  { id: 2, glyph: '⬡', title: 'Voronoi' },
  { id: 3, glyph: '⇶', title: 'Flow' },
];

const TOPO_PALETTES = [
  { id: 0, gradient: 'linear-gradient(90deg, #0a0514, #a60db3, #fa0d8c, #00f3f3)' },
  { id: 1, gradient: 'linear-gradient(90deg, #030812, #083861, #0fb8a6, #66fadc)' },
  { id: 2, gradient: 'linear-gradient(90deg, #0a0305, #9e0f0f, #f2730d, #ffe033)' },
  { id: 3, gradient: 'linear-gradient(90deg, #ff6b6b, #feca57, #48dbfb, #ff9ff3)' },
  { id: 4, gradient: 'linear-gradient(90deg, #05080d, #2e3340, #7a8599, #d1e0f2)' },
];

export default function ControlPanel(props: IDockviewPanelProps<ProceduralSuiteParams>) {
  const docId = props.params?.documentId || "default";

  // State to track which visualization panels are open
  const [activePanels, setActivePanels] = useState<Record<string, boolean>>({});

  // State for controls for each visualization
  const [bouncingBallsState, setBouncingBallsState] = useState({
    count: 20, gravity: 10, restitution: 85
  });

  const [fountainState, setFountainState] = useState({
    trailFade: 0.2, sources: 1, particleSize: 4, animSpeed: 1.0, colorScheme: 'viridis'
  });

  const [recursiveState, setRecursiveState] = useState({
    depth: 5, variation: 60, hue: '#7c6af5'
  });

  const [manifoldState, setManifoldState] = useState({
    surface: 'klein', shaderMode: 0, colorPalette: 0, speed: 1.0, frequency: 5.5,
    intensity: 1.0, roughness: 26.0, fresnel: 2.3, wireframe: false, wireframeOpacity: 0.15,
    autoRotate: true, autoRotateSpeed: 0.8
  });

  useEffect(() => {
    // Listen for available visualizations
    const cleanupFns: Array<() => void> = [];

    Object.keys(VIZ_PANELS).forEach(viz => {
      const address = getAvailableAddress(docId, viz);
      const unsub = subscribeOsc(address, (_, args) => {
        const isAvailable = args[0]?.value === true;
        setActivePanels(prev => ({ ...prev, [viz]: isAvailable }));
      });
      cleanupFns.push(unsub);
    });

    // Ping existing panels so they re-report availability
    sendOsc(getPingAddress(docId), []);

    return () => cleanupFns.forEach(fn => fn());
  }, [docId]);

  // Generic value change sender
  const handleControlChange = (viz: string, param: string, value: any, type: 'float' | 'int' | 'bool' | 'string' = 'float') => {
    let arg: OscArg;
    if (type === 'float') arg = { type: 'float', value: Number(value) };
    else if (type === 'int') arg = { type: 'int', value: Math.round(Number(value)) };
    else if (type === 'bool') arg = { type: 'bool', value: Boolean(value) };
    else arg = { type: 'string', value: String(value) };

    sendOsc(getControlAddress(docId, viz, param), [arg]);

    // Update local state for immediate feedback
    if (viz === 'bouncing-balls') setBouncingBallsState(prev => ({ ...prev, [param]: value }));
    else if (viz === 'fountain') setFountainState(prev => ({ ...prev, [param]: value }));
    else if (viz === 'recursive-subdivision') setRecursiveState(prev => ({ ...prev, [param]: value }));
    else if (viz === 'manifold') setManifoldState(prev => ({ ...prev, [param]: value }));
  };

  const handleTrigger = (viz: string, action: string) => {
    sendOsc(getControlAddress(docId, viz, action), [{ type: 'int', value: 1 }]);
  };

  return (
    <div className="procedural-suite-control-root">
      <div className="control-header">
        <div className="control-brand">
          <span className="control-brand-glyph">▦</span>
          <span className="control-brand-title">Procedural Visuals</span>
        </div>
        <div className="panel-status-indicators">
          <div className={`status-pill pill-balls ${activePanels['bouncing-balls'] ? 'active' : ''}`} title="Bouncing Balls">
            <span className="glyph">○</span>
            <span className="dot"></span>
          </div>
          <div className={`status-pill pill-fountain ${activePanels['fountain'] ? 'active' : ''}`} title="Fountain">
            <span className="glyph">≈</span>
            <span className="dot"></span>
          </div>
          <div className={`status-pill pill-recursive ${activePanels['recursive-subdivision'] ? 'active' : ''}`} title="Recursive Subdivision">
            <span className="glyph">▣</span>
            <span className="dot"></span>
          </div>
          <div className={`status-pill pill-manifold ${activePanels['manifold'] ? 'active' : ''}`} title="Manifold">
            <span className="glyph">◎</span>
            <span className="dot"></span>
          </div>
        </div>
      </div>

      <div className="instrument-rack">
        {/* Manifold Controls */}
        <div className={`instrument-module module-manifold ${activePanels['manifold'] ? 'active' : 'inactive'}`}>
          <div className="module-header">
            <span className="module-glyph">◎</span>
            <span className="module-title">Manifold</span>
            <span className={`status-indicator ${activePanels['manifold'] ? 'live' : ''}`} />
          </div>
          <div className="module-controls">
            {/* Visual Surface Selector */}
            <div className="visual-selector-row">
              {TOPO_SURFACES.map(s => (
                <button
                  key={s.id}
                  className={`visual-chip-btn ${manifoldState.surface === s.id ? 'selected' : ''}`}
                  title={s.title}
                  onClick={() => handleControlChange('manifold', 'surface', s.id, 'string')}
                >
                  <span className="chip-icon">{s.glyph}</span>
                </button>
              ))}
            </div>

            {/* Visual Shader Selector */}
            <div className="visual-selector-row">
              {TOPO_SHADERS.map(s => (
                <button
                  key={s.id}
                  className={`visual-chip-btn ${manifoldState.shaderMode === s.id ? 'selected' : ''}`}
                  title={s.title}
                  onClick={() => handleControlChange('manifold', 'shaderMode', s.id, 'int')}
                >
                  <span className="chip-icon">{s.glyph}</span>
                </button>
              ))}
            </div>

            {/* Visual Color Palette Chips */}
            <div className="palette-chip-row">
              {TOPO_PALETTES.map(p => (
                <button
                  key={p.id}
                  className={`palette-chip ${manifoldState.colorPalette === p.id ? 'selected' : ''}`}
                  style={{ background: p.gradient }}
                  onClick={() => handleControlChange('manifold', 'colorPalette', p.id, 'int')}
                />
              ))}
            </div>

            {/* Sliders */}
            <div className="control-slider-group">
              <div className="slider-meta">
                <span>Speed</span>
                <span className="slider-val">{manifoldState.speed.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0"
                max="3"
                step="0.05"
                value={manifoldState.speed}
                onChange={e => handleControlChange('manifold', 'speed', parseFloat(e.target.value))}
              />
            </div>

            <div className="module-actions-row">
              <button
                className={`toggle-chip-btn ${manifoldState.wireframe ? 'active' : ''}`}
                onClick={() => handleControlChange('manifold', 'wireframe', !manifoldState.wireframe, 'bool')}
              >
                Wireframe
              </button>
              <button className="bang-action-btn" onClick={() => handleTrigger('manifold', 'resetCamera')}>
                ↺ Reset View
              </button>
            </div>
          </div>
        </div>

        {/* Bouncing Balls Controls */}
        <div className={`instrument-module module-balls ${activePanels['bouncing-balls'] ? 'active' : 'inactive'}`}>
          <div className="module-header">
            <span className="module-glyph">○</span>
            <span className="module-title">Bouncing Balls</span>
            <span className={`status-indicator ${activePanels['bouncing-balls'] ? 'live' : ''}`} />
          </div>
          <div className="module-controls">
            <div className="control-slider-group">
              <div className="slider-meta">
                <span>Count</span>
                <span className="slider-val">{bouncingBallsState.count}</span>
              </div>
              <input
                type="range"
                min="1"
                max="80"
                value={bouncingBallsState.count}
                onChange={e => handleControlChange('bouncing-balls', 'count', parseInt(e.target.value), 'int')}
              />
            </div>
            <div className="control-slider-group">
              <div className="slider-meta">
                <span>Gravity</span>
                <span className="slider-val">{bouncingBallsState.gravity}</span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                value={bouncingBallsState.gravity}
                onChange={e => handleControlChange('bouncing-balls', 'gravity', parseFloat(e.target.value))}
              />
            </div>
            <div className="control-slider-group">
              <div className="slider-meta">
                <span>Elasticity</span>
                <span className="slider-val">{bouncingBallsState.restitution}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={bouncingBallsState.restitution}
                onChange={e => handleControlChange('bouncing-balls', 'restitution', parseFloat(e.target.value))}
              />
            </div>
            <button className="bang-action-btn" onClick={() => handleTrigger('bouncing-balls', 'reset')}>
              Scatter Balls
            </button>
          </div>
        </div>

        {/* Fountain Controls */}
        <div className={`instrument-module module-fountain ${activePanels['fountain'] ? 'active' : 'inactive'}`}>
          <div className="module-header">
            <span className="module-glyph">≈</span>
            <span className="module-title">Particle Fountain</span>
            <span className={`status-indicator ${activePanels['fountain'] ? 'live' : ''}`} />
          </div>
          <div className="module-controls">
            {/* Visual Color Palette Chips */}
            <div className="palette-chip-row">
              {FOUNTAIN_PALETTES.map(p => (
                <button
                  key={p.id}
                  className={`palette-chip ${fountainState.colorScheme === p.id ? 'selected' : ''}`}
                  style={{ background: p.gradient }}
                  onClick={() => handleControlChange('fountain', 'colorScheme', p.id, 'string')}
                />
              ))}
            </div>

            <div className="control-slider-group">
              <div className="slider-meta">
                <span>Trail Fade</span>
                <span className="slider-val">{fountainState.trailFade.toFixed(2)}</span>
              </div>
              <input
                type="range"
                min="0.05"
                max="1.0"
                step="0.05"
                value={fountainState.trailFade}
                onChange={e => handleControlChange('fountain', 'trailFade', parseFloat(e.target.value))}
              />
            </div>
            <div className="control-slider-group">
              <div className="slider-meta">
                <span>Sources</span>
                <span className="slider-val">{fountainState.sources}</span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                step="1"
                value={fountainState.sources}
                onChange={e => handleControlChange('fountain', 'sources', parseInt(e.target.value), 'int')}
              />
            </div>
            <div className="control-slider-group">
              <div className="slider-meta">
                <span>Speed</span>
                <span className="slider-val">{fountainState.animSpeed.toFixed(1)}x</span>
              </div>
              <input
                type="range"
                min="0.2"
                max="2.0"
                step="0.1"
                value={fountainState.animSpeed}
                onChange={e => handleControlChange('fountain', 'animSpeed', parseFloat(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Recursive Subdivision Controls */}
        <div className={`instrument-module module-recursive ${activePanels['recursive-subdivision'] ? 'active' : 'inactive'}`}>
          <div className="module-header">
            <span className="module-glyph">▣</span>
            <span className="module-title">Recursive Subdivision</span>
            <span className={`status-indicator ${activePanels['recursive-subdivision'] ? 'live' : ''}`} />
          </div>
          <div className="module-controls">
            <div className="control-slider-group">
              <div className="slider-meta">
                <span>Depth</span>
                <span className="slider-val">{recursiveState.depth}</span>
              </div>
              <input
                type="range"
                min="1"
                max="7"
                value={recursiveState.depth}
                onChange={e => handleControlChange('recursive-subdivision', 'depth', parseInt(e.target.value), 'int')}
              />
            </div>
            <div className="control-slider-group">
              <div className="slider-meta">
                <span>Variation</span>
                <span className="slider-val">{recursiveState.variation}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={recursiveState.variation}
                onChange={e => handleControlChange('recursive-subdivision', 'variation', parseInt(e.target.value), 'int')}
              />
            </div>
            <div className="color-swatch-row">
              <span className="slider-meta">Base Hue</span>
              <div className="swatch-wrap">
                <input
                  type="color"
                  className="native-color-picker"
                  value={recursiveState.hue}
                  onChange={e => handleControlChange('recursive-subdivision', 'hue', e.target.value, 'string')}
                />
                <span className="color-preview" style={{ background: recursiveState.hue }} />
              </div>
            </div>
            <button className="bang-action-btn" onClick={() => handleTrigger('recursive-subdivision', 'new-seed')}>
              New Seed
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
