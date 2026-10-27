"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

/** «Восстановить» у записи журнала об удалении. */
export function RestoreButton({ logId, name }: { logId: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function restore() {
    if (!window.confirm(`Вернуть ${name} в древо со связями, которые ещё есть?`)) return;
    setBusy(true);
    setError("");
    try {
      const result = await api<{ person: { id: string } }>("/api/log/restore", {
        method: "POST",
        body: JSON.stringify({ logId }),
      });
      router.push(`/people/${result.person.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось восстановить");
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-2">
      <button type="button" className="btn-secondary" disabled={busy} onClick={() => void restore()}>
        Восстановить
      </button>
      {error ? <span className="text-sm text-[var(--danger)]">{error}</span> : null}
    </span>
  );
}
