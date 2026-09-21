"use client";

import { useRef, useState } from "react";
import { PersonTile } from "@/components/person-tile";
import type { PersonDTO } from "@/lib/names";
import { scrollFieldBelowHeader, useDropdownMax } from "@/lib/use-dropdown-max";
import { usePersonSearch } from "@/lib/use-person-search";

type Props = {
  label: string;
  value: PersonDTO | null;
  onChange: (person: PersonDTO | null) => void;
  excludeId?: string;
};

export function PersonPicker({ label, value, onChange, excludeId }: Props) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { hits, loading } = usePersonSearch({
    query,
    excludeIds: excludeId ? [excludeId] : [],
    enabled: !value,
  });
  const showList = !value && query.trim().length >= 2;
  const listMax = useDropdownMax(inputRef, showList, hits.length);

  function pick(person: PersonDTO) {
    onChange(person);
    setQuery("");
  }

  if (value) {
    return (
      <div className="grid gap-1">
        <span className="text-sm text-[var(--muted)]">{label}</span>
        <PersonTile person={value} />
        <button
          type="button"
          className="quiet-link"
          onClick={() => {
            onChange(null);
            setQuery("");
          }}
        >
          Сменить
        </button>
      </div>
    );
  }

  return (
    <div className="picker">
      <label className="grid gap-1">
        <span className="text-sm text-[var(--muted)]">{label}</span>
        <input
          ref={inputRef}
          className="field"
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showList}
          aria-autocomplete="list"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => {
            if (inputRef.current) scrollFieldBelowHeader(inputRef.current);
          }}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (hits[0]) pick(hits[0]);
          }}
          placeholder="Начните вводить ФИО"
        />
      </label>
      {showList ? (
        <div className="picker-results" style={{ maxHeight: listMax }}>
          {loading ? (
            <p className="px-1 text-sm text-[var(--muted)]">Ищем…</p>
          ) : null}
          {!loading && hits.length === 0 ? (
            <p className="px-1 text-sm text-[var(--muted)]">
              Такого ФИО нет в древе.
            </p>
          ) : null}
          {hits.map((hit) => (
            <PersonTile key={hit.id} person={hit} onClick={() => pick(hit)} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
