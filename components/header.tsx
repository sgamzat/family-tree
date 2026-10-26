import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import { currentUser } from "@/lib/auth";

export async function Header() {
  const user = await currentUser();

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link href="/" className="site-logo">
          Древо села
        </Link>
        <nav className="site-nav">
          <Link href="/census">Перепись</Link>
          <Link href="/kinship">Родство</Link>
          {user?.role === "admin" ? <Link href="/admin">Админка</Link> : null}
          {user ? (
            <>
              <span className="site-nav-name">{user.name}</span>
              <SignOutButton />
            </>
          ) : (
            <Link href="/login">Войти</Link>
          )}
        </nav>
      </div>
    </header>
  );
}
