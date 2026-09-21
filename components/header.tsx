import Link from "next/link";

export function Header() {
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-logo">
          Древо села
        </Link>
        <nav className="site-nav">
          <Link href="/kinship">Родство</Link>
        </nav>
      </div>
    </header>
  );
}
