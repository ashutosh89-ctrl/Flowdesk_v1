import React, { useEffect, useRef, useState } from 'react';

// Minimal Simplex Noise implementation
class SimplexNoise {
  p: Uint8Array;
  perm: Uint8Array;
  permMod12: Uint8Array;
  grad3: number[][];

  constructor(seed = 0.3872) {
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

interface LiquidBodyConfig {
  originRatio: { x: number; y: number };
  baseRadiusRatio: { rx: number; ry: number };
  colors: { core: string; mid: string; outer: string };
  noiseSeed: number;
  speed: number;
}

export const MonochromeFluidCanvas: React.FC<{ className?: string }> = ({ className = '' }) => {
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

    // Mouse & physics tracking
    const mouse = {
      x: -1000,
      y: -1000,
      targetX: -1000,
      targetY: -1000,
      vx: 0,
      vy: 0,
      lastX: -1000,
      lastY: -1000,
      active: false,
    };

    // Scroll physics tracking
    const scrollState = {
      y: typeof window !== 'undefined' ? window.scrollY : 0,
      targetY: typeof window !== 'undefined' ? window.scrollY : 0,
      velocity: 0,
    };

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.targetX = e.clientX - rect.left;
      mouse.targetY = e.clientY - rect.top;
      mouse.active = true;
    };

    const handleMouseLeave = () => {
      mouse.active = false;
    };

    const handleScroll = () => {
      scrollState.targetY = window.scrollY;
    };

    window.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseleave', handleMouseLeave);
    window.addEventListener('scroll', handleScroll, { passive: true });

    // Defined Organic Fluid Bodies according to prompt specs:
    // Left Edge Body (x = -0.2w to 0.35w)
    // Right Edge Body (x = 0.7w to 1.25w)
    // Bottom Rising Body (behind dashboard preview)
    // Central Pearl Swirls
    const fluidConfigs: LiquidBodyConfig[] = [
      {
        originRatio: { x: -0.05, y: 0.35 },
        baseRadiusRatio: { rx: 0.38, ry: 0.45 },
        colors: {
          core: 'rgba(255, 252, 245, 0.22)',
          mid: 'rgba(245, 238, 224, 0.12)',
          outer: 'rgba(200, 190, 175, 0.03)',
        },
        noiseSeed: 100,
        speed: 0.0008,
      },
      {
        originRatio: { x: 1.02, y: 0.28 },
        baseRadiusRatio: { rx: 0.42, ry: 0.48 },
        colors: {
          core: 'rgba(255, 248, 238, 0.20)',
          mid: 'rgba(240, 230, 215, 0.10)',
          outer: 'rgba(180, 170, 155, 0.025)',
        },
        noiseSeed: 250,
        speed: 0.0007,
      },
      {
        originRatio: { x: 0.5, y: 0.72 },
        baseRadiusRatio: { rx: 0.45, ry: 0.35 },
        colors: {
          core: 'rgba(255, 250, 242, 0.18)',
          mid: 'rgba(235, 225, 210, 0.08)',
          outer: 'rgba(160, 150, 140, 0.02)',
        },
        noiseSeed: 400,
        speed: 0.0009,
      },
      {
        originRatio: { x: 0.35, y: 0.22 },
        baseRadiusRatio: { rx: 0.28, ry: 0.32 },
        colors: {
          core: 'rgba(255, 255, 250, 0.16)',
          mid: 'rgba(245, 238, 226, 0.07)',
          outer: 'rgba(190, 180, 165, 0.015)',
        },
        noiseSeed: 550,
        speed: 0.0011,
      },
      {
        originRatio: { x: 0.68, y: 0.52 },
        baseRadiusRatio: { rx: 0.32, ry: 0.38 },
        colors: {
          core: 'rgba(250, 242, 230, 0.15)',
          mid: 'rgba(225, 215, 200, 0.06)',
          outer: 'rgba(150, 140, 130, 0.01)',
        },
        noiseSeed: 700,
        speed: 0.00085,
      },
    ];

    let time = 0;

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      ctx.scale(dpr, dpr);
    };

    resize();
    window.addEventListener('resize', resize);

    const render = () => {
      time += 0.015;

      const width = canvas.width / (Math.min(window.devicePixelRatio || 1, 2));
      const height = canvas.height / (Math.min(window.devicePixelRatio || 1, 2));
      const isMobile = width < 768;

      // Mouse Physics Interpolation with Spring & Velocity
      if (mouse.active) {
        mouse.vx = (mouse.targetX - mouse.x) * 0.08;
        mouse.vy = (mouse.targetY - mouse.y) * 0.08;
        mouse.x += mouse.vx;
        mouse.y += mouse.vy;
      } else {
        // Ambient drift when mouse inactive
        const driftX = width * 0.5 + Math.sin(time * 0.4) * (width * 0.15);
        const driftY = height * 0.4 + Math.cos(time * 0.3) * (height * 0.12);
        mouse.x += (driftX - mouse.x) * 0.02;
        mouse.y += (driftY - mouse.y) * 0.02;
        mouse.vx *= 0.9;
        mouse.vy *= 0.9;
      }

      // Scroll Physics Interpolation
      const scrollDiff = scrollState.targetY - scrollState.y;
      scrollState.velocity += (scrollDiff - scrollState.velocity) * 0.1;
      scrollState.y += (scrollState.targetY - scrollState.y) * 0.08;

      const cursorSpeed = Math.sqrt(mouse.vx * mouse.vx + mouse.vy * mouse.vy);

      // Clear Charcoal Base (#070708)
      ctx.fillStyle = '#070708';
      ctx.fillRect(0, 0, width, height);

      ctx.filter = 'none';

      // Render each Deformed Organic Fluid Body
      fluidConfigs.forEach((config) => {
        const numPoints = isMobile ? 10 : 16;
        const centerX = config.originRatio.x * width + Math.sin(time * config.speed * 800 + config.noiseSeed) * (width * 0.04);
        const centerY = config.originRatio.y * height + Math.cos(time * config.speed * 600 + config.noiseSeed) * (height * 0.04) - scrollState.y * 0.15;
        const rx = config.baseRadiusRatio.rx * width;
        const ry = config.baseRadiusRatio.ry * height;

        const points: { x: number; y: number }[] = [];

        for (let i = 0; i < numPoints; i++) {
          const angle = (i / numPoints) * Math.PI * 2;

          // Multi-frequency Simplex Noise contour deformation
          const noise1 = simplex.noise2D(
            Math.cos(angle) * 1.2 + time * config.speed * 800 + config.noiseSeed,
            Math.sin(angle) * 1.2 + time * config.speed * 800
          );
          const noise2 = simplex.noise2D(
            Math.cos(angle * 2) * 2.5 + config.noiseSeed,
            Math.sin(angle * 2) * 2.5 + time * config.speed * 400
          ) * 0.35;

          const deformationFactor = 1 + (noise1 + noise2) * 0.35;
          let pointRadiusX = rx * deformationFactor;
          let pointRadiusY = ry * deformationFactor;

          let px = centerX + Math.cos(angle) * pointRadiusX;
          let py = centerY + Math.sin(angle) * pointRadiusY;

          // Interactive Gravitational Mouse Influence Field
          const dx = px - mouse.x;
          const dy = py - mouse.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const influenceRadius = isMobile ? 220 : 380;

          if (dist < influenceRadius) {
            const force = Math.pow(1 - dist / influenceRadius, 2);
            // Dynamic displacement scaled by cursor velocity
            const displacement = force * (35 + Math.min(cursorSpeed * 1.5, 40));
            px += (dx / (dist || 1)) * displacement;
            py += (dy / (dist || 1)) * displacement;
          }

          points.push({ x: px, y: py });
        }

        // Draw Organic Closed Spline Path with Liquid Radial Gradient
        ctx.save();
        ctx.beginPath();
        const firstPoint = points[0];
        const lastPoint = points[points.length - 1];
        ctx.moveTo((firstPoint.x + lastPoint.x) / 2, (firstPoint.y + lastPoint.y) / 2);

        for (let i = 0; i < points.length; i++) {
          const current = points[i];
          const next = points[(i + 1) % points.length];
          const midX = (current.x + next.x) / 2;
          const midY = (current.y + next.y) / 2;
          ctx.quadraticCurveTo(current.x, current.y, midX, midY);
        }
        ctx.closePath();

        // Create Multi-Color Warm Ivory Radial Fluid Gradient
        const maxRadius = Math.max(rx, ry) * 1.2;
        const grad = ctx.createRadialGradient(
          centerX,
          centerY,
          0,
          centerX,
          centerY,
          maxRadius
        );
        grad.addColorStop(0, config.colors.core);
        grad.addColorStop(0.45, config.colors.mid);
        grad.addColorStop(0.85, config.colors.outer);
        grad.addColorStop(1, 'rgba(7, 7, 8, 0)');

        ctx.fillStyle = grad;
        ctx.fill();
        ctx.restore();
      });

      // Layer 4: Floating Cursor Light Spotlight Field
      if (mouse.x > -500) {
        ctx.save();
        const cursorRadius = isMobile ? 180 : 320;
        const cursorGrad = ctx.createRadialGradient(
          mouse.x,
          mouse.y,
          0,
          mouse.x,
          mouse.y,
          cursorRadius
        );
        cursorGrad.addColorStop(0, 'rgba(255, 252, 245, 0.16)');
        cursorGrad.addColorStop(0.4, 'rgba(240, 230, 215, 0.06)');
        cursorGrad.addColorStop(1, 'rgba(7, 7, 8, 0)');

        ctx.fillStyle = cursorGrad;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }

      ctx.filter = 'none';

      animationFrameId = requestAnimationFrame(render);
    };

    canvas.style.opacity = '0';
    canvas.style.transition = 'opacity 1.5s cubic-bezier(0.16, 1, 0.3, 1)';
    animationFrameId = requestAnimationFrame(() => {
      canvas.style.opacity = '1';
      render();
    });

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseleave', handleMouseLeave);
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', resize);
    };
  }, [prefersReducedMotion]);

  if (prefersReducedMotion) {
    return (
      <div
        className={`absolute inset-0 pointer-events-none -z-10 ${className}`}
        style={{
          background: 'linear-gradient(135deg, #070708 0%, #111115 50%, #070708 100%)',
        }}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      className={`flow-canvas absolute inset-0 w-full h-full pointer-events-none -z-10 block blur-[40px] md:blur-[70px] ${className}`}
    />
  );
};
