import { useEffect, useRef, useState } from "react";
import type { IDockviewPanelProps } from "dockview";
import { subscribeOsc, sendOsc, retain } from "./channels";
import type { ProceduralSuiteParams } from "./types";
import { getAvailableAddress, getControlAddress, getPingAddress } from "./channels";
import "./Panel.css";

// Utilities ported from recursive-subdivision
function makePRNG(seed: number) {
  let s = seed >>> 0 || 0xdeadbeef;
  return function rand() {
    s ^= s << 13;
    s ^= s >> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

function hexToHsl(hex: string) {
  let r = parseInt(hex.slice(1,3),16)/255;
  let g = parseInt(hex.slice(3,5),16)/255;
  let b = parseInt(hex.slice(5,7),16)/255;
  const max = Math.max(r,g,b), min = Math.min(r,g,b);
  let h = 0, s = 0, l = (max+min)/2;
  if (max!==min) {
    const d = max-min;
    s = l > .5 ? d/(2-max-min) : d/(max+min);
    switch(max){
      case r: h = ((g-b)/d + (g<b?6:0))/6; break;
      case g: h = ((b-r)/d + 2)/6; break;
      case b: h = ((r-g)/d + 4)/6; break;
    }
  }
  return [h*360, s*100, l*100];
}

function hslToHex(h: number, s: number, l: number) {
  h/=360; s/=100; l/=100;
  const hue2rgb = (p: number, q: number, t: number) => {
    if(t<0)t+=1; if(t>1)t-=1;
    if(t<1/6)return p+(q-p)*6*t;
    if(t<1/2)return q;
    if(t<2/3)return p+(q-p)*(2/3-t)*6;
    return p;
  };
  let r,g,b;
  if(s===0){r=g=b=l;}else{
    const q=l<.5?l*(1+s):l+s-l*s, p=2*l-q;
    r=hue2rgb(p,q,h+1/3);
    g=hue2rgb(p,q,h);
    b=hue2rgb(p,q,h-1/3);
  }
  return '#'+[r,g,b].map(v=>Math.round(v*255).toString(16).padStart(2,'0')).join('');
}

export default function RecursiveSubdivisionPanel(props: IDockviewPanelProps<ProceduralSuiteParams>) {
  const docId = props.params?.documentId || "default";
  const svgRef = useRef<SVGSVGElement>(null);

  // State handles the reactive rebuild of the SVG tree
  const [params, setParams] = useState({ depth: 5, variation: 0.6, baseHue: '#7c6af5', seed: Math.floor(Math.random() * 0xFFFFFF) });

  useEffect(() => {
    const availableAddress = getAvailableAddress(docId, 'recursive-subdivision');
    retain(availableAddress);
    sendOsc(availableAddress, [{ type: 'bool', value: true }]);

    const unsubPing = subscribeOsc(getPingAddress(docId), () => {
      sendOsc(availableAddress, [{ type: 'bool', value: true }]);
    });

    const unsubs = [
      subscribeOsc(getControlAddress(docId, 'recursive-subdivision', 'depth'), (_, args) => setParams(p => ({ ...p, depth: Number(args[0]?.value ?? 5) }))),
      subscribeOsc(getControlAddress(docId, 'recursive-subdivision', 'variation'), (_, args) => setParams(p => ({ ...p, variation: Number(args[0]?.value ?? 60) / 100 }))),
      subscribeOsc(getControlAddress(docId, 'recursive-subdivision', 'hue'), (_, args) => setParams(p => ({ ...p, baseHue: String(args[0]?.value ?? '#7c6af5') }))),
      subscribeOsc(getControlAddress(docId, 'recursive-subdivision', 'new-seed'), () => setParams(p => ({ ...p, seed: Math.floor(Math.random() * 0xFFFFFF) }))),
    ];

    return () => {
      sendOsc(availableAddress, [{ type: 'bool', value: false }]);
      unsubPing();
      unsubs.forEach(u => u());
    };
  }, [docId]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;

    // clear svg
    while (svg.firstChild) svg.removeChild(svg.firstChild);

    const rand = makePRNG(params.seed);
    const baseHsl = hexToHsl(params.baseHue);

    // draw bg
    const bg = document.createElementNS('http://www.w3.org/2000/svg','rect');
    bg.setAttribute('width','800'); bg.setAttribute('height','800');
    bg.setAttribute('fill','#0a0a0f');
    svg.appendChild(bg);

    const subdivide = (x: number, y: number, w: number, h: number, depth: number) => {
      if (depth >= params.depth || w < 4 || h < 4) return;
      const split = rand() < 0.5;
      const ratio = 0.25 + rand() * 0.5;
      const drawRect = depth >= 1 && rand() < 0.65;

      if (drawRect) {
        const hShift  = (rand() - .5) * 60 * params.variation;
        const sShift  = (rand() - .5) * 30 * params.variation;
        const lShift  = (rand() - .5) * 25 * params.variation;
        const h2 = (baseHsl[0] + hShift + 360) % 360;
        const s2 = Math.max(0, Math.min(100, baseHsl[1] + sShift));
        const l2 = Math.max(8, Math.min(88, baseHsl[2] + lShift));
        const fill   = hslToHex(h2, s2, l2);
        const alpha  = 0.4 + rand() * 0.55;

        const shape = rand() < 0.25 ? 'ellipse' : 'rect';

        if (shape === 'ellipse') {
          const el = document.createElementNS('http://www.w3.org/2000/svg','ellipse');
          el.setAttribute('cx', String(x + w/2));
          el.setAttribute('cy', String(y + h/2));
          el.setAttribute('rx', String(w/2 * (.6 + rand()*.4)));
          el.setAttribute('ry', String(h/2 * (.6 + rand()*.4)));
          el.setAttribute('fill', fill);
          el.setAttribute('fill-opacity', alpha.toFixed(2));
          svg.appendChild(el);
        } else {
          const pad = rand() * Math.min(w,h) * .15;
          const rect = document.createElementNS('http://www.w3.org/2000/svg','rect');
          rect.setAttribute('x', String(x + pad));
          rect.setAttribute('y', String(y + pad));
          rect.setAttribute('width',  String(Math.max(1, w - pad*2)));
          rect.setAttribute('height', String(Math.max(1, h - pad*2)));
          rect.setAttribute('rx', String(rand() * Math.min(w,h) * .3));
          rect.setAttribute('fill', fill);
          rect.setAttribute('fill-opacity', alpha.toFixed(2));
          svg.appendChild(rect);
        }
      }

      if (split) {
        const cut = w * ratio;
        subdivide(x,       y, cut,   h, depth+1);
        subdivide(x + cut, y, w-cut, h, depth+1);
      } else {
        const cut = h * ratio;
        subdivide(x, y,       w, cut,   depth+1);
        subdivide(x, y + cut, w, h-cut, depth+1);
      }
    };

    subdivide(0, 0, 800, 800, 0);
  }, [params]);

  return (
    <div className="procedural-viz-root">
      <svg ref={svgRef} viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg"></svg>
    </div>
  );
}
