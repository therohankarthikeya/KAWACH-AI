"use client";

import { useEffect, useRef, useState } from "react";

// Total visible duration: ~2.6 s
// Canvas ring animation:  0 → 1800 ms
// Fade-out starts:        2000 ms  (transition-duration 700 ms)
// Unmount (DOM removal):  2750 ms

export default function IntroSplash() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [fading, setFading] = useState(false);
  const [mounted, setMounted] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    const RING_DURATION = 1800; // ms – ring expands over this period
    let startTime: number | null = null;

    // ── size canvas to physical pixels (sharp on HiDPI) ──────────────────────
    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      // CSS keeps canvas filling the viewport
      canvas.style.width = `${window.innerWidth}px`;
      canvas.style.height = `${window.innerHeight}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    // ── render loop ──────────────────────────────────────────────────────────
    const render = (now: number) => {
      if (startTime === null) startTime = now;
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / RING_DURATION, 1);
      // Cubic ease-out so it starts fast and decelerates
      const eased = 1 - Math.pow(1 - progress, 3);

      const W = window.innerWidth;
      const H = window.innerHeight;
      const cx = W / 2;
      const cy = H / 2;
      // maxRadius: corner-to-centre diagonal so the ring fully exits the frame
      const maxRadius = Math.hypot(cx, cy) * 1.4;
      const radius = eased * maxRadius;
      const ringThickness = Math.max(50, maxRadius * 0.16);

      ctx.clearRect(0, 0, W, H);

      // ── prismatic ring ───────────────────────────────────────────────────
      if (radius > 1) {
        const inner = Math.max(0, radius - ringThickness);
        const outer = radius + ringThickness * 0.6;

        const grad = ctx.createRadialGradient(cx, cy, inner, cx, cy, outer);
        grad.addColorStop(0.00, "rgba(5,6,8,0)");
        grad.addColorStop(0.22, "rgba(56,189,248,0.6)");   // electric cyan #38bdf8
        grad.addColorStop(0.50, "rgba(255,255,255,0.95)"); // white hot core
        grad.addColorStop(0.78, "rgba(245,158,11,0.6)");   // warm gold #f59e0b
        grad.addColorStop(1.00, "rgba(5,6,8,0)");

        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, W, H);
      }

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(render);
      }
    };

    animationFrameId = requestAnimationFrame(render);

    // ── lifecycle timers ─────────────────────────────────────────────────────
    const fadeTimer   = setTimeout(() => setFading(true),   2000);
    const unmountTimer = setTimeout(() => setMounted(false), 2750);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resize);
      clearTimeout(fadeTimer);
      clearTimeout(unmountTimer);
    };
  }, []);

  if (!mounted) return null;

  return (
    <div
      aria-hidden="true"
      className={[
        "fixed inset-0 z-[9999] flex items-center justify-center overflow-hidden bg-[#050608]",
        "transition-opacity duration-700",
        fading ? "pointer-events-none opacity-0" : "opacity-100",
      ].join(" ")}
    >
      {/* ── prismatic ring canvas ── */}
      <canvas
        ref={canvasRef}
        className="absolute inset-0"
        style={{ width: "100%", height: "100%" }}
      />

      {/* ── diagonal fluted / reeded glass ribs ── */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          backgroundImage: `repeating-linear-gradient(
            -35deg,
            rgba(255,255,255,0.055) 0px,
            rgba(255,255,255,0.012) 2px,
            rgba(5,6,8,0.68)        9px,
            rgba(5,6,8,0.84)       17px
          )`,
        }}
      />

      {/* ── wordmark – fades in after 400 ms ── */}
      <div
        className="relative z-10 flex flex-col items-center text-center"
        style={{ animation: "fadeIn 0.9s ease-out 0.4s both" }}
      >
        {/* pill badge */}
        <div className="mb-4 flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.28em] text-cyan-300">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400" />
          Find Leads . Review Them . Decide
        </div>

        {/* wordmark */}
        <h1 className="text-5xl font-extrabold tracking-[0.22em] text-white drop-shadow-[0_0_28px_rgba(255,255,255,0.4)] sm:text-6xl">
          KAWACH{" "}
          <span className="text-cyan-400">//</span>
          {" "}AI
        </h1>

        {/* subtitle */}
        <p
          className="mt-3 text-[11px] font-medium uppercase tracking-[0.35em] text-white/50"
          style={{ animation: "fadeIn 0.9s ease-out 0.75s both" }}
        >
          BY BRAND NEW TEAM
        </p>
      </div>
    </div>
  );
}
