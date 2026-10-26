"use client";

import { useRouter } from "next/navigation";

export function SignOutButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      className="site-nav-button"
      onClick={() => {
        void fetch("/api/session", { method: "DELETE" }).then(() => {
          router.refresh();
        });
      }}
    >
      Выйти
    </button>
  );
}
