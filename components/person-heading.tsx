"use client";

import { useState } from "react";
import { EditPersonSheet } from "@/components/edit-person-sheet";
import {
  formatFio,
  personYears,
  type ClanResolution,
  type PersonDTO,
} from "@/lib/names";

export function PersonHeading({
  person,
  clan,
}: {
  person: PersonDTO;
  clan: ClanResolution;
}) {
  const [editing, setEditing] = useState(false);
  const years = personYears(person);
  const living =
    person.isLiving === true ? "жив" : person.isLiving === false ? "умер" : "";
  const clanHint = clan.computed
    ? `Тухум: ${clan.computed.name}`
    : clan.claimed
      ? `Тухум (пока по заявке): ${clan.claimed.name}`
      : "";

  return (
    <div className="grid gap-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            {formatFio(person)}
          </h1>
          <p className="mt-1 text-[var(--muted)]">
            {[years, living, person.gender === "male" ? "мужчина" : "женщина"]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <button type="button" className="btn-secondary shrink-0" onClick={() => setEditing(true)}>
          Изменить
        </button>
      </div>
      {clanHint ? (
        <p className="text-sm text-[var(--muted)]">{clanHint}</p>
      ) : null}
      {clan.mismatch && clan.claimed && clan.computed ? (
        <p className="rounded-xl bg-[var(--danger-soft)] px-3 py-2 text-sm text-[var(--danger)]">
          Заявленный род «{clan.claimed.name}» не совпадает с вычисленным по
          отцам «{clan.computed.name}». Проверьте цепочку отцов.
        </p>
      ) : null}
      {clan.claimed && !clan.computed ? (
        <p className="text-xs leading-4 text-[var(--muted)]">
          Вычисленный род появится, когда цепочка отцов дойдёт до родоначальника.
        </p>
      ) : null}
      {person.aliases.length > 0 ? (
        <p className="text-sm text-[var(--muted)]">
          Также: {person.aliases.join(", ")}
        </p>
      ) : null}
      {person.sourceNote ? (
        <p className="text-sm text-[var(--muted)]">Источник: {person.sourceNote}</p>
      ) : null}
      {editing ? (
        <EditPersonSheet person={person} onClose={() => setEditing(false)} />
      ) : null}
    </div>
  );
}
