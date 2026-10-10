// A flat text label as a Mesh (PlaneGeometry + canvas texture), for
// labels that must lie ALONG a direction in the scene instead of always
// facing the viewer. three-spritetext is the right tool for node labels
// (billboards); edge labels want to read like  ----- label ---->  so
// they need a real orientable plane. Same canvas-rendering approach,
// no fonts fetched.

import * as THREE from "three";

export interface TextPlaneOptions {
  textHeight: number;
  color: string;
  fontFace: string;
  fontWeight: string;
  /** Canvas pixels per unit of text height — crispness vs. memory. */
  resolution: number;
  strokeWidth: number;
  strokeColor: string;
  backgroundColor?: string;
  padding: number;
}

export interface TextPlane {
  mesh: THREE.Mesh;
  dispose(): void;
}

export function makeTextPlane(text: string, o: TextPlaneOptions): TextPlane {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;
  const fontPx = o.resolution;
  const font = `${o.fontWeight} ${fontPx}px ${o.fontFace}`;
  ctx.font = font;
  const metrics = ctx.measureText(text);
  const padPx = o.padding * fontPx;
  const w = Math.max(1, Math.ceil(metrics.width + padPx * 2));
  const h = Math.ceil(fontPx * 1.3 + padPx * 2);
  canvas.width = w;
  canvas.height = h;

  if (o.backgroundColor) {
    ctx.fillStyle = o.backgroundColor;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.font = font;
  ctx.textBaseline = "middle";
  ctx.textAlign = "center";
  if (o.strokeWidth > 0) {
    ctx.lineWidth = o.strokeWidth * fontPx;
    ctx.lineJoin = "round";
    ctx.strokeStyle = o.strokeColor;
    ctx.strokeText(text, w / 2, h / 2);
  }
  ctx.fillStyle = o.color;
  ctx.fillText(text, w / 2, h / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const worldH = o.textHeight * (h / fontPx);
  const worldW = worldH * (w / h);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(worldW, worldH), material);
  mesh.frustumCulled = false;
  return {
    mesh,
    dispose() {
      mesh.geometry.dispose();
      material.dispose();
      texture.dispose();
    },
  };
}

const _x = new THREE.Vector3();
const _y = new THREE.Vector3();
const _z = new THREE.Vector3();
const _toCam = new THREE.Vector3();
const _camRight = new THREE.Vector3();
const _m = new THREE.Matrix4();

/**
 * Orient `obj` so its local +X runs from `start` to `end` and its face
 * turns toward the camera as far as that constraint allows (a billboard
 * hinged on the edge). Flips 180° about the view axis when the edge
 * points leftward on screen so the text never reads mirrored or upside
 * down.
 */
export function orientAlong(
  obj: THREE.Object3D,
  start: THREE.Vector3,
  end: THREE.Vector3,
  camera: THREE.Camera,
): void {
  _x.subVectors(end, start);
  if (_x.lengthSq() < 1e-9) return;
  _x.normalize();
  obj.position.addVectors(start, end).multiplyScalar(0.5);
  _toCam.subVectors(camera.position, obj.position);
  // z = component of toCam perpendicular to x (the face normal)
  _z.copy(_toCam).addScaledVector(_x, -_toCam.dot(_x));
  if (_z.lengthSq() < 1e-9) _z.set(0, 0, 1);
  _z.normalize();
  _y.crossVectors(_z, _x).normalize();
  // Keep text left-to-right on screen: compare x with the camera's right.
  _camRight.set(1, 0, 0).applyQuaternion(camera.quaternion);
  if (_x.dot(_camRight) < 0) {
    _x.negate();
    _y.negate();
  }
  _m.makeBasis(_x, _y, _z);
  obj.quaternion.setFromRotationMatrix(_m);
}
