import { useEffect, useRef, useState } from "react";

// ─── Scroll progress hook ─────────────────────────────────────────────────────
function useScrollProgress(ref: React.RefObject<HTMLDivElement | null>) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const onScroll = () => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const total = el.offsetHeight - window.innerHeight;
      const scrolled = -rect.top;
      setProgress(Math.max(0, Math.min(1, scrolled / total)));
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener("scroll", onScroll);
  }, [ref]);

  return progress;
}

// ─── Gold WebGL Canvas ────────────────────────────────────────────────────────
function GoldCanvas({ globalProgress }: { globalProgress: number }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0, H = 0;

    const resize = () => {
      W = canvas.offsetWidth;
      H = canvas.offsetHeight;
      canvas.width = W * devicePixelRatio;
      canvas.height = H * devicePixelRatio;
      ctx.scale(devicePixelRatio, devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Particle pool ─────────────────────────────────────────────────────────
    type P = {
      x: number; y: number;
      vx: number; vy: number;
      r: number; life: number; maxLife: number;
    };
    const pool: P[] = [];

    const spawn = () => {
      const x = W * 0.5 + (Math.random() - 0.5) * W * 0.18;
      pool.push({
        x, y: -10,
        vx: (Math.random() - 0.5) * 0.8,
        vy: 1.8 + Math.random() * 2.5,
        r: 2 + Math.random() * 6,
        life: 0,
        maxLife: 90 + Math.random() * 60,
      });
    };

    let t = 0;

    const draw = () => {
      t++;
      ctx.clearRect(0, 0, W, H);

      const p = globalProgress; // 0 → 1 over whole section

      // ── Phase boundaries ──────────────────────────────────────────────────
      // 0.00 – 0.35  →  gold pours down (close, turbulent)
      // 0.35 – 0.65  →  gold collects, swirls into circle
      // 0.65 – 1.00  →  coin fully formed, glowing, breathes

      const pourP   = Math.min(1, p / 0.35);               // 0→1 during pour
      const formP   = Math.max(0, Math.min(1, (p - 0.35) / 0.30)); // 0→1 during form
      const coinP   = Math.max(0, Math.min(1, (p - 0.65) / 0.35)); // 0→1 coin hold

      // ── 1. Stream ─────────────────────────────────────────────────────────
      if (pourP > 0) {
        // Slight sway — organic, not mechanical
        const swayX = Math.sin(t * 0.018) * 14;
        const streamW = 22 + pourP * 20;

        const sg = ctx.createLinearGradient(W / 2, 0, W / 2, H * 0.72);
        sg.addColorStop(0,   `rgba(255,200,60,0)`);
        sg.addColorStop(0.08,`rgba(255,200,60,${0.95 * pourP})`);
        sg.addColorStop(0.5, `rgba(220,160,30,${0.75 * pourP})`);
        sg.addColorStop(0.85,`rgba(180,120,20,${0.4 * pourP})`);
        sg.addColorStop(1,   `rgba(180,120,20,0)`);

        ctx.beginPath();
        ctx.moveTo(W / 2 + swayX - streamW / 2, 0);
        // Left edge — bezier with organic wobble
        ctx.bezierCurveTo(
          W / 2 + swayX * 0.3 - streamW * 0.9, H * 0.25,
          W / 2 - swayX * 0.5 - streamW * 0.6, H * 0.5,
          W / 2 - swayX * 0.2,                  H * 0.72
        );
        // Right edge
        ctx.bezierCurveTo(
          W / 2 - swayX * 0.5 + streamW * 0.6, H * 0.5,
          W / 2 + swayX * 0.3 + streamW * 0.9, H * 0.25,
          W / 2 + swayX + streamW / 2,           0
        );
        ctx.fillStyle = sg;
        ctx.fill();

        // Inner bright core of stream
        const core = ctx.createLinearGradient(W / 2, H * 0.1, W / 2, H * 0.65);
        core.addColorStop(0,   `rgba(255,235,120,0)`);
        core.addColorStop(0.15,`rgba(255,235,120,${0.7 * pourP})`);
        core.addColorStop(0.6, `rgba(255,220,80,${0.4 * pourP})`);
        core.addColorStop(1,   `rgba(255,220,80,0)`);
        ctx.beginPath();
        ctx.moveTo(W / 2 + swayX - streamW * 0.2, 0);
        ctx.bezierCurveTo(
          W / 2 + swayX * 0.2 - streamW * 0.15, H * 0.3,
          W / 2 - swayX * 0.3 + streamW * 0.1,  H * 0.55,
          W / 2 - swayX * 0.1,                   H * 0.7
        );
        ctx.bezierCurveTo(
          W / 2 - swayX * 0.3 + streamW * 0.15, H * 0.55,
          W / 2 + swayX * 0.2 + streamW * 0.2,  H * 0.3,
          W / 2 + swayX + streamW * 0.2,          0
        );
        ctx.fillStyle = core;
        ctx.fill();
      }

      // ── 2. Particles ──────────────────────────────────────────────────────
      if (pourP > 0.05 && formP < 0.9) {
        const rate = pourP < 0.8 ? 4 : 2;
        for (let i = 0; i < rate; i++) {
          if (pool.length < 280) spawn();
        }
      }

      for (let i = pool.length - 1; i >= 0; i--) {
        const q = pool[i];
        q.life++;
        q.x += q.vx + Math.sin(t * 0.025 + q.y * 0.012) * 0.4;
        q.vy += 0.06;
        q.y += q.vy;

        // During formation — pull particles toward center
        if (formP > 0) {
          const dx = W * 0.5 - q.x;
          const dy = H * 0.5 - q.y;
          q.x += dx * formP * 0.04;
          q.y += dy * formP * 0.04;
          q.vy *= 1 - formP * 0.05;
        }

        const lr = q.life / q.maxLife;
        const a = (1 - lr * lr) * (1 - formP * 0.6);

        const pg = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, q.r * 2.8);
        pg.addColorStop(0, `rgba(255,220,70,${a})`);
        pg.addColorStop(0.5,`rgba(220,160,30,${a * 0.5})`);
        pg.addColorStop(1,  `rgba(180,120,0,0)`);
        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r * 2.8, 0, Math.PI * 2);
        ctx.fillStyle = pg;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(q.x, q.y, q.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,235,110,${a * 0.9})`;
        ctx.fill();

        if (q.life >= q.maxLife || (formP > 0.95 && q.r < 3)) {
          pool.splice(i, 1);
        }
      }

      // ── 3. Pool / collection ──────────────────────────────────────────────
      if (pourP > 0.2) {
        const poolY = H * 0.74;
        const poolRx = W * 0.28 * Math.min(1, pourP * 1.4);
        const poolRy = H * 0.055 * Math.min(1, pourP * 1.4);
        const ripplePhase = (t * 0.008) % 1;

        const pog = ctx.createRadialGradient(W/2, poolY, 0, W/2, poolY, poolRx);
        pog.addColorStop(0,   `rgba(255,215,60,${0.85 * pourP * (1 - formP)})`);
        pog.addColorStop(0.55,`rgba(200,145,20,${0.55 * pourP * (1 - formP)})`);
        pog.addColorStop(1,   `rgba(160,100,0,0)`);
        ctx.beginPath();
        ctx.ellipse(W/2, poolY, poolRx, poolRy, 0, 0, Math.PI * 2);
        ctx.fillStyle = pog;
        ctx.fill();

        // Ripples
        for (let r = 0; r < 3; r++) {
          const rp = ((ripplePhase + r / 3) % 1);
          const rr = poolRx * 0.3 * rp;
          const ra = (1 - rp) * 0.35 * pourP * (1 - formP);
          ctx.beginPath();
          ctx.ellipse(W/2, poolY, rr, rr * 0.22, 0, 0, Math.PI * 2);
          ctx.strokeStyle = `rgba(255,230,100,${ra})`;
          ctx.lineWidth = 1.2;
          ctx.stroke();
        }
      }

      // ── 4. Coin forming ───────────────────────────────────────────────────
      if (formP > 0) {
        const cx = W * 0.5;
        const cy = H * 0.5;
        const maxR = Math.min(W, H) * 0.31;
        const coinR = maxR * formP;

        // Outer glow
        const og = ctx.createRadialGradient(cx, cy, coinR * 0.3, cx, cy, coinR * 2.2);
        og.addColorStop(0,   `rgba(255,210,50,${0.35 * formP})`);
        og.addColorStop(0.5, `rgba(220,160,20,${0.15 * formP})`);
        og.addColorStop(1,   `rgba(180,120,0,0)`);
        ctx.beginPath();
        ctx.arc(cx, cy, coinR * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = og;
        ctx.fill();

        // Coin face
        const cg = ctx.createRadialGradient(
          cx - coinR * 0.28, cy - coinR * 0.28, 0,
          cx, cy, coinR
        );
        cg.addColorStop(0,    `rgba(255,240,130,${formP})`);
        cg.addColorStop(0.25, `rgba(240,200,70,${formP})`);
        cg.addColorStop(0.55, `rgba(200,148,28,${formP})`);
        cg.addColorStop(0.82, `rgba(160,105,15,${formP})`);
        cg.addColorStop(1,    `rgba(120,72,5,${formP})`);
        ctx.beginPath();
        ctx.arc(cx, cy, coinR, 0, Math.PI * 2);
        ctx.fillStyle = cg;
        ctx.fill();

        // Rim
        ctx.beginPath();
        ctx.arc(cx, cy, coinR, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255,230,90,${formP * 0.85})`;
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Inner rim
        ctx.beginPath();
        ctx.arc(cx, cy, coinR * 0.88, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(200,145,25,${formP * 0.45})`;
        ctx.lineWidth = 1;
        ctx.stroke();

        // Specular highlight — moves slightly as if coin breathes
        if (formP > 0.45) {
          const hAlpha = (formP - 0.45) / 0.55;
          const breathe = Math.sin(t * 0.022) * 0.06;
          ctx.save();
          ctx.beginPath();
          ctx.arc(cx, cy, coinR * 0.87, 0, Math.PI * 2);
          ctx.clip();
          const hi = ctx.createLinearGradient(
            cx - coinR * (0.6 + breathe), cy - coinR * 0.6,
            cx + coinR * 0.2, cy + coinR * 0.4
          );
          hi.addColorStop(0,    `rgba(255,255,220,0)`);
          hi.addColorStop(0.3,  `rgba(255,255,220,${0.28 * hAlpha})`);
          hi.addColorStop(0.48, `rgba(255,255,255,${0.18 * hAlpha})`);
          hi.addColorStop(0.62, `rgba(255,255,220,${0.1 * hAlpha})`);
          hi.addColorStop(1,    `rgba(255,255,220,0)`);
          ctx.fillStyle = hi;
          ctx.fillRect(cx - coinR, cy - coinR, coinR * 2, coinR * 2);
          ctx.restore();
        }

        // Coin breathe glow when fully formed
        if (coinP > 0) {
          const breatheGlow = 0.5 + Math.sin(t * 0.025) * 0.18;
          const bg2 = ctx.createRadialGradient(cx, cy, coinR * 0.6, cx, cy, coinR * 1.7);
          bg2.addColorStop(0,   `rgba(255,200,40,0)`);
          bg2.addColorStop(0.5, `rgba(255,180,20,${0.12 * coinP * breatheGlow})`);
          bg2.addColorStop(1,   `rgba(180,110,0,0)`);
          ctx.beginPath();
          ctx.arc(cx, cy, coinR * 1.7, 0, Math.PI * 2);
          ctx.fillStyle = bg2;
          ctx.fill();
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };

    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      window.removeEventListener("resize", resize);
    };
  }, [globalProgress]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full"
    />
  );
}

// ─── Video slot ───────────────────────────────────────────────────────────────
function VideoSlot({
  src,
  poster,
  visible,
  placeholder,
}: {
  src?: string;
  poster?: string;
  visible: boolean;
  placeholder: string;
}) {
  return (
    <div
      className="absolute inset-0 transition-opacity duration-1000"
      style={{ opacity: visible ? 1 : 0, pointerEvents: visible ? "auto" : "none" }}
    >
      {src ? (
        <video
          src={src}
          poster={poster}
          autoPlay loop muted playsInline
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="rounded-full border flex items-center justify-center text-center px-8"
            style={{
              width: "min(320px, 70vw)",
              height: "min(320px, 70vw)",
              borderColor: "rgba(220,170,40,0.3)",
              background: "rgba(20,16,8,0.7)",
            }}
          >
            <div>
              <div style={{ color: "rgba(220,170,40,0.55)", fontSize: "10px", letterSpacing: "0.3em", textTransform: "uppercase", marginBottom: "10px" }}>
                Higgsfield · Video
              </div>
              <div style={{ color: "rgba(255,215,70,0.9)", fontFamily: "var(--font-serif)", fontSize: "1.3rem", fontStyle: "italic" }}>
                {placeholder}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Cinematic top/bottom fade */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "linear-gradient(to bottom, rgba(8,6,2,1) 0%, transparent 12%, transparent 82%, rgba(8,6,2,1) 100%)"
      }} />
    </div>
  );
}

// ─── Phases ───────────────────────────────────────────────────────────────────
const PHASES = [
  { num: "01", label: "Origin",    headline: "From the earth,",      em: "liquid gold."          },
  { num: "02", label: "Form",      headline: "Shaped by fire,",      em: "given weight."         },
  { num: "03", label: "History",   headline: "Held by kings,",       em: "passed through time."  },
  { num: "04", label: "Today",     headline: "Known by those",       em: "who understand value." },
] as const;

// ─── Main export ──────────────────────────────────────────────────────────────
export function GoldStorySection({
  kingVideoSrc,
  kingVideoPoster,
  traderVideoSrc,
  traderVideoPoster,
}: {
  kingVideoSrc?: string;
  kingVideoPoster?: string;
  traderVideoSrc?: string;
  traderVideoPoster?: string;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const progress = useScrollProgress(sectionRef);

  // Phase index: 4 equal bands
  const phaseIndex = Math.min(3, Math.floor(progress * 4));
  const phase = PHASES[phaseIndex];

  // Canvas active for phases 0 + 1, video for 2 + 3
  const canvasVisible = phaseIndex <= 1;

  return (
    <div ref={sectionRef} style={{ height: "400vh" }}>
      <div
        className="sticky top-0 h-screen overflow-hidden"
        style={{ background: "oklch(0.10 0.004 80)" }}
      >
        {/* ── Gold canvas ── */}
        <div
          className="absolute inset-0 transition-opacity duration-700"
          style={{ opacity: canvasVisible ? 1 : 0 }}
        >
          <GoldCanvas globalProgress={progress} />
        </div>

        {/* ── King video ── */}
        <VideoSlot
          src={kingVideoSrc}
          poster={kingVideoPoster}
          visible={phaseIndex === 2}
          placeholder="The King"
        />

        {/* ── Trader video ── */}
        <VideoSlot
          src={traderVideoSrc}
          poster={traderVideoPoster}
          visible={phaseIndex === 3}
          placeholder="The Trader"
        />

        {/* ── Phase counter — top left ── */}
        <div className="absolute top-7 left-7 z-30">
          <span style={{
            fontSize: "10px",
            letterSpacing: "0.32em",
            textTransform: "uppercase",
            color: "rgba(220,170,40,0.55)",
          }}>
            {phase.num} / 04 — {phase.label}
          </span>
        </div>

        {/* ── Progress bar — top ── */}
        <div className="absolute top-0 left-0 right-0 z-30 h-[2px]" style={{ background: "rgba(220,170,40,0.08)" }}>
          <div
            className="h-full transition-all duration-300"
            style={{
              width: `${progress * 100}%`,
              background: "linear-gradient(to right, rgba(220,170,40,0.6), rgba(255,220,80,0.9))",
            }}
          />
        </div>

        {/* ── Headline — bottom left ── */}
        <div className="absolute bottom-0 left-0 right-0 z-30 px-8 pb-14 md:px-16 md:pb-20">
          <div className="max-w-xl">
            <h2
              key={phaseIndex}
              className="font-serif animate-rise"
              style={{
                fontSize: "clamp(1.8rem, 4.5vw, 3.2rem)",
                lineHeight: 1.06,
                letterSpacing: "-0.01em",
                color: "oklch(0.96 0.003 250)",
              }}
            >
              {phase.headline}
              <br />
              <em style={{
                fontStyle: "italic",
                color: "rgba(255,210,60,0.95)",
                textShadow: "0 0 40px rgba(255,190,30,0.45), 0 0 80px rgba(255,190,30,0.2)",
              }}>
                {phase.em}
              </em>
            </h2>

            {/* Scroll hint — first phase only */}
            {phaseIndex === 0 && progress < 0.08 && (
              <div
                className="mt-7 flex items-center gap-3 animate-rise"
                style={{ color: "rgba(220,170,40,0.45)" }}
              >
                <div style={{
                  width: "1px", height: "32px",
                  background: "linear-gradient(to bottom, rgba(220,170,40,0.5), transparent)"
                }} />
                <span style={{ fontSize: "10px", letterSpacing: "0.3em", textTransform: "uppercase" }}>
                  Scroll to discover
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Vignette ── */}
        <div
          className="absolute inset-0 pointer-events-none z-20"
          style={{
            background: "radial-gradient(ellipse 85% 85% at 50% 50%, transparent 45%, rgba(8,6,2,0.65) 100%)"
          }}
        />
      </div>
    </div>
  );
}
