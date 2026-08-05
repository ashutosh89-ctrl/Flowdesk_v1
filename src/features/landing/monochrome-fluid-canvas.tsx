import React, { useEffect, useRef, useState } from 'react';

// Minimal Simplex Noise — paste as-is
class SimplexNoise {
  p: Uint8Array;
  perm: Uint8Array;
  permMod12: Uint8Array;
  grad3: number[][];

  constructor(seed = Math.random()) {
    this.p = new Uint8Array(256);
    this.perm = new Uint8Array(512);
    this.permMod12 = new Uint8Array(512);
    for (let i = 0; i < 256; i++) this.p[i] = i;
    for (let i = 0; i < 256; i++) {
      const r = (i + Math.floor(seed * (256 - i))) % 256;
      [this.p[i], this.p[r]] = [this.p[r], this.p[i]];
      seed = ((seed * 16807 + 0) % 2147483647) / 2147483647;
    }
    for (let i = 0; i < 512; i++) {
      this.perm[i] = this.p[i & 255];
      this.permMod12[i] = this.perm[i] % 12;
    }
    this.grad3 = [
      [1, 1, 0],
      [-1, 1, 0],
      [1, -1, 0],
      [-1, -1, 0],
      [1, 0, 1],
      [-1, 0, 1],
      [1, 0, -1],
      [-1, 0, -1],
      [0, 1, 1],
      [0, -1, 1],
      [0, 1, -1],
      [0, -1, -1],
    ];
  }

  noise2D(xin: number, yin: number) {
    const F2 = 0.5 * (Math.sqrt(3) - 1);
    const G2 = (3 - Math.sqrt(3)) / 6;
    let n0, n1, n2;
    const s = (xin + yin) * F2;
    const i = Math.floor(xin + s);
    const j = Math.floor(yin + s);
    const t = (i + j) * G2;
    const X0 = i - t;
    const Y0 = j - t;
    const x0 = xin - X0;
    const y0 = yin - Y0;
    const i1 = x0 > y0 ? 1 : 0;
    const j1 = x0 > y0 ? 0 : 1;
    const x1 = x0 - i1 + G2;
    const y1 = y0 - j1 + G2;
    const x2 = x0 - 1 + 2 * G2;
    const y2 = y0 - 1 + 2 * G2;
    const ii = i & 255;
    const jj = j & 255;
    const gi0 = this.permMod12[ii + this.perm[jj]];
    const gi1 = this.permMod12[ii + i1 + this.perm[jj + j1]];
    const gi2 = this.permMod12[ii + 1 + this.perm[jj + 1]];
    let t0 = 0.5 - x0 * x0 - y0 * y0;
    n0 = t0 < 0 ? 0 : ((t0 *= t0), t0 * t0 * (this.grad3[gi0][0] * x0 + this.grad3[gi0][1] * y0));
    let t1 = 0.5 - x1 * x1 - y1 * y1;
    n1 = t1 < 0 ? 0 : ((t1 *= t1), t1 * t1 * (this.grad3[gi1][0] * x1 + this.grad3[gi1][1] * y1));
    let t2 = 0.5 - x2 * x2 - y2 * y2;
    n2 = t2 < 0 ? 0 : ((t2 *= t2), t2 * t2 * (this.grad3[gi2][0] * x2 + this.grad3[gi2][1] * y2));
    return 70 * (n0 + n1 + n2);
  }
}

const simplex = new SimplexNoise();

function map(n: number, start1: number, stop1: number, start2: number, stop2: number) {
  return ((n - start1) / (stop1 - start1)) * (stop2 - start2) + start2;
}

interface Bounds {
  x: { min: number; max: number };
  y: { min: number; max: number };
}

class Orb {
  fill: string;
  bounds: Bounds;
  x: number;
  y: number;
  radius: number;
  scale: number;
  xOff: number;
  yOff: number;
  scaleOff: number;
  inc: number;

  constructor(fill: string, boundsOrigin: { x: number; y: number }, maxDistFactor: number) {
    this.fill = fill;
    this.bounds = this.setBounds(boundsOrigin, maxDistFactor);
    this.x = map(Math.random(), 0, 1, this.bounds.x.min, this.bounds.x.max);
    this.y = map(Math.random(), 0, 1, this.bounds.y.min, this.bounds.y.max);
    this.radius = map(Math.random(), 0, 1, window.innerHeight / 5, window.innerHeight / 2.5);
    this.scale = 1;
    this.xOff = Math.random() * 1000;
    this.yOff = Math.random() * 1000;
    this.scaleOff = Math.random() * 1000;
    this.inc = 0.0015; // Noise step speed — controls flow speed
  }

  setBounds(origin: { x: number; y: number }, factor: number): Bounds {
    const maxDist = window.innerWidth < 1000 ? window.innerWidth / 2.5 : window.innerWidth / factor;
    return {
      x: { min: origin.x - maxDist, max: origin.x + maxDist },
      y: { min: origin.y - maxDist, max: origin.y + maxDist },
    };
  }

  update() {
    const xNoise = simplex.noise2D(this.xOff, this.xOff);
    const yNoise = simplex.noise2D(this.yOff, this.yOff);
    const scaleNoise = simplex.noise2D(this.scaleOff, this.scaleOff);

    this.x = map(xNoise, -1, 1, this.bounds.x.min, this.bounds.x.max);
    this.y = map(yNoise, -1, 1, this.bounds.y.min, this.bounds.y.max);
    this.scale = map(scaleNoise, -1, 1, 0.6, 1.3);

    this.xOff += this.inc;
    this.yOff += this.inc;
    this.scaleOff += this.inc * 0.7;
  }

  render(ctx: CanvasRenderingContext2D) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.scale(this.scale, this.scale);

    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
    gradient.addColorStop(0, this.fill);
    gradient.addColorStop(1, 'rgba(0,0,0,0)');

    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

export const MonochromeFluidCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const [prefersReducedMotion] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(prefers-reduced-motion: reduce)').matches : false
  );

  useEffect(() => {
    if (prefersReducedMotion) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;

    const configs = [
      { origin: { x: window.innerWidth * 0.65, y: window.innerHeight * 0.55 }, factor: 3 },
      { origin: { x: window.innerWidth * 0.25, y: window.innerHeight * 0.45 }, factor: 2.5 },
      { origin: { x: window.innerWidth * 0.5, y: window.innerHeight * 0.75 }, factor: 2 },
      { origin: { x: window.innerWidth * 0.4, y: window.innerHeight * 0.3 }, factor: 3.5 },
      { origin: { x: window.innerWidth * 0.8, y: window.innerHeight * 0.4 }, factor: 2.8 },
    ];

    const orbs: Orb[] = [
      new Orb('rgba(255, 248, 240, 0.14)', configs[0].origin, configs[0].factor),
      new Orb('rgba(245, 235, 220, 0.09)', configs[1].origin, configs[1].factor),
      new Orb('rgba(200, 190, 175, 0.06)', configs[2].origin, configs[2].factor),
      new Orb('rgba(255, 250, 245, 0.07)', configs[3].origin, configs[3].factor),
      new Orb('rgba(180, 170, 155, 0.04)', configs[4].origin, configs[4].factor),
    ];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      orbs.forEach((orb, i) => {
        const c = [
          { origin: { x: window.innerWidth * 0.65, y: window.innerHeight * 0.55 }, factor: 3 },
          { origin: { x: window.innerWidth * 0.25, y: window.innerHeight * 0.45 }, factor: 2.5 },
          { origin: { x: window.innerWidth * 0.5, y: window.innerHeight * 0.75 }, factor: 2 },
          { origin: { x: window.innerWidth * 0.4, y: window.innerHeight * 0.3 }, factor: 3.5 },
          { origin: { x: window.innerWidth * 0.8, y: window.innerHeight * 0.4 }, factor: 2.8 },
        ];
        orb.bounds = orb.setBounds(c[i].origin, c[i].factor);
      });
    };

    resize();
    window.addEventListener('resize', resize);

    const animate = () => {
      ctx.fillStyle = '#0A0A0A';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const isMobile = window.innerWidth < 768;
      ctx.filter = isMobile ? 'blur(60px)' : 'blur(100px)';

      orbs.forEach((orb) => {
        orb.update();
        orb.render(ctx);
      });

      ctx.filter = 'none';
      animationFrameId = requestAnimationFrame(animate);
    };

    canvas.style.opacity = '0';
    canvas.style.transition = 'opacity 1.8s ease-out';
    animationFrameId = requestAnimationFrame(() => {
      canvas.style.opacity = '1';
      animate();
    });

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', resize);
    };
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) {
    return (
      <div
        className="absolute inset-0 pointer-events-none -z-10"
        style={{
          background: 'linear-gradient(135deg, #0A0A0A 0%, #111111 50%, #0A0A0A 100%)',
        }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className="flow-canvas absolute inset-0 w-full h-full pointer-events-none -z-10 block"
    />
  );
};

