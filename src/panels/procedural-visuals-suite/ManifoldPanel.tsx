import { useEffect, useRef } from "react";
import type { IDockviewPanelProps } from "dockview";
import { subscribeOsc, sendOsc, retain } from "./channels";
import type { ProceduralSuiteParams } from "./types";
import { getAvailableAddress, getControlAddress, getPingAddress } from "./channels";
import { initManifoldScene, type ManifoldSceneHandle, type ManifoldSurface } from "./manifold-scene";
import "./Panel.css";

export default function ManifoldPanel(props: IDockviewPanelProps<ProceduralSuiteParams>) {
  const docId = props.params?.documentId || "default";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<ManifoldSceneHandle | null>(null);

  useEffect(() => {
    const availableAddress = getAvailableAddress(docId, "manifold");
    retain(availableAddress);
    sendOsc(availableAddress, [{ type: "bool", value: true }]);

    const unsubPing = subscribeOsc(getPingAddress(docId), () => {
      sendOsc(availableAddress, [{ type: "bool", value: true }]);
    });

    const unsubSurface = subscribeOsc(getControlAddress(docId, "manifold", "surface"), (_, args) => {
      sceneRef.current?.setSurface(String(args[0]?.value) as ManifoldSurface);
    });
    const unsubShader = subscribeOsc(getControlAddress(docId, "manifold", "shaderMode"), (_, args) => {
      sceneRef.current?.setShaderMode(Number(args[0]?.value ?? 0));
    });
    const unsubPalette = subscribeOsc(getControlAddress(docId, "manifold", "colorPalette"), (_, args) => {
      sceneRef.current?.setColorPalette(Number(args[0]?.value ?? 0));
    });
    const unsubSpeed = subscribeOsc(getControlAddress(docId, "manifold", "speed"), (_, args) => {
      sceneRef.current?.setSpeed(Number(args[0]?.value ?? 1));
    });
    const unsubWireframe = subscribeOsc(getControlAddress(docId, "manifold", "wireframe"), (_, args) => {
      sceneRef.current?.setWireframe(Boolean(args[0]?.value));
    });
    const unsubResetCamera = subscribeOsc(getControlAddress(docId, "manifold", "resetCamera"), () => {
      sceneRef.current?.resetCamera();
    });

    return () => {
      sendOsc(availableAddress, [{ type: "bool", value: false }]);
      unsubPing();
      unsubSurface();
      unsubShader();
      unsubPalette();
      unsubSpeed();
      unsubWireframe();
      unsubResetCamera();
    };
  }, [docId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.parentElement?.clientWidth || 800;
    const height = canvas.parentElement?.clientHeight || 600;
    const scene = initManifoldScene(canvas, width, height);
    scene.setSurface("klein");
    sceneRef.current = scene;

    const resize = () => {
      const w = canvas.parentElement?.clientWidth || 800;
      const h = canvas.parentElement?.clientHeight || 600;
      scene.resize(w, h);
    };
    window.addEventListener("resize", resize);
    resize();

    return () => {
      window.removeEventListener("resize", resize);
      scene.dispose();
      sceneRef.current = null;
    };
  }, []);

  return (
    <div className="procedural-viz-root">
      <canvas ref={canvasRef} />
    </div>
  );
}
