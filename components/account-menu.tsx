"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Всё про аккаунт — в одной кнопке с первой буквой имени:
 * своя карточка, добавить человека, инструменты хранителя и выход.
 */
export function AccountMenu({
  name,
  keeper,
  personId,
}: {
  name: string;
  keeper: boolean;
  personId: string | null;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [openedAt, setOpenedAt] = useState(pathname);

  // Переход на другую страницу закрывает меню.
  if (open && openedAt !== pathname) {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function signOut() {
    setOpen(false);
    await fetch("/api/session", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  const initial = name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="account" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={`account-button ${open ? "is-open" : ""}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`${name}: меню`}
        onClick={() => {
          setOpenedAt(pathname);
          setOpen((value) => !value);
        }}
      >
        <span className="account-initial serif" aria-hidden="true">
          {initial}
        </span>
        <svg className="account-caret" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {open ? (
        <div className="account-menu" role="menu" aria-label="Меню аккаунта">
          <div className="account-who">
            <p className="account-name">{name}</p>
            <p className="account-role">{keeper ? "хранитель" : "дописывает древо"}</p>
          </div>
          {personId ? (
            <Link role="menuitem" href={`/people/${personId}`} className="account-item">
              Моя карточка
            </Link>
          ) : (
            <Link role="menuitem" href="/" className="account-item">
              Найти себя в древе
            </Link>
          )}
          <Link role="menuitem" href="/people/new" className="account-item">
            Добавить человека
          </Link>
          {keeper ? (
            <>
              <p className="account-group">Хранителю</p>
              <Link role="menuitem" href="/duplicates" className="account-item">
                Вероятные дубли
              </Link>
              <Link role="menuitem" href="/admin" className="account-item">
                Жители и доступ
              </Link>
              <Link role="menuitem" href="/admin#log" className="account-item">
                Журнал изменений
              </Link>
            </>
          ) : null}
          <div className="account-sep">
            <button
              type="button"
              role="menuitem"
              className="account-item account-signout"
              onClick={() => void signOut()}
            >
              Выйти
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
