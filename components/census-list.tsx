"use client";

import { useMemo, useState } from "react";
import { PersonTile } from "@/components/person-tile";
import { formatFio, normalizeName, type PersonDTO } from "@/lib/names";

export function CensusList({
  people,
  linkedIds,
}: {
  people: PersonDTO[];
  linkedIds?: string[];
}) {
  const [query, setQuery] = useState("");
  const linked = useMemo(() => new Set(linkedIds ?? []), [linkedIds]);
  const trimmed = normalizeName(query);
  const shown = useMemo(() => {
    if (!trimmed) return people;
    return people.filter((person) => {
      const haystack = normalizeName(
        [formatFio(person), ...person.aliases].join(" "),
      );
      return haystack.includes(trimmed);
    });
  }, [people, trimmed]);

  return (
    <div className="grid gap-3">
      {people.length > 0 ? (
        <label className="grid gap-2">
          <span className="text-sm text-[var(--muted)]">Найти в переписи</span>
          <input
            className="field"
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Имя"
          />
        </label>
      ) : null}
      {people.length > 0 ? (
        <p className="text-sm text-[var(--muted)]">
          {trimmed
            ? shown.length === 0
              ? "В переписи такого имени нет."
              : `Найдено: ${shown.length}`
            : `В списке: ${people.length}`}
        </p>
      ) : (
        <p className="text-sm leading-6 text-[var(--muted)]">
          В переписи пока никого нет. Добавьте первого человека из листа.
        </p>
      )}
      {shown.map((person) => (
        <PersonTile
          key={person.id}
          person={person}
          href={`/people/${person.id}`}
          caption={
            linkedIds
              ? linked.has(person.id)
                ? "связан с живущими"
                : "пока не связан с живущими"
              : null
          }
        />
      ))}
    </div>
  );
}
