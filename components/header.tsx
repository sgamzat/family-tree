import Link from "next/link";

export function Header() {
  return (
    <header className="sticky top-0 z-10 border-b border-[var(--line)] bg-[var(--paper)]/90 backdrop-blur">
      <div className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" className="text-[17px] font-semibold tracking-tight">
          Древо села
        </Link>
        <nav className="flex items-center gap-3 text-sm font-medium text-[var(--accent)]">
          <Link href="/kinship">Родство</Link>
          <Link href="/people/new">Добавить</Link>
        </nav>
      </div>
    </header>
  );
}
