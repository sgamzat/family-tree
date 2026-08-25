"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PersonTile } from "@/components/person-tile";
import { formatFio, type PersonDTO } from "@/lib/names";
import { usePersonSearch } from "@/lib/use-person-search";

export function HomeSearch({ recent }: { recent: PersonDTO[] }) {
  const [query, setQuery] = useState("");
  const { hits, loading } = usePersonSearch({ query });
  const trimmed = query.trim();
  const showCreate =
    trimmed.length >= 2 && !loading && hits.every((hit) => formatFio(hit) !== trimmed);

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
      <label className="grid gap-2">
        <span className="text-sm text-[var(--muted)]">Найдите себя или родственника</span>
        <input
          className="field text-lg"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Фамилия имя отчество"
          autoFocus
        />
      </label>

      {trimmed.length >= 2 ? (
        <div className="grid gap-2">
          {loading && hits.length === 0 ? (
            <p className="text-sm text-[var(--muted)]">Ищем…</p>
          ) : null}
          {hits.map((hit) => (
            <PersonTile key={hit.id} person={hit} href={`/people/${hit.id}`} />
          ))}
          {hits.length === 0 && !loading ? (
            <p className="text-sm text-[var(--muted)]">Такого ФИО пока нет в древе.</p>
          ) : null}
          {showCreate ? (
            <Link href={newHref} className="btn-primary text-center">
              Добавить человека с таким ФИО
            </Link>
          ) : null}
        </div>
      ) : recent.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
            Недавно добавленные
          </h2>
          {recent.map((person) => (
            <PersonTile key={person.id} person={person} href={`/people/${person.id}`} />
          ))}
        </section>
      ) : (
        <p className="rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--slot)] px-4 py-5 text-sm leading-6 text-[var(--muted)]">
          Пока никого нет. Добавьте первого человека — себя или старшего в роду. Когда
          односельчане будут вводить то же ФИО, приложение предложит выбрать уже
          существующую карточку.
        </p>
      )}
    </div>
  );
}
