"use client";

import { useState } from "react";
import { PersonTile } from "@/components/person-tile";
import type { PersonDTO } from "@/lib/names";
import { usePersonSearch } from "@/lib/use-person-search";

type Props = {
  label: string;
  value: PersonDTO | null;
  onChange: (person: PersonDTO | null) => void;
  excludeId?: string;
};

export function PersonPicker({ label, value, onChange, excludeId }: Props) {
  const [query, setQuery] = useState("");
  const { hits, loading } = usePersonSearch({
    query,
    excludeIds: excludeId ? [excludeId] : [],
    enabled: !value,
  });

  if (value) {
    return (
      <div className="grid gap-2">
        <span className="text-sm text-[var(--muted)]">{label}</span>
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <PersonTile person={value} />
          </div>
          <button
            type="button"
            className="btn-secondary mt-1 shrink-0"
            onClick={() => {
              onChange(null);
              setQuery("");
            }}
          >
            Сменить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <label className="grid gap-1">
        <span className="text-sm text-[var(--muted)]">{label}</span>
        <input
          className="field"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Начните вводить ФИО"
        />
      </label>
      {loading ? <p className="text-sm text-[var(--muted)]">Ищем…</p> : null}
      {hits.map((hit) => (
        <PersonTile
          key={hit.id}
          person={hit}
          onClick={() => {
            onChange(hit);
            setQuery("");
          }}
        />
      ))}
    </div>
  );
}
