"use client";

import { useState } from "react";
import { AddRelativeSheet } from "@/components/add-relative-sheet";
import { AddSlot, PersonTile } from "@/components/person-tile";
import type { FamilyDTO, RelationRole } from "@/lib/names";

export function FamilyBoard({ family }: { family: FamilyDTO }) {
  const [role, setRole] = useState<RelationRole | null>(null);

  return (
    <div className="grid gap-6">
      <section className="grid gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
          Родители
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {family.father ? (
            <PersonTile person={family.father} href={`/people/${family.father.id}`} />
          ) : (
            <AddSlot label="Добавить отца" onClick={() => setRole("father")} />
          )}
          {family.mother ? (
            <PersonTile person={family.mother} href={`/people/${family.mother.id}`} />
          ) : (
            <AddSlot label="Добавить мать" onClick={() => setRole("mother")} />
          )}
        </div>
      </section>

      <section className="grid gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
          Семья
        </h2>
        <div className="grid grid-cols-2 gap-2">
          <PersonTile person={family.person} current />
          {family.spouses.map((spouse) => (
            <PersonTile key={spouse.id} person={spouse} href={`/people/${spouse.id}`} />
          ))}
          <AddSlot
            label={family.person.gender === "male" ? "Добавить супругу" : "Добавить супруга"}
            onClick={() => setRole("spouse")}
          />
        </div>
      </section>

      <section className="grid gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
          Дети
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {family.children.map((child) => (
            <PersonTile key={child.id} person={child} href={`/people/${child.id}`} />
          ))}
          <AddSlot label="Добавить ребёнка" onClick={() => setRole("child")} />
        </div>
      </section>

      {family.siblings.length > 0 ? (
        <section className="grid gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
            Братья и сёстры
          </h2>
          <div className="grid grid-cols-2 gap-2">
            {family.siblings.map((sibling) => (
              <PersonTile key={sibling.id} person={sibling} href={`/people/${sibling.id}`} />
            ))}
          </div>
        </section>
      ) : null}

      {role ? (
        <AddRelativeSheet
          personId={family.person.id}
          role={role}
          family={family}
          onClose={() => setRole(null)}
          onSaved={() => setRole(null)}
        />
      ) : null}
    </div>
  );
}
