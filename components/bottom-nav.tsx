"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Нижняя панель на телефоне: главные разделы под большим пальцем. */
export function BottomNav({ personId, loggedIn }: { personId: string | null; loggedIn: boolean }) {
  const pathname = usePathname();
  const myHref = personId ? `/people/${personId}` : loggedIn ? "/" : "/login";
  const items = [
    {
      href: "/",
      label: "Главная",
      active: pathname === "/",
      icon: <path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" />,
    },
    {
      href: myHref,
      label: "Моё древо",
      active: Boolean(personId) && pathname === `/people/${personId}`,
      icon: (
        <>
          <rect x="9" y="3" width="6" height="5" rx="1" />
          <rect x="3" y="16" width="6" height="5" rx="1" />
          <rect x="15" y="16" width="6" height="5" rx="1" />
          <path d="M12 8v4M6 16v-4h12v4" />
        </>
      ),
    },
    {
      href: "/kinship",
      label: "Родство",
      active: pathname.startsWith("/kinship"),
      icon: (
        <>
          <circle cx="6" cy="6" r="2.5" />
          <circle cx="18" cy="18" r="2.5" />
          <path d="M6 8.5V13a3 3 0 0 0 3 3h6.5" />
        </>
      ),
    },
    { href: "/census", label: "Перепись", active: pathname.startsWith("/census"), icon: null },
  ];

  return (
    <nav className="bottom-nav" aria-label="Разделы">
      {items.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          className={`bottom-nav-item ${item.active ? "is-on" : ""}`}
          aria-current={item.active ? "page" : undefined}
        >
          {item.icon ? (
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {item.icon}
            </svg>
          ) : (
            <span className="bottom-nav-stamp serif" aria-hidden="true">
              1886
            </span>
          )}
          <span>{item.label}</span>
        </Link>
      ))}
    </nav>
  );
}
