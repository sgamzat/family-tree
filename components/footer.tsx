import Link from "next/link";

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <Link href="/duplicates">Вероятные дубли</Link>
      </div>
    </footer>
  );
}
