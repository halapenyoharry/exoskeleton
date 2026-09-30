// Manifold scene — Three.js manifold visualizer (Klein bottle, torus, Möbius,
// sphere, trefoil knot) with procedural GLSL shaders.
//
// Ported from the `collection` repo's `topological-surfaces-viz` experience.
// The original was a standalone HTML page loading three.js + lil-gui from a
// CDN inside a data-URL iframe — forbidden (no runtime internet calls) and
// redundant (its lil-gui panel duplicated every control ControlPanel.tsx
// already exposes over OSC). This module keeps the geometry/shader logic
// verbatim and drops the iframe, the CDN import map, and the GUI — `three`
// is a real npm dependency, bundled by Vite like every other panel.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

export type ManifoldSurface = "sphere" | "torus" | "mobius" | "klein" | "trefoil";

const vertexShader = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;

  void main() {
    vUv = uv;
    vNormal = normalize(normalMatrix * normal);
    vPosition = position;
    vec4 worldPos = modelMatrix * vec4(position, 1.0);
    vWorldPosition = worldPos.xyz;
    gl_Position = projectionMatrix * viewMatrix * worldPos;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  varying vec2 vUv;
  varying vec3 vNormal;
  varying vec3 vPosition;
  varying vec3 vWorldPosition;

  uniform float uTime;
  uniform int uShaderMode;       // 0: Wave, 1: UV Grid, 2: Voronoi, 3: Vector Flow
  uniform int uColorPalette;    // 0: Cyberpunk, 1: Ocean, 2: Solar, 3: Holographic, 4: Void
  uniform float uSpeed;
  uniform float uFrequency;
  uniform float uIntensity;
  uniform float uRoughness;
  uniform float uFresnelPower;
  uniform vec3 uCameraPos;
  uniform vec3 uLightPos;

  #define PI 3.14159265359

  // --- Math & Hash Helpers ---
  float hash(vec2 p) {
    return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
  }

  vec2 hash2(vec2 p) {
    p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
    return fract(sin(p) * 43758.5453123);
  }

  float noise2D(vec2 p) {
    vec2 i = floor(p);
    vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }

  float fbm2D(vec2 p) {
    float v = 0.0;
    float a = 0.5;
    vec2 shift = vec2(100.0);
    mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
    for (int i = 0; i < 4; ++i) {
      v += a * noise2D(p);
      p = rot * p * 2.0 + shift;
      a *= 0.5;
    }
    return v;
  }

  // --- Color Palettes ---
  vec3 getPaletteColor(int paletteId, float t) {
    t = clamp(t, 0.0, 1.0);
    if (paletteId == 0) {
      // Cyberpunk / Neon Synth
      vec3 c0 = vec3(0.04, 0.02, 0.08);
      vec3 c1 = vec3(0.65, 0.05, 0.70);
      vec3 c2 = vec3(0.98, 0.05, 0.55);
      vec3 c3 = vec3(0.00, 0.95, 0.95);
      vec3 c4 = vec3(1.00, 1.00, 1.00);
      if (t < 0.25) return mix(c0, c1, t / 0.25);
      if (t < 0.50) return mix(c1, c2, (t - 0.25) / 0.25);
      if (t < 0.75) return mix(c2, c3, (t - 0.50) / 0.25);
      return mix(c3, c4, (t - 0.75) / 0.25);
    } else if (paletteId == 1) {
      // Bioluminescent Abyss
      vec3 c0 = vec3(0.01, 0.03, 0.07);
      vec3 c1 = vec3(0.03, 0.22, 0.38);
      vec3 c2 = vec3(0.06, 0.72, 0.65);
      vec3 c3 = vec3(0.40, 0.98, 0.82);
      vec3 c4 = vec3(0.92, 1.00, 0.96);
      if (t < 0.25) return mix(c0, c1, t / 0.25);
      if (t < 0.50) return mix(c1, c2, (t - 0.25) / 0.25);
      if (t < 0.75) return mix(c2, c3, (t - 0.50) / 0.25);
      return mix(c3, c4, (t - 0.75) / 0.25);
    } else if (paletteId == 2) {
      // Solar Flare / Magma Heatmap
      vec3 c0 = vec3(0.04, 0.01, 0.02);
      vec3 c1 = vec3(0.62, 0.06, 0.06);
      vec3 c2 = vec3(0.95, 0.45, 0.05);
      vec3 c3 = vec3(1.00, 0.88, 0.20);
      vec3 c4 = vec3(1.00, 1.00, 0.92);
      if (t < 0.25) return mix(c0, c1, t / 0.25);
      if (t < 0.50) return mix(c1, c2, (t - 0.25) / 0.25);
      if (t < 0.75) return mix(c2, c3, (t - 0.50) / 0.25);
      return mix(c3, c4, (t - 0.75) / 0.25);
    } else if (paletteId == 3) {
      // Holographic Prismatic (Cosine Gradient)
      vec3 a = vec3(0.5, 0.5, 0.5);
      vec3 b = vec3(0.5, 0.5, 0.5);
      vec3 c = vec3(1.0, 1.0, 1.0);
      vec3 d = vec3(0.00, 0.33, 0.67);
      return clamp(a + b * cos(6.28318 * (c * t + d)), 0.0, 1.0);
    } else {
      // Platinum Monolith / Void
      vec3 c0 = vec3(0.02, 0.03, 0.05);
      vec3 c1 = vec3(0.18, 0.20, 0.25);
      vec3 c2 = vec3(0.48, 0.52, 0.60);
      vec3 c3 = vec3(0.82, 0.88, 0.95);
      vec3 c4 = vec3(1.00, 1.00, 1.00);
      if (t < 0.25) return mix(c0, c1, t / 0.25);
      if (t < 0.50) return mix(c1, c2, (t - 0.25) / 0.25);
      if (t < 0.75) return mix(c2, c3, (t - 0.50) / 0.25);
      return mix(c3, c4, (t - 0.75) / 0.25);
    }
  }

  // =========================================================================
  // SHADER ALGORITHM 1: Wave Ripple Interference
  // =========================================================================
  vec3 computeWaveInterference(vec2 uv, vec3 pos, float time) {
    // Orbiting wave emitters in parameter space
    vec2 s1 = vec2(0.5 + 0.35 * cos(time * 0.85), 0.5 + 0.35 * sin(time * 0.65));
    vec2 s2 = vec2(0.5 + 0.35 * cos(time * 1.15 + 2.5), 0.5 + 0.35 * sin(time * 0.95 + 1.2));

    // Toroidal periodic distance for seamless metric propagation
    vec2 d1_v = abs(uv - s1);
    d1_v = min(d1_v, 1.0 - d1_v);
    float d1 = length(d1_v);

    vec2 d2_v = abs(uv - s2);
    d2_v = min(d2_v, 1.0 - d2_v);
    float d2 = length(d2_v);

    // 3D coordinate wave emitters
    vec3 p1 = vec3(2.2 * cos(time * 0.7), 1.5 * sin(time * 0.5), 2.2 * sin(time * 0.7));
    vec3 p2 = vec3(2.2 * sin(time * 0.6 + 1.0), 1.5 * cos(time * 0.8), 2.2 * cos(time * 0.6 + 1.0));
    float d3 = length(pos - p1) * 0.35;
    float d4 = length(pos - p2) * 0.35;

    float k = uFrequency * 16.0;
    float w1 = sin(d1 * k - time * 4.0) / (1.0 + 3.0 * d1);
    float w2 = sin(d2 * (k * 1.2) - time * 5.2) / (1.0 + 3.0 * d2);
    float w3 = sin(d3 * (k * 0.9) - time * 3.8) / (1.0 + 2.2 * d3);
    float w4 = sin(d4 * (k * 1.1) - time * 4.5) / (1.0 + 2.2 * d4);

    // Standing wave resonance cross-coupling
    float standing = cos(uv.x * k * 0.75 - time * 2.0) * cos(uv.y * k * 0.75 + time * 1.6);
    float waveSum = (w1 + w2 + w3 + w4) * 0.6 + standing * 0.2 * uIntensity;

    // Sharp optical caustics
    float caustic = pow(clamp(abs(waveSum) * 1.7, 0.0, 1.0), 3.8) * 2.0;
    float t = clamp(waveSum * 0.5 + 0.5, 0.0, 1.0);

    vec3 col = getPaletteColor(uColorPalette, t);
    float fringe = 0.5 + 0.5 * sin(waveSum * 28.0);
    col += vec3(caustic) + fringe * 0.22 * getPaletteColor(uColorPalette, fract(t + 0.35));
    return col;
  }

  // =========================================================================
  // SHADER ALGORITHM 2: UV Coordinate Grid & Conformal Flow
  // =========================================================================
  vec3 computeConformalGridFlow(vec2 uv, vec3 pos, float time) {
    // High-contrast, antialiased UV grid lines
    vec2 st = uv * uFrequency * 1.8;
    vec2 f = abs(fract(st - 0.5) - 0.5);
    vec2 df = fwidth(st);
    vec2 gridVec = smoothstep(vec2(0.0), df * 1.5, f);
    float grid = 1.0 - min(gridVec.x, gridVec.y);

    // Major subdivisions every 4 units
    vec2 stMajor = st / 4.0;
    vec2 fMaj = abs(fract(stMajor - 0.5) - 0.5);
    vec2 dfMaj = fwidth(stMajor);
    vec2 gridMajVec = smoothstep(vec2(0.0), dfMaj * 2.2, fMaj);
    float majorGrid = 1.0 - min(gridMajVec.x, gridMajVec.y);

    // Complex potential: z in complex plane
    vec2 z = (uv - 0.5) * 6.0;
    vec2 z1 = vec2(1.2 * cos(time * 0.7), 1.2 * sin(time * 0.7));
    vec2 z2 = vec2(-1.2 * cos(time * 0.9), -1.2 * sin(time * 0.9));
    vec2 z3 = vec2(0.9 * sin(time * 0.5), -0.9 * cos(time * 0.6));

    vec2 d1 = z - z1;
    vec2 d2 = z - z2;
    vec2 d3 = z - z3;

    float r1 = max(length(d1), 0.06);
    float r2 = max(length(d2), 0.06);
    float r3 = max(length(d3), 0.06);

    float theta1 = atan(d1.y, d1.x);
    float theta2 = atan(d2.y, d2.x);
    float theta3 = atan(d3.y, d3.x);

    // Streamlines (Psi) and equipotential curves (Phi)
    float stream = (log(r1) - log(r2) + 0.85 * log(r3)) * 1.5;
    float potential = (theta1 + theta2 - 1.2 * theta3) * 1.5;

    // Animated pulses flowing along streamlines
    float streamLines = 0.5 + 0.5 * sin(stream * uFrequency * 1.6 - time * 3.5);
    float equipotential = 0.5 + 0.5 * sin(potential * uFrequency * 1.4 + time * 2.8);
    float pulse = smoothstep(0.72, 0.96, streamLines) * 1.2;

    float phase = fract((atan(stream, potential) / 6.28318) + 0.5 + time * 0.06);
    vec3 col = getPaletteColor(uColorPalette, phase);

    // Modulate with conformal curves
    col = mix(col * 0.35, col * 1.5 + vec3(pulse), streamLines * 0.55);
    col += equipotential * 0.22 * getPaletteColor(uColorPalette, fract(phase + 0.5));

    // Overlay glowing coordinate grid lines
    vec3 gridColor = vec3(0.92, 0.96, 1.0);
    col = mix(col, gridColor * 1.4, grid * 0.5 * uIntensity);
    col = mix(col, gridColor * 2.2, majorGrid * 0.9 * uIntensity);

    return col;
  }

  // =========================================================================
  // SHADER ALGORITHM 3: Cellular / Voronoi Noise (Worley Noise)
  // =========================================================================
  vec3 computeCellularVoronoi(vec2 uv, vec3 pos, float time) {
    vec2 p = uv * uFrequency * 3.2;
    vec2 n = floor(p);
    vec2 f = fract(p);

    float f1 = 8.0;
    float f2 = 8.0;
    vec2 bestCellId = vec2(0.0);

    for (int j = -1; j <= 1; j++) {
      for (int i = -1; i <= 1; i++) {
        vec2 g = vec2(float(i), float(j));
        vec2 cellId = n + g;
        vec2 o = hash2(cellId);
        // Dynamic cell centroid jitter
        vec2 center = 0.5 + 0.42 * sin(time * 1.6 + 6.28318 * o);
        vec2 r = g + center - f;
        float d = dot(r, r);

        if (d < f1) {
          f2 = f1;
          f1 = d;
          bestCellId = cellId;
        } else if (d < f2) {
          f2 = d;
        }
      }
    }

    f1 = sqrt(f1);
    f2 = sqrt(f2);

    // Edge distance: F2 - F1 (Worley cell borders)
    float edge = f2 - f1;
    float edgeGlow = 1.0 - smoothstep(0.02, 0.16, edge);

    // Bioluminescent inner nucleus
    float nucleus = exp(-20.0 * f1 * f1);

    // Acoustic resonance concentric rings
    float ripple = 0.5 + 0.5 * cos(38.0 * f1 - time * 4.2);

    // Unique cell color
    float cellHue = hash(bestCellId);
    vec3 cellCol = getPaletteColor(uColorPalette, fract(cellHue + time * 0.05));

    // Interior depth gradient
    vec3 col = cellCol * (0.18 + 0.45 * (1.0 - f1));
    col += cellCol * ripple * 0.28 * uIntensity;

    // Glowing membrane walls
    vec3 edgeCol = getPaletteColor(uColorPalette, fract(cellHue + 0.5)) * 2.4;
    col = mix(col, edgeCol, edgeGlow * uIntensity);

    // Brilliant nucleus centroid
    col += vec3(1.0, 0.96, 0.92) * nucleus * 2.2;

    return col;
  }

  // =========================================================================
  // SHADER ALGORITHM 4: Animated Vector Flow Field
  // =========================================================================
  vec3 computeVectorFlow(vec2 uv, vec3 pos, float time) {
    vec2 p = uv * uFrequency * 2.0;

    // Divergence-free curl noise: V = (dPsi/dy, -dPsi/dx)
    float eps = 0.035;
    float psi_y1 = fbm2D(p + vec2(0.0, eps) + vec2(time * 0.22, 0.0));
    float psi_y0 = fbm2D(p - vec2(0.0, eps) + vec2(time * 0.22, 0.0));
    float psi_x1 = fbm2D(p + vec2(eps, 0.0) + vec2(0.0, time * 0.22));
    float psi_x0 = fbm2D(p - vec2(eps, 0.0) + vec2(0.0, time * 0.22));

    vec2 vel = vec2((psi_y1 - psi_y0) / (2.0 * eps), -(psi_x1 - psi_x0) / (2.0 * eps));
    float speed = length(vel);
    vec2 dir = vel / (speed + 0.001);

    // Cyclic time-phase streak advection
    float tPhase1 = fract(time * 1.3);
    float tPhase2 = fract(time * 1.3 + 0.5);

    vec2 adv1 = p - dir * tPhase1 * 2.0 * uIntensity;
    vec2 adv2 = p - dir * tPhase2 * 2.0 * uIntensity;

    float streak1 = noise2D(adv1 * 5.5);
    float streak2 = noise2D(adv2 * 5.5);

    float blendWeight = 2.0 * abs(tPhase1 - 0.5);
    float streak = mix(streak2, streak1, blendWeight);

    // Radiant velocity filaments
    float filaments = pow(streak, 2.4) * (1.6 + 3.2 * speed);

    // Vorticity cores / eddies
    float vorticity = abs(psi_x1 + psi_x0 - 2.0 * fbm2D(p)) / (eps * eps);
    float eddy = smoothstep(1.8, 9.0, vorticity);

    float flowAngle = atan(dir.y, dir.x) / 6.28318 + 0.5;
    vec3 baseCol = getPaletteColor(uColorPalette, fract(flowAngle + time * 0.05));
    vec3 fastCol = getPaletteColor(uColorPalette, clamp(speed * 3.8, 0.0, 1.0));

    vec3 col = mix(baseCol * 0.22, fastCol, clamp(speed * 2.2, 0.0, 1.0));
    col += filaments * getPaletteColor(uColorPalette, fract(flowAngle + 0.4)) * 1.8 * uIntensity;
    col += eddy * vec3(1.0, 0.85, 0.45) * 0.9;

    return col;
  }

  // --- Main Shading & Lighting Integration ---
  void main() {
    // Crucial for non-orientable / double-sided manifolds: flip normal if viewing backside
    vec3 N = normalize(vNormal);
    if (!gl_FrontFacing) N = -N;

    vec3 V = normalize(uCameraPos - vWorldPosition);
    vec3 L = normalize(uLightPos - vWorldPosition);
    vec3 H = normalize(L + V);

    // Half-Lambert diffuse wrap for smooth curvature expression
    float NdotL = dot(N, L);
    float wrapDiff = max((NdotL + 0.35) / 1.35, 0.0);

    // Blinn-Phong specular glint
    float NdotH = max(dot(N, H), 0.0);
    float spec = pow(NdotH, uRoughness) * 0.9;

    // Fresnel silhouette rim glow
    float NdotV = max(dot(N, V), 0.0);
    float fresnel = pow(1.0 - NdotV, uFresnelPower);

    // Select procedural algorithm
    vec3 procColor = vec3(0.0);
    float animTime = uTime * uSpeed;

    if (uShaderMode == 0) {
      procColor = computeWaveInterference(vUv, vPosition, animTime);
    } else if (uShaderMode == 1) {
      procColor = computeConformalGridFlow(vUv, vPosition, animTime);
    } else if (uShaderMode == 2) {
      procColor = computeCellularVoronoi(vUv, vPosition, animTime);
    } else if (uShaderMode == 3) {
      procColor = computeVectorFlow(vUv, vPosition, animTime);
    }

    // Composite lighting
    vec3 ambient = procColor * 0.28;
    vec3 diffuse = procColor * wrapDiff;
    vec3 specularGlint = vec3(1.0, 0.98, 0.95) * spec;
    vec3 rimLight = getPaletteColor(uColorPalette, 0.88) * fresnel * 1.25;

    vec3 finalColor = ambient + diffuse + specularGlint + rimLight;

    // Tone-mapping and subtle gamma
    finalColor = vec3(1.0) - exp(-finalColor * 1.18);
    finalColor = pow(finalColor, vec3(1.0 / 1.08));

    gl_FragColor = vec4(finalColor, 1.0);
  }
`;

// --- Geometry generators ---

function createParametricGeometry(
  func: (u: number, v: number) => THREE.Vector3,
  uSegments: number,
  vSegments: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let i = 0; i <= uSegments; i++) {
    const u = i / uSegments;
    for (let j = 0; j <= vSegments; j++) {
      const v = j / vSegments;
      const pt = func(u, v);
      positions.push(pt.x, pt.y, pt.z);
      uvs.push(u, v);
    }
  }

  for (let i = 0; i < uSegments; i++) {
    for (let j = 0; j < vSegments; j++) {
      const a = i * (vSegments + 1) + j;
      const b = (i + 1) * (vSegments + 1) + j;
      const c = (i + 1) * (vSegments + 1) + (j + 1);
      const d = i * (vSegments + 1) + (j + 1);
      indices.push(a, b, d);
      indices.push(b, c, d);
    }
  }

  const geom = new THREE.BufferGeometry();
  geom.setIndex(indices);
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.computeVertexNormals();
  return geom;
}

function createSphereGeometry() {
  return new THREE.SphereGeometry(2.0, 96, 64);
}

function createTorusGeometry() {
  return new THREE.TorusGeometry(2.0, 0.75, 64, 128);
}

function createMobiusGeometry() {
  const R = 2.0;
  const width = 1.5;
  return createParametricGeometry((u, v) => {
    const theta = u * Math.PI * 2;
    const halfTheta = theta * 0.5;
    const cosHalf = Math.cos(halfTheta);
    const sinHalf = Math.sin(halfTheta);
    const cosTheta = Math.cos(theta);
    const sinTheta = Math.sin(theta);
    const t = (v - 0.5) * width;

    const x = (R + t * cosHalf) * cosTheta;
    const y = (R + t * cosHalf) * sinTheta;
    const z = t * sinHalf;
    return new THREE.Vector3(x, y, z);
  }, 180, 40);
}

function createKleinGeometry() {
  const r0 = 2.2;
  const s = 0.85;
  return createParametricGeometry((u, v) => {
    const uRad = u * Math.PI * 2;
    const vRad = v * Math.PI * 2;
    const halfU = uRad * 0.5;
    const cosHalf = Math.cos(halfU);
    const sinHalf = Math.sin(halfU);
    const cosU = Math.cos(uRad);
    const sinU = Math.sin(uRad);

    const sinV = Math.sin(vRad);
    const sin2V = Math.sin(2.0 * vRad);

    const r = r0 + s * (cosHalf * sinV - sinHalf * sin2V);
    const z = s * (sinHalf * sinV + cosHalf * sin2V);
    const x = r * cosU;
    const y = r * sinU;

    return new THREE.Vector3(x, y, z);
  }, 160, 80);
}

function createTrefoilGeometry() {
  return new THREE.TorusKnotGeometry(1.6, 0.42, 220, 48, 2, 3);
}

export interface ManifoldSceneHandle {
  setSurface(surface: ManifoldSurface): void;
  setShaderMode(mode: number): void;
  setColorPalette(palette: number): void;
  setSpeed(speed: number): void;
  setFrequency(frequency: number): void;
  setIntensity(intensity: number): void;
  setWireframe(visible: boolean): void;
  resetCamera(): void;
  resize(width: number, height: number): void;
  dispose(): void;
}

export function initManifoldScene(canvas: HTMLCanvasElement, width: number, height: number): ManifoldSceneHandle {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06080d);

  const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
  const defaultCameraPos = new THREE.Vector3(0, 2.4, 6.2);
  camera.position.copy(defaultCameraPos);

  const controls = new OrbitControls(camera, canvas);
  controls.enableDamping = true;
  controls.dampingFactor = 0.05;
  controls.minDistance = 1.5;
  controls.maxDistance = 25.0;

  // Subtle drifting background particle dust
  const particleCount = 1200;
  const particlePositions = new Float32Array(particleCount * 3);
  for (let i = 0; i < particleCount; i++) {
    const radius = 12 + Math.random() * 25;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    particlePositions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
    particlePositions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
    particlePositions[i * 3 + 2] = radius * Math.cos(phi);
  }
  const particleGeom = new THREE.BufferGeometry();
  particleGeom.setAttribute("position", new THREE.BufferAttribute(particlePositions, 3));
  const particleMat = new THREE.PointsMaterial({
    color: 0x4a6fa5,
    size: 0.07,
    transparent: true,
    opacity: 0.4,
  });
  const particleSystem = new THREE.Points(particleGeom, particleMat);
  scene.add(particleSystem);

  const uniforms = {
    uTime: { value: 0 },
    uShaderMode: { value: 0 },
    uColorPalette: { value: 0 },
    uSpeed: { value: 1.0 },
    uFrequency: { value: 5.5 },
    uIntensity: { value: 1.0 },
    uRoughness: { value: 26.0 },
    uFresnelPower: { value: 2.3 },
    uCameraPos: { value: new THREE.Vector3() },
    uLightPos: { value: new THREE.Vector3(5.0, 7.0, 6.0) },
  };

  const manifoldMaterial = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    side: THREE.DoubleSide,
  });

  const wireframeMaterial = new THREE.MeshBasicMaterial({
    wireframe: true,
    color: 0x00f3ff,
    transparent: true,
    opacity: 0.15,
    depthTest: true,
  });

  const geometries: Record<ManifoldSurface, THREE.BufferGeometry> = {
    sphere: createSphereGeometry(),
    torus: createTorusGeometry(),
    mobius: createMobiusGeometry(),
    klein: createKleinGeometry(),
    trefoil: createTrefoilGeometry(),
  };

  const currentSurfaceMesh = new THREE.Mesh(geometries.klein, manifoldMaterial);
  scene.add(currentSurfaceMesh);

  const wireframeMesh = new THREE.Mesh(geometries.klein, wireframeMaterial);
  wireframeMesh.visible = false;
  scene.add(wireframeMesh);

  const autoRotateSpeed = 0.8;
  let paused = false;
  const clock = new THREE.Clock();
  let accumulatedTime = 0;
  let rafHandle = 0;

  function animate() {
    rafHandle = requestAnimationFrame(animate);
    const delta = clock.getDelta();

    if (!paused) {
      accumulatedTime += delta;
      uniforms.uTime.value = accumulatedTime;

      const rotDelta = delta * autoRotateSpeed * 0.4;
      currentSurfaceMesh.rotation.y += rotDelta;
      currentSurfaceMesh.rotation.x += rotDelta * 0.25;
      wireframeMesh.rotation.y = currentSurfaceMesh.rotation.y;
      wireframeMesh.rotation.x = currentSurfaceMesh.rotation.x;

      particleSystem.rotation.y += delta * 0.03;
    }

    uniforms.uCameraPos.value.copy(camera.position);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  return {
    setSurface(surface) {
      const geom = geometries[surface];
      if (!geom) return;
      currentSurfaceMesh.geometry = geom;
      wireframeMesh.geometry = geom;
    },
    setShaderMode(mode) {
      uniforms.uShaderMode.value = mode;
    },
    setColorPalette(palette) {
      uniforms.uColorPalette.value = palette;
    },
    setSpeed(speed) {
      uniforms.uSpeed.value = speed;
    },
    setFrequency(frequency) {
      uniforms.uFrequency.value = frequency;
    },
    setIntensity(intensity) {
      uniforms.uIntensity.value = intensity;
    },
    setWireframe(visible) {
      wireframeMesh.visible = visible;
    },
    resetCamera() {
      controls.reset();
      camera.position.copy(defaultCameraPos);
      controls.target.set(0, 0, 0);
    },
    resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    },
    dispose() {
      cancelAnimationFrame(rafHandle);
      controls.dispose();
      renderer.dispose();
      manifoldMaterial.dispose();
      wireframeMaterial.dispose();
      particleMat.dispose();
      particleGeom.dispose();
      for (const geom of Object.values(geometries)) geom.dispose();
    },
  };
}
