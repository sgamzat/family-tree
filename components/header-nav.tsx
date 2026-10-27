"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Разделы в шапке на компьютере: «Моё древо», «Родство», «Перепись 1886». */
export function HeaderNav({ personId, loggedIn }: { personId: string | null; loggedIn: boolean }) {
  const pathname = usePathname();
  const items = [
    ...(loggedIn
      ? [
          {
            href: personId ? `/people/${personId}` : "/",
            label: "Моё древо",
            active: Boolean(personId) && pathname === `/people/${personId}`,
          },
        ]
      : []),
    { href: "/kinship", label: "Родство", active: pathname.startsWith("/kinship") },
    { href: "/census", label: "Перепись 1886", active: pathname.startsWith("/census") },
  ];
  return (
    <nav className="site-nav" aria-label="Разделы">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={item.active ? "is-on" : ""}
          aria-current={item.active ? "page" : undefined}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}
