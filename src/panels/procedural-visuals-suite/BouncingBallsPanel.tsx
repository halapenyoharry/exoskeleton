import { useEffect, useRef } from "react";
import type { IDockviewPanelProps } from "dockview";
import { subscribeOsc, sendOsc, retain } from "./channels";
import type { ProceduralSuiteParams } from "./types";
import { getAvailableAddress, getControlAddress, getPingAddress } from "./channels";
import "./Panel.css";

const MIN_R = 8;
const MAX_R = 22;
const FRICTION = 0.9995;
const PALETTE = ['#7c6af5','#f5a623','#4ecca3','#f26d85','#61c0ff','#f5e642'];

type Ball = { x: number; y: number; vx: number; vy: number; r: number; color: string };

function randomBall(w: number, h: number): Ball {
  const r = MIN_R + Math.random() * (MAX_R - MIN_R);
  return {
    x: r + Math.random() * (w - 2 * r),
    y: r + Math.random() * (h / 2),
    vx: (Math.random() - .5) * 6,
    vy: (Math.random() - .5) * 6,
    r,
    color: PALETTE[Math.floor(Math.random() * PALETTE.length)],
  };
}

export default function BouncingBallsPanel(props: IDockviewPanelProps<ProceduralSuiteParams>) {
  const docId = props.params?.documentId || "default";
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ballsRef = useRef<Ball[]>([]);

  // Physics params isolated to panel instance
  const paramsRef = useRef({
    gravity: 10,
    restitution: 0.85,
    ballCount: 20
  });

  useEffect(() => {
    // 1. Announce presence to Control Panel
    const availableAddress = getAvailableAddress(docId, 'bouncing-balls');
    retain(availableAddress);
    sendOsc(availableAddress, [{ type: 'bool', value: true }]);

    // Respond to pings
    const unsubPing = subscribeOsc(getPingAddress(docId), () => {
      sendOsc(availableAddress, [{ type: 'bool', value: true }]);
    });

    // 2. Listen to Control changes via OSC
    const unsubCount = subscribeOsc(getControlAddress(docId, 'bouncing-balls', 'count'), (_, args) => {
      paramsRef.current.ballCount = Number(args[0]?.value ?? 20);
      const w = canvasRef.current?.width || 800;
      const h = canvasRef.current?.height || 600;
      while (ballsRef.current.length < paramsRef.current.ballCount) ballsRef.current.push(randomBall(w, h));
      while (ballsRef.current.length > paramsRef.current.ballCount) ballsRef.current.pop();
    });

    const unsubGrav = subscribeOsc(getControlAddress(docId, 'bouncing-balls', 'gravity'), (_, args) => {
      paramsRef.current.gravity = Number(args[0]?.value ?? 10);
    });

    const unsubRest = subscribeOsc(getControlAddress(docId, 'bouncing-balls', 'restitution'), (_, args) => {
      paramsRef.current.restitution = Number(args[0]?.value ?? 85) / 100.0;
    });

    const unsubReset = subscribeOsc(getControlAddress(docId, 'bouncing-balls', 'reset'), () => {
      const w = canvasRef.current?.width || 800;
      const h = canvasRef.current?.height || 600;
      ballsRef.current = Array.from({ length: paramsRef.current.ballCount }, () => randomBall(w, h));
    });

    return () => {
      sendOsc(availableAddress, [{ type: 'bool', value: false }]);
      unsubPing(); unsubCount(); unsubGrav(); unsubRest(); unsubReset();
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

    ballsRef.current = Array.from({ length: paramsRef.current.ballCount }, () => randomBall(canvas.width, canvas.height));

    let animationFrameId: number;
    const DT = 1 / 60;

    const loop = () => {
      const W = canvas.width;
      const H = canvas.height;
      const balls = ballsRef.current;

      // Physics step
      const { gravity, restitution } = paramsRef.current;
      for (const b of balls) {
        b.vy += gravity * DT;
        b.vx *= FRICTION;
        b.vy *= FRICTION;
        b.x  += b.vx;
        b.y  += b.vy;

        if (b.x - b.r < 0)  { b.x = b.r;    b.vx = Math.abs(b.vx) * restitution; }
        if (b.x + b.r > W)  { b.x = W - b.r; b.vx = -Math.abs(b.vx) * restitution; }
        if (b.y - b.r < 0)  { b.y = b.r;    b.vy = Math.abs(b.vy) * restitution; }
        if (b.y + b.r > H)  { b.y = H - b.r; b.vy = -Math.abs(b.vy) * restitution; }
      }

      for (let i = 0; i < balls.length; i++) {
        for (let j = i + 1; j < balls.length; j++) {
          const a = balls[i], b = balls[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = a.r + b.r;
          if (dist < minDist && dist > 0) {
            const overlap = (minDist - dist) / 2;
            const nx = dx / dist, ny = dy / dist;
            a.x -= nx * overlap; a.y -= ny * overlap;
            b.x += nx * overlap; b.y += ny * overlap;

            const dvx = a.vx - b.vx, dvy = a.vy - b.vy;
            const dot = dvx * nx + dvy * ny;
            if (dot > 0) {
              const impulse = dot * restitution;
              a.vx -= impulse * nx; a.vy -= impulse * ny;
              b.vx += impulse * nx; b.vy += impulse * ny;
            }
          }
        }
      }

      // Render
      ctx.fillStyle = '#13131a';
      ctx.fillRect(0, 0, W, H);
      for (const b of balls) {
        const grd = ctx.createRadialGradient(b.x - b.r * .3, b.y - b.r * .3, b.r * .1, b.x, b.y, b.r);
        grd.addColorStop(0, b.color + 'cc');
        grd.addColorStop(1, b.color + '33');
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = grd;
        ctx.fill();
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
