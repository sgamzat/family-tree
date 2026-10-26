"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PersonTile } from "@/components/person-tile";
import { usePersonSearch } from "@/lib/use-person-search";

/** Короткий поиск в шапке: на компьютере он всегда под рукой. */
export function HeaderSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { hits, loading } = usePersonSearch({ query });
  const showList = open && query.trim().length >= 2;

  return (
    <div
      className="header-search picker"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOpen(false);
      }}
    >
      <label className="header-search-field">
        <span className="sr-only">Поиск человека</span>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true">
          <circle cx="11" cy="11" r="7" />
          <path d="M20 20l-3.5-3.5" />
        </svg>
        <input
          type="search"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          role="combobox"
          aria-expanded={showList}
          aria-autocomplete="list"
          placeholder="Имя, имя отца или деда"
          value={query}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "Escape") setOpen(false);
            if (event.key !== "Enter") return;
            event.preventDefault();
            if (hits[0]) {
              setOpen(false);
              setQuery("");
              router.push(`/people/${hits[0].id}`);
            }
          }}
        />
      </label>
      {showList ? (
        <div className="picker-results header-search-results">
          {loading && hits.length === 0 ? (
            <p className="px-1 text-sm text-[var(--muted)]">Ищем…</p>
          ) : null}
          {hits.map((hit) => (
            <PersonTile
              key={hit.id}
              person={hit}
              onClick={() => {
                setOpen(false);
                setQuery("");
                router.push(`/people/${hit.id}`);
              }}
            />
          ))}
          {hits.length === 0 && !loading ? (
            <p className="px-1 text-sm text-[var(--muted)]">Такого имени пока нет в древе.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
