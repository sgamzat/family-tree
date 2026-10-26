import Link from "next/link";
import { currentUser } from "@/lib/auth";

export async function Footer() {
  const user = await currentUser();
  if (user?.role !== "admin") return null;

  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <Link href="/duplicates">Вероятные дубли</Link>
      </div>
    </footer>
  );
}
