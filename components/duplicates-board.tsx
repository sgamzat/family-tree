"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { formatFio, searchHitCaption, type PersonDTO, type SearchHit } from "@/lib/names";

type Pair = {
  a: SearchHit;
  b: SearchHit;
  reasons: string[];
};

function Card({ person }: { person: SearchHit }) {
  const details = searchHitCaption(person);
  return (
    <div className="min-w-0">
      <Link href={`/people/${person.id}`} className="font-medium leading-snug">
        {formatFio(person)}
      </Link>
      {details ? (
        <p className="text-sm text-[var(--muted)]">{details}</p>
      ) : null}
    </div>
  );
}

export function DuplicatesBoard() {
  const [pairs, setPairs] = useState<Pair[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await api<{ pairs: Pair[] }>("/api/duplicates");
      setPairs(data.pairs);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить");
      setPairs([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function merge(keep: SearchHit, drop: SearchHit) {
    const confirmed = window.confirm(
      `Оставить ${formatFio(keep)} и влить в него ${formatFio(drop)}? Второй человек исчезнет, связи и другие имена перейдут на первого.`,
    );
    if (!confirmed) return;
    setBusy(`${keep.id}:${drop.id}`);
    setError("");
    try {
      await api<{ person: PersonDTO }>("/api/duplicates", {
        method: "POST",
        body: JSON.stringify({ keepId: keep.id, dropId: drop.id }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось слить");
    } finally {
      setBusy("");
    }
  }

  if (pairs === null) {
    return <p className="text-sm text-[var(--muted)]">Ищем похожие карточки…</p>;
  }

  return (
    <div className="grid gap-4">
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {pairs.length === 0 ? (
        <p className="text-sm text-[var(--muted)]">
          Пока нет пар с одним именем, одним отцом и пересекающимися годами.
        </p>
      ) : (
        pairs.map((pair) => (
          <div
            key={`${pair.a.id}-${pair.b.id}`}
            className="grid gap-3 rounded-2xl border border-[var(--line)] bg-white p-3"
          >
            <p className="text-xs text-[var(--muted)]">{pair.reasons.join(" · ")}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Card person={pair.a} />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={Boolean(busy)}
                  onClick={() => merge(pair.a, pair.b)}
                >
                  Оставить этого
                </button>
              </div>
              <div className="grid gap-2">
                <Card person={pair.b} />
                <button
                  type="button"
                  className="btn-secondary"
                  disabled={Boolean(busy)}
                  onClick={() => merge(pair.b, pair.a)}
                >
                  Оставить этого
                </button>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
