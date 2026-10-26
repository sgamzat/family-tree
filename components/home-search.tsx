"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { PersonTile } from "@/components/person-tile";
import { formatFio } from "@/lib/names";
import { scrollFieldBelowHeader, useDropdownMax } from "@/lib/use-dropdown-max";
import { usePersonSearch } from "@/lib/use-person-search";

export function HomeSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const { hits, loading } = usePersonSearch({ query });
  const trimmed = query.trim();
  const showList = trimmed.length >= 2;
  const listMax = useDropdownMax(inputRef, showList, hits.length);
  const showCreate =
    showList && !loading && hits.every((hit) => formatFio(hit) !== trimmed);

  const newHref = useMemo(() => {
    const parts = trimmed.split(/\s+/).filter(Boolean);
    const params = new URLSearchParams();
    if (parts[0]) params.set("lastName", parts[0]);
    if (parts[1]) params.set("firstName", parts[1]);
    if (parts[2]) params.set("patronymic", parts.slice(2).join(" "));
    const qs = params.toString();
    return qs ? `/people/new?${qs}` : "/people/new";
  }, [trimmed]);

  return (
    <div className="grid gap-4">
      <div className="picker">
        <label className="grid gap-2">
          <span className="sr-only">Найдите себя или родственника</span>
          <input
            ref={inputRef}
            className="field home-field"
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
              if (hits[0]) router.push(`/people/${hits[0].id}`);
            }}
            placeholder="Имя или имя отца"
          />
        </label>
        {showList ? (
          <div className="picker-results" style={{ maxHeight: listMax }}>
            {loading && hits.length === 0 ? (
              <p className="px-1 text-sm text-[var(--muted)]">Ищем…</p>
            ) : null}
            {hits.map((hit) => (
              <PersonTile key={hit.id} person={hit} href={`/people/${hit.id}`} />
            ))}
            {hits.length === 0 && !loading ? (
              <p className="px-1 text-sm text-[var(--muted)]">Такого ФИО пока нет в древе.</p>
            ) : null}
            {showCreate ? (
              <Link
                href={newHref}
                className={
                  hits.length > 0 ? "picker-create" : "btn-primary text-center"
                }
              >
                {hits.length > 0
                  ? "Это другой человек — добавить"
                  : "Добавить человека с таким ФИО"}
              </Link>
            ) : null}
          </div>
        ) : null}
      </div>

      <Link href="/census" className="home-census-link">
        Перепись населения 1886 года
      </Link>
    </div>
  );
}
