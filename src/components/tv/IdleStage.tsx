/* eslint-disable @next/next/no-img-element */
import { CATEGORY_LABEL, type Category } from "@/lib/types";

export type NextUp = { name: string; category: Category; song: string | null } | null;

/** United BML logo on a spinning record, with sound rings, a light halo and rising notes. */
export function LogoOrb({ size }: { size: string }) {
  const notes = ["♪", "♫", "♬", "♩", "♪", "♫", "♬", "♩"];
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }} aria-hidden>
      <div className="halo absolute -inset-[18%]" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="sound-ring absolute inset-0" style={{ animationDelay: `${i}s` }} />
      ))}
      <div className="vinyl absolute inset-0" />
      <div className="absolute inset-0 flex items-center justify-center">
        <img src="/brand/united-bml.png" alt="" className="logo-beat h-[66%] w-auto" />
      </div>
      {notes.map((n, i) => (
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

/** A full-width audio equaliser along the bottom edge. */
function Equalizer({ bars = 64 }: { bars?: number }) {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[38%] items-end gap-[0.3%] px-[1%] opacity-35">
      {Array.from({ length: bars }, (_, i) => {
        const h = 35 + ((i * 37) % 65);
        return (
          <span
            key={i}
            className="eq-bar flex-1"
            style={{
              height: `${h}%`,
              animationDuration: `${0.45 + ((i * 13) % 9) * 0.09}s`,
              animationDelay: `${-((i * 7) % 10) * 0.1}s`,
            }}
          />
        );
      })}
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
    <section className="pop-in relative isolate flex min-h-[16rem] shrink-0 items-center overflow-hidden rounded-3xl border border-accent/40 bg-[radial-gradient(ellipse_at_20%_50%,rgb(224_53_111/0.35),transparent_60%),radial-gradient(ellipse_at_90%_0%,rgb(242_196_109/0.15),transparent_50%)] bg-panel/60 lg:h-[34%]">
      <Equalizer />
      <Sparkles />
      <div className="relative z-10 flex w-full items-center gap-[3rem] px-[2.5rem] py-[1.5rem]">
        <LogoOrb size="clamp(9rem, 24dvh, 16rem)" />
        <div className="min-w-0 flex-1">
          <div className="text-[1.1rem] font-bold tracking-[0.4em] text-accent-2 uppercase">{eyebrow}</div>
          <div className="mt-[0.3rem] flex flex-wrap items-baseline gap-x-[1rem] leading-none">
            <span className="shine-text text-[3.8rem] font-extrabold tracking-tight uppercase">Karaoke</span>
            <span className="font-script text-[4.2rem] text-accent-2">Competition</span>
          </div>
          {nextUp ? (
            <div className="mt-[0.9rem] inline-flex max-w-full items-center gap-[1rem] rounded-2xl border border-gold/40 bg-bg/60 px-[1.2rem] py-[0.7rem] backdrop-blur">
              <span className="text-[2rem]">🎤</span>
              <div className="min-w-0">
                <div className="text-[0.85rem] font-bold tracking-[0.3em] text-gold uppercase">
                  Next on stage · {CATEGORY_LABEL[nextUp.category]}
                </div>
                <div className="truncate text-[2rem] leading-tight font-extrabold">{nextUp.name}</div>
                {nextUp.song && <div className="truncate text-[1rem] text-muted">♪ {nextUp.song}</div>}
              </div>
            </div>
          ) : (
            <div className="mt-[1.2rem] text-[1.6rem] font-semibold text-muted">Get ready for the next act!</div>
          )}
          {progress && progress.total > 0 && (
            <div className="mt-[1rem] max-w-[34rem]">
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
    </section>
  );
}

/** Full-screen version for before the competition starts. */
export function IdleHero({ children }: { children?: React.ReactNode }) {
  return (
    <div className="relative isolate flex flex-1 flex-col items-center justify-center overflow-hidden pt-[3.5rem] pb-[1rem] text-center">
      <Equalizer bars={80} />
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
