"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

/** Кнопки «Подтвердить» / «Отклонить» у заявки. */
export function RequestActions({
  requestId,
  kind,
  ownRequest,
}: {
  requestId: string;
  kind: string;
  ownRequest: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");

  if (ownRequest) {
    return <p className="admin-meta">Это ваша заявка — её подтвердит другой хранитель или владелец.</p>;
  }

  async function decide(decision: "approve" | "reject") {
    if (decision === "approve") {
      const what = kind === "person.merge" ? "Слить карточки" : "Удалить человека";
      if (!window.confirm(`${what}? В журнале останется полный снимок.`)) return;
    }
    setBusy(true);
    setError("");
    try {
      await api(`/api/requests/${requestId}`, {
        method: "POST",
        body: JSON.stringify({ decision, note }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось");
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <input
        className="field"
        placeholder="Комментарий (необязательно)"
        value={note}
        onChange={(event) => setNote(event.target.value)}
      />
      <div className="admin-actions">
        <button type="button" className="btn-danger" disabled={busy} onClick={() => void decide("approve")}>
          {kind === "person.merge" ? "Подтвердить слияние" : "Подтвердить удаление"}
        </button>
        <button type="button" className="btn-secondary" disabled={busy} onClick={() => void decide("reject")}>
          Отклонить
        </button>
      </div>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
    </div>
  );
}
