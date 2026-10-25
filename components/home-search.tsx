"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useRef, useState } from "react";
import { PersonTile } from "@/components/person-tile";
import { formatFio, type PersonDTO } from "@/lib/names";
import { scrollFieldBelowHeader, useDropdownMax } from "@/lib/use-dropdown-max";
import { usePersonSearch } from "@/lib/use-person-search";

export function HomeSearch({ recent }: { recent: PersonDTO[] }) {
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
          <span className="text-sm text-[var(--muted)]">Найдите себя или родственника</span>
          <input
            ref={inputRef}
            className="field text-lg"
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
            placeholder="Фамилия имя отчество"
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

      {!showList && recent.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
            Недавно добавленные
          </h2>
          {recent.map((person) => (
            <PersonTile key={person.id} person={person} href={`/people/${person.id}`} />
          ))}
        </section>
      ) : null}

      {!showList && recent.length === 0 ? (
        <div className="grid gap-3 rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--slot)] px-4 py-5">
          <p className="text-sm leading-6 text-[var(--muted)]">
            Пока никого нет. Добавьте себя, затем отца, мать и дедов. Когда кто-то
            введёт того же человека, выберите его карточку — семьи сойдутся.
          </p>
          <Link href="/people/new" className="btn-primary text-center">
            Добавить первого человека
          </Link>
        </div>
      ) : null}
    </div>
  );
}
