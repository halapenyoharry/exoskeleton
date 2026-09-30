import { useEffect, useRef } from "react";
import type { IDockviewPanelProps } from "dockview";
import { subscribeOsc, sendOsc, retain } from "./channels";
import type { ProceduralSuiteParams } from "./types";
import { getAvailableAddress, getControlAddress, getPingAddress } from "./channels";
import "./Panel.css";

const baseGravity = 0.15;

const interpolators: Record<string, (t: number) => string> = {
  viridis: (t) => {
    const r = Math.floor(255 * (0.267 + 0.7 * t));
    const g = Math.floor(255 * (0.005 + 0.9 * t));
    const b = Math.floor(255 * (0.329 + 0.1 * (1 - t)));
    return `rgb(${r}, ${g}, ${b})`;
  },
  turbo: (t) => {
    const r = Math.floor(255 * Math.sin(t * Math.PI));
    const g = Math.floor(255 * Math.sin(t * Math.PI + 0.5));
    const b = Math.floor(255 * Math.cos(t * Math.PI * 0.5));
    return `rgb(${r}, ${g}, ${b})`;
  },
  magma: (t) => {
    const r = Math.floor(255 * Math.pow(t, 0.5));
    const g = Math.floor(255 * Math.pow(t, 1.5));
    const b = Math.floor(255 * Math.pow(t, 3.0));
    return `rgb(${r}, ${g}, ${b})`;
  },
  rainbow: (t) => `hsl(${t * 360}, 80%, 60%)`,
  cool: (t) => `hsl(${180 + t * 60}, 80%, 60%)`
};

class Particle {
  x: number; y: number; vx: number; vy: number;
  t: number; life: number; decay: number; baseSize: number; size: number;
  animSpeed: number; colorScheme: string;

  constructor(x: number, y: number, t: number, animSpeed: number, particleSize: number, colorScheme: string) {
    this.x = x;
    this.y = y;
    this.animSpeed = animSpeed;
    this.colorScheme = colorScheme;
    this.vx = (Math.random() - 0.5) * 6 * animSpeed;
    this.vy = ((Math.random() * -10) - 2) * animSpeed;
    this.t = t;
    this.life = 1.0;
    this.decay = (Math.random() * 0.02 + 0.005) * (1 / animSpeed);
    this.baseSize = particleSize;
    this.size = this.baseSize * (0.5 + Math.random() * 0.5);
  }

  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vy += baseGravity * this.animSpeed;
    this.life -= this.decay;
  }

  draw(ctx: CanvasRenderingContext2D) {
    const interpolator = interpolators[this.colorScheme] || interpolators.viridis;
    const color = interpolator(this.t);
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export default function FountainPanel(props: IDockviewPanelProps<ProceduralSuiteParams>) {
  const docId = props.params?.documentId || "default";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);

  const configRef = useRef({
    trailFade: 0.2,
    sources: 1,
    particleSize: 4,
    animSpeed: 1.0,
    colorScheme: 'viridis'
  });

  useEffect(() => {
    const availableAddress = getAvailableAddress(docId, 'fountain');
    retain(availableAddress);
    sendOsc(availableAddress, [{ type: 'bool', value: true }]);

    const unsubPing = subscribeOsc(getPingAddress(docId), () => {
      sendOsc(availableAddress, [{ type: 'bool', value: true }]);
    });

    const unsubs = [
      subscribeOsc(getControlAddress(docId, 'fountain', 'trailFade'), (_, args) => { configRef.current.trailFade = Number(args[0]?.value ?? 0.2); }),
      subscribeOsc(getControlAddress(docId, 'fountain', 'sources'), (_, args) => { configRef.current.sources = Number(args[0]?.value ?? 1); }),
      subscribeOsc(getControlAddress(docId, 'fountain', 'particleSize'), (_, args) => { configRef.current.particleSize = Number(args[0]?.value ?? 4); }),
      subscribeOsc(getControlAddress(docId, 'fountain', 'animSpeed'), (_, args) => { configRef.current.animSpeed = Number(args[0]?.value ?? 1.0); }),
      subscribeOsc(getControlAddress(docId, 'fountain', 'colorScheme'), (_, args) => { configRef.current.colorScheme = String(args[0]?.value ?? 'viridis'); }),
    ];

    return () => {
      sendOsc(availableAddress, [{ type: 'bool', value: false }]);
      unsubPing();
      unsubs.forEach(u => u());
    };
  }, [docId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = canvas.parentElement?.clientWidth || 800;
      canvas.height = canvas.parentElement?.clientHeight || 600;
    };
    window.addEventListener('resize', resize);
    resize();

    let animationFrameId: number;

    const loop = () => {
      const config = configRef.current;
      ctx.fillStyle = `rgba(19, 19, 26, ${config.trailFade})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const spacing = canvas.width / (config.sources + 1);
      for (let i = 1; i <= config.sources; i++) {
        const x = spacing * i;
        const y = canvas.height - 20;
        const t = (i / (config.sources + 1) + Date.now() / 5000) % 1.0;
        const count = Math.floor(Math.random() * 4) + 2;
        for (let j = 0; j < count; j++) {
          particlesRef.current.push(new Particle(x, y, t, config.animSpeed, config.particleSize, config.colorScheme));
        }
      }

      for (let i = particlesRef.current.length - 1; i >= 0; i--) {
        const p = particlesRef.current[i];
        p.update();
        if (p.life <= 0) particlesRef.current.splice(i, 1);
        else p.draw(ctx);
      }

      animationFrameId = requestAnimationFrame(loop);
    };

    loop();

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="procedural-viz-root">
      <canvas ref={canvasRef} />
    </div>
  );
}
