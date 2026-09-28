/* eslint-disable @next/next/no-img-element */
import { CATEGORY_LABEL, type Category } from "@/lib/types";

export type NextUp = { name: string; category: Category; song: string | null } | null;

/** United BML logo on a spinning record, with sound rings, a light halo and rising notes. */
export function LogoOrb({ size, minimal = false }: { size: string; minimal?: boolean }) {
  const notes = ["♪", "♫", "♬", "♩", "♪", "♫", "♬", "♩"];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden>
      {!minimal && <div className="halo absolute -inset-[18%]" />}
      {!minimal &&
        [0, 1, 2].map((i) => (
          <div key={i} className="sound-ring absolute inset-0" style={{ animationDelay: `${i}s` }} />
        ))}
      <div className="note-orbit absolute -inset-[14%]">
        {["♪", "♫", "♬", "♩", "♪", "♫"].map((n, i) => {
          const a = (i / 6) * 2 * Math.PI;
          return (
            <span
              key={i}
              className="absolute -translate-x-1/2 -translate-y-1/2 font-bold"
              style={{
                left: `${50 + 50 * Math.cos(a)}%`,
                top: `${50 + 50 * Math.sin(a)}%`,
                fontSize: `calc(${size} * 0.13)`,
                color: ["#f472a0", "#f2c46d", "#ffffff", "#e0356f", "#f2c46d", "#f472a0"][i],
                textShadow: "0 0 12px rgb(224 53 111 / 0.8)",
              }}
            >
              {n}
            </span>
          );
        })}
      </div>
      <div className="vinyl absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center">
        <img src="/brand/united-bml.png" alt="" className="logo-beat h-[66%] w-auto" />
      </div>
      <svg className="tonearm absolute -top-[6%] -right-[10%] w-[46%] drop-shadow-lg" viewBox="0 0 100 120" fill="none">
        <circle cx="85" cy="14" r="11" fill="#2a1320" stroke="#f2c46d" strokeWidth="3" />
        <circle cx="85" cy="14" r="4" fill="#f2c46d" />
        <path d="M85 14 L70 70 L42 98" stroke="#d9d0d4" strokeWidth="5" strokeLinecap="round" />
        <rect x="28" y="92" width="20" height="12" rx="3" transform="rotate(-40 38 98)" fill="#f2c46d" />
      </svg>
      {!minimal && notes.map((n, i) => (
        <span
          key={i}
          className="note-rise absolute text-accent-2"
          style={
            {
              left: `${[2, 88, 12, 80, -8, 96, 30, 64][i]}%`,
              top: `${[70, 60, 90, 85, 40, 30, 100, 98][i]}%`,
              fontSize: `calc(${size} * ${[0.1, 0.12, 0.08, 0.11, 0.09, 0.1, 0.08, 0.12][i]})`,
              animationDelay: `${i * 0.62}s`,
              "--dx": `${i % 2 ? 30 : -30}px`,
            } as React.CSSProperties
          }
        >
          {n}
        </span>
      ))}
    </div>
  );
}

/** A smooth sine path spanning two wavelengths per tile, so it can scroll seamlessly. */
function wavePath(amp: number, mid: number) {
  // 4 half-waves over 400 units; the pattern repeats every 200 units.
  return `M0 ${mid} Q50 ${mid - amp} 100 ${mid} T200 ${mid} T300 ${mid} T400 ${mid}`;
}

/** Glowing sound waves rolling along the bottom edge. */
function SoundWaves({ className = "h-[38%]" }: { className?: string }) {
  const waves = [
    { color: "#f472a0", amp: 26, mid: 60, width: 3.5, dur: 7, opacity: 0.85 },
    { color: "#f2c46d", amp: 18, mid: 70, width: 2.5, dur: 5, opacity: 0.7, reverse: true },
    { color: "#ffffff", amp: 34, mid: 58, width: 1.5, dur: 10, opacity: 0.45 },
    { color: "#e0356f", amp: 12, mid: 80, width: 5, dur: 4, opacity: 0.5, reverse: true },
  ];
  return (
    <div aria-hidden className={`pointer-events-none absolute inset-x-0 bottom-0 overflow-hidden ${className}`}>
      {waves.map((w, i) => (
        <svg
          key={i}
          className={`wave-roll absolute bottom-0 left-0 h-full ${w.reverse ? "wave-roll-reverse" : ""}`}
          style={{ width: "200%", animationDuration: `${w.dur}s`, opacity: w.opacity }}
          viewBox="0 0 400 100"
          preserveAspectRatio="none"
        >
          <path
            d={wavePath(w.amp, w.mid)}
            fill="none"
            stroke={w.color}
            strokeWidth={w.width}
            vectorEffect="non-scaling-stroke"
            style={{ filter: `drop-shadow(0 0 6px ${w.color})` }}
          />
        </svg>
      ))}
      {/* soft glow under the waves */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-accent/25 to-transparent" />
    </div>
  );
}

/** Music notes streaming up across the whole panel. */
function NoteStream({ count = 18 }: { count?: number }) {
  const glyphs = ["♪", "♫", "♬", "♩"];
  const colors = ["#f472a0", "#f2c46d", "#ffffff", "#e0356f"];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden" style={{ containerType: "size" }}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="note-stream absolute bottom-[-12%] font-bold"
          style={
            {
              left: `${(i * 41 + 13) % 100}%`,
              fontSize: `${1.3 + ((i * 7) % 5) * 0.45}rem`,
              color: colors[i % colors.length],
              textShadow: "0 0 10px rgb(224 53 111 / 0.7)",
              animationDuration: `${5 + ((i * 11) % 6)}s`,
              animationDelay: `${-((i * 1.7) % 9)}s`,
              "--sway": `${i % 2 ? 36 : -36}px`,
            } as React.CSSProperties
          }
        >
          {glyphs[i % glyphs.length]}
        </span>
      ))}
    </div>
  );
}

function StageBeams() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="stage-beam" style={{ left: "38%" }} />
      <div className="stage-beam" style={{ left: "62%", animationDelay: "-3.5s", animationDuration: "8s" }} />
      <div className="stage-beam" style={{ left: "85%", animationDelay: "-1.5s", animationDuration: "9s" }} />
    </div>
  );
}

function Sparkles({ count = 18 }: { count?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className="twinkle absolute text-gold"
          style={{
            left: `${(i * 53 + 7) % 100}%`,
            top: `${(i * 31 + 11) % 70}%`,
            fontSize: `${0.7 + ((i * 7) % 4) * 0.3}rem`,
            animationDelay: `${(i * 0.37) % 2.6}s`,
          }}
        >
          ✦
        </span>
      ))}
    </div>
  );
}

/**
 * Shown on the TV when nobody is performing: an eye-catching United BML
 * logo show with who's up next.
 */
export function IdleStage({
  eyebrow,
  nextUp,
  progress,
}: {
  eyebrow: string;
  nextUp: NextUp;
  progress: { done: number; total: number } | null;
}) {
  return (
    <section className="pop-in relative isolate flex shrink-0 items-center overflow-hidden rounded-3xl border border-accent/40 bg-[radial-gradient(ellipse_at_20%_50%,rgb(224_53_111/0.35),transparent_60%),radial-gradient(ellipse_at_90%_0%,rgb(242_196_109/0.15),transparent_50%)] bg-panel/60">
      <StageBeams />
      <SoundWaves />
      <NoteStream />
      <Sparkles />
      <div className="relative z-10 flex w-full items-center gap-[3rem] px-[2.5rem] py-[1.2rem]">
        <LogoOrb size="clamp(8rem, 21dvh, 14rem)" />
        <div className="min-w-0 flex-1">
          <div className="text-[1rem] font-bold tracking-[0.4em] text-accent-2 uppercase">{eyebrow}</div>
          <div className="mt-[0.2rem] flex flex-wrap items-baseline gap-x-[1rem] leading-none">
            <span className="shine-text text-[3.3rem] font-extrabold tracking-tight uppercase">Karaoke</span>
            <span className="font-script text-[3.7rem] text-accent-2">Competition</span>
          </div>
          <div className="mt-[0.9rem] flex flex-wrap items-center gap-x-[2rem] gap-y-[0.8rem]">
            {nextUp ? (
              <div className="inline-flex max-w-full min-w-0 items-center gap-[1rem] rounded-2xl border border-gold/40 bg-bg/60 px-[1.2rem] py-[0.6rem] backdrop-blur">
                <span className="text-[1.8rem]">🎤</span>
                <div className="min-w-0">
                  <div className="text-[0.8rem] font-bold tracking-[0.3em] text-gold uppercase">
                    Next on stage · {CATEGORY_LABEL[nextUp.category]}
                  </div>
                  <div className="truncate text-[1.8rem] leading-tight font-extrabold">{nextUp.name}</div>
                  {nextUp.song && <div className="truncate text-[0.95rem] text-muted">♪ {nextUp.song}</div>}
                </div>
              </div>
            ) : (
              <div className="text-[1.5rem] font-semibold text-muted">Get ready for the next act!</div>
            )}
            {progress && progress.total > 0 && (
              <div className="w-[16rem] shrink-0">
                <div className="flex justify-between text-[0.9rem] text-muted tabular-nums">
                  <span>Performances</span>
                  <span>
                    {progress.done} of {progress.total}
                  </span>
                </div>
                <div className="mt-[0.3rem] h-[0.5rem] overflow-hidden rounded-full bg-bg/70">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent via-accent-2 to-gold transition-[width] duration-1000"
                    style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Full-screen version for before the competition starts. */
export function IdleHero({ children }: { children?: React.ReactNode }) {
  return (
    <div className="relative isolate flex flex-1 flex-col items-center justify-center overflow-hidden pt-[3.5rem] pb-[1rem] text-center">
      <StageBeams />
      <SoundWaves className="h-[30%]" />
      <NoteStream count={24} />
      <Sparkles count={26} />
      <div className="relative z-10 flex flex-col items-center">
        <LogoOrb size="clamp(10rem, 27dvh, 19rem)" />
        <p className="mt-[1.6rem] text-[1.1rem] font-semibold tracking-[0.5em] text-muted uppercase">Duet | Single</p>
        <div className="flex flex-wrap items-baseline justify-center gap-x-[1rem] leading-none">
          <span className="shine-text text-[4.4rem] font-extrabold tracking-tight uppercase">Karaoke</span>
          <span className="font-script text-[4.8rem] text-accent-2">Competition</span>
        </div>
        {children}
      </div>
    </div>
  );
}
