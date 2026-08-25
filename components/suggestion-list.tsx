"use client";

import { formatFio, personYears, type SearchHit } from "@/lib/names";

type Props = {
  hits: SearchHit[];
  loading: boolean;
  onPick: (hit: SearchHit) => void;
};

export function SuggestionList({ hits, loading, onPick }: Props) {
  if (loading && hits.length === 0) {
    return <p className="text-sm text-[var(--muted)]">Ищем совпадения…</p>;
  }

  if (hits.length === 0) return null;

  return (
    <div className="grid gap-2">
      <p className="text-sm font-medium">Такое ФИО уже есть. Это тот же человек?</p>
      {hits.map((hit) => {
        const details = [personYears(hit), hit.fatherLabel]
          .filter(Boolean)
          .join(" · ");
        return (
          <div
            key={hit.id}
            className="flex items-center gap-2 rounded-xl border border-[var(--line)] bg-white p-2"
          >
            <div className="min-w-0 flex-1 px-1">
              <div className="font-medium leading-snug">{formatFio(hit)}</div>
              {details ? (
                <div className="text-sm text-[var(--muted)]">{details}</div>
              ) : null}
            </div>
            <button type="button" className="btn-secondary shrink-0" onClick={() => onPick(hit)}>
              Это он
            </button>
          </div>
        );
      })}
    </div>
  );
}
