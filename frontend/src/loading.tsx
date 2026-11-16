export default function Loading() {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#060a10] px-6 text-white">
        <div className="relative flex h-28 w-24 items-center justify-center">
          <div
            className="shield-halo pointer-events-none absolute inset-0 rounded-full bg-gradient-to-tr from-teal-400/35 via-sky-300/25 to-white/35 blur-xl"
            aria-hidden
          />
          <svg viewBox="0 0 120 140" className="relative z-10 h-full w-full" aria-hidden>
            <defs>
              <linearGradient id="load-mirror-base" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#f8fafc" />
                <stop offset="25%" stopColor="#94a3b8" />
                <stop offset="50%" stopColor="#1e293b" />
                <stop offset="75%" stopColor="#cbd5e1" />
                <stop offset="100%" stopColor="#475569" />
              </linearGradient>
              <linearGradient id="load-mirror-gleam" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="50%" stopColor="#ffffff" stopOpacity="0.95" />
                <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
              <clipPath id="load-shield-clip">
                <path d="M60 8 L108 26 V66 C108 99 87 122 60 133 C33 122 12 99 12 66 V26 L60 8 Z" />
              </clipPath>
            </defs>
            <path
              d="M60 6 L110 25 V66 C110 101 88 124 60 135 C32 124 10 101 10 66 V25 L60 6 Z"
              fill="url(#load-mirror-base)"
              stroke="rgba(255,255,255,0.7)"
              strokeWidth="1.5"
            />
            <g clipPath="url(#load-shield-clip)">
              <rect
                x="-40"
                y="-20"
                width="55"
                height="180"
                fill="url(#load-mirror-gleam)"
                className="mirror-beam"
              />
            </g>
          </svg>
        </div>
        <p className="mt-6 text-xl font-bold tracking-[0.28em] text-white">KAWACH</p>
        <p className="mt-2 text-xs text-slate-400">Preparing your private workspace…</p>
      </div>
    );
  }