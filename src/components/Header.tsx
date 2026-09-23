import Link from "next/link";

type Props = {
  eventName?: string;
  right?: React.ReactNode;
};

export function Header({ eventName = "Karaoke Competition", right }: Props) {
  const [first, ...rest] = eventName.split(" ");
  return (
    <header className="border-b border-line/60 bg-bg/70 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="flex items-baseline gap-2 leading-none">
          <span className="text-lg font-extrabold tracking-wide uppercase">{first}</span>
          {rest.length > 0 && (
            <span className="font-script text-2xl text-accent-2">{rest.join(" ")}</span>
          )}
        </Link>
        <nav className="flex items-center gap-2 text-sm">{right}</nav>
      </div>
    </header>
  );
}

export function NavLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="rounded-lg px-3 py-2 text-muted hover:bg-panel-2 hover:text-ink">
      {children}
    </Link>
  );
}
