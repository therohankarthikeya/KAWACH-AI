"use client";

import { ArrowDown, Lock } from "lucide-react";
import { useEffect, useRef, useState } from "react";

// ── types ────────────────────────────────────────────────────────────────────
type Particle = {
  x: number;
  y: number;
  homeX: number;
  homeY: number;
  targetX: number;
  targetY: number;
  vx: number;
  vy: number;
  size: number;
  alpha: number;
  phase: number;
};

// ── shield outline sampler ────────────────────────────────────────────────────
function sampleShieldPoints(
  count: number,
  cx: number,
  cy: number,
  w: number,
  h: number,
): Array<{ x: number; y: number }> {
  const hw = w / 2;
  const hh = h / 2;

  const outline = [
    { x: cx,            y: cy - hh },
    { x: cx + hw * 0.88, y: cy - hh * 0.78 },
    { x: cx + hw,        y: cy + hh * 0.08 },
    { x: cx + hw * 0.55, y: cy + hh * 0.62 },
    { x: cx,             y: cy + hh },
    { x: cx - hw * 0.55, y: cy + hh * 0.62 },
    { x: cx - hw,        y: cy + hh * 0.08 },
    { x: cx - hw * 0.88, y: cy - hh * 0.78 },
  ];

  type Seg = { ax: number; ay: number; bx: number; by: number; len: number };
  const segments: Seg[] = [];
  let totalLen = 0;

  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    segments.push({ ax: a.x, ay: a.y, bx: b.x, by: b.y, len });
    totalLen += len;
  }

  const points: Array<{ x: number; y: number }> = [];
  const band = Math.max(14, w * 0.055);

  for (let i = 0; i < count; i++) {
    const dist = (i / count) * totalLen;
    let acc = 0;
    let seg = segments[0]!;

    for (const s of segments) {
      if (acc + s.len >= dist) { seg = s; break; }
      acc += s.len;
    }

    const t   = seg.len > 0 ? (dist - acc) / seg.len : 0;
    const bx  = seg.ax + (seg.bx - seg.ax) * t;
    const by  = seg.ay + (seg.by - seg.ay) * t;
    const ang = (i * 2.39996) % (Math.PI * 2);
    const r   = (((i * 17) % 100) / 100) * band - band / 2;

    points.push({ x: bx + Math.cos(ang) * r, y: by + Math.sin(ang) * r });
  }

  return points;
}

// ── component ─────────────────────────────────────────────────────────────────
export default function ParticleShieldHero({
  onStartClick,
}: {
  onStartClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [formed, setFormed] = useState(false);
  const formedRef = useRef(false);

  useEffect(() => { formedRef.current = formed; }, [formed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animId: number;
    let particles: Particle[] = [];
    const mouse = { x: -9999, y: -9999, active: false };

    // ── (re)initialise canvas size + particles ──────────────────────────────
    const init = () => {
      const dpr    = Math.min(window.devicePixelRatio || 1, 2);
      const vw     = window.innerWidth;
      const vh     = window.innerHeight;

      // Physical pixels
      canvas.width  = vw * dpr;
      canvas.height = vh * dpr;

      // Keep CSS display size equal to viewport (not stretched by physical pixels)
      canvas.style.width  = `${vw}px`;
      canvas.style.height = `${vh}px`;

      // Scale context so we can draw in CSS-pixel coordinates
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      const shieldCount  = vw < 640 ? 280 : 440;
      const ambientCount = vw < 640 ? 100 : 180;
      const shieldSize   = Math.min(vw * 0.78, vh * 0.66, 520);

      const targets = sampleShieldPoints(
        shieldCount,
        vw / 2,
        vh / 2 - 10,
        shieldSize * 0.88,
        shieldSize,
      );

      particles = [];

      // Shield particles — snap to shield outline
      for (let i = 0; i < shieldCount; i++) {
        const hx = Math.random() * vw;
        const hy = Math.random() * vh;
        particles.push({
          x: hx, y: hy,
          homeX: hx, homeY: hy,
          targetX: targets[i]!.x,
          targetY: targets[i]!.y,
          vx: 0, vy: 0,
          size:  1.4 + Math.random() * 1.1,
          alpha: 0.5  + Math.random() * 0.45,
          phase: Math.random() * Math.PI * 2,
        });
      }

      // Ambient drift particles
      for (let i = 0; i < ambientCount; i++) {
        const hx = Math.random() * vw;
        const hy = Math.random() * vh;
        particles.push({
          x: hx, y: hy,
          homeX: hx, homeY: hy,
          targetX: hx, targetY: hy,
          vx: 0, vy: 0,
          size:  0.9 + Math.random() * 0.9,
          alpha: 0.12 + Math.random() * 0.22,
          phase: Math.random() * Math.PI * 2,
        });
      }
    };

    init();
    window.addEventListener("resize", init);

    // ── mouse / touch tracking ──────────────────────────────────────────────
    const onMove = (e: MouseEvent) => {
      const r   = canvas.getBoundingClientRect();
      mouse.x   = e.clientX - r.left;
      mouse.y   = e.clientY - r.top;
      mouse.active = true;
    };
    const onLeave = () => { mouse.active = false; };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseleave", onLeave);

    // ── render loop ─────────────────────────────────────────────────────────
    let tick = 0;
    const render = () => {
      tick += 0.018;

      const vw = window.innerWidth;
      const vh = window.innerHeight;
      ctx.clearRect(0, 0, vw, vh);

      const isFormed = formedRef.current;

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i]!;
        const isShield = p.targetX !== p.homeX || p.targetY !== p.homeY;

        // Destination with gentle breathing wobble
        const destX = isFormed && isShield
          ? p.targetX + Math.cos(tick + p.phase) * 2.4
          : p.homeX   + Math.cos(tick * 0.6 + p.phase) * 20;
        const destY = isFormed && isShield
          ? p.targetY + Math.sin(tick + p.phase) * 2.4
          : p.homeY   + Math.sin(tick * 0.6 + p.phase) * 20;

        const spring = isFormed && isShield ? 0.055 : 0.014;
        p.vx += (destX - p.x) * spring;
        p.vy += (destY - p.y) * spring;

        // Cursor repulsion
        if (mouse.active) {
          const dx   = p.x - mouse.x;
          const dy   = p.y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 120 && dist > 0.1) {
            const force = ((120 - dist) / 120) * 1.5;
            p.vx += (dx / dist) * force;
            p.vy += (dy / dist) * force;
          }
        }

        p.vx *= 0.84;
        p.vy *= 0.84;
        p.x  += p.vx;
        p.y  += p.vy;

        const a = isFormed && isShield ? p.alpha : p.alpha * 0.4;
        ctx.fillStyle = `rgba(255,255,255,${a.toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", init);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  return (
    <section
      onMouseEnter={() => setFormed(true)}
      onMouseLeave={() => setFormed(false)}
      className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#06090f] px-4 text-center"
    >
      {/* particle canvas – pointer-events-none so clicks pass through */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none absolute inset-0"
        // width/height are set by JS; style keeps it at CSS viewport size
        style={{ width: "100%", height: "100%" }}
      />

      {/* subtle dark radial vignette so text stays readable */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 50%, rgba(6,9,15,0.3) 0%, rgba(6,9,15,0.88) 80%)",
        }}
      />

      {/* ── text content ── */}
      <div className="relative z-10 flex max-w-xl flex-col items-center">
        <p className="mb-3 inline-flex items-center gap-1.5 text-xs font-medium tracking-wide text-slate-400">
          <Lock className="size-3.5 text-teal-300" aria-hidden />
          Zero-Storage Identity Protection
        </p>

        <h1 className="text-4xl font-medium tracking-tight text-white sm:text-6xl sm:leading-[1.1]">
          KAWACH AI
          <span className="mt-2 block text-slate-300">Secure your Identity</span>
        </h1>

        <p className="mt-5 max-w-md text-sm leading-relaxed text-slate-400 sm:text-base">
          Scan public Indian &amp; global web sources using only a temporary
          in-memory live selfie. Nothing is ever saved.
        </p>

        <div className="mt-8 flex items-center justify-center">
          <button
            type="button"
            onClick={onStartClick}
            className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-medium text-slate-950 shadow-lg shadow-white/10 transition hover:bg-slate-200 active:scale-95"
          >
            Start Searching
            <ArrowDown className="size-4" aria-hidden />
          </button>
        </div>
      </div>

      {/* scroll cue */}
      <button
        type="button"
        onClick={onStartClick}
        className="absolute bottom-8 z-10 flex flex-col items-center gap-2 text-xs uppercase tracking-widest text-slate-400 transition hover:text-white"
      >
        <span>Scroll down to scan</span>
        <ArrowDown className="size-4 animate-bounce text-teal-300" aria-hidden />
      </button>
    </section>
  );
}
