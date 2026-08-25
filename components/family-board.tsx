"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { AddRelativeSheet } from "@/components/add-relative-sheet";
import { AddSlot, PersonTile } from "@/components/person-tile";
import { api } from "@/lib/api";
import type { FamilyDTO, PersonDTO, RelationRole } from "@/lib/names";

function unlinkPrompt(role: RelationRole, relative: PersonDTO): string {
  const who = [relative.lastName, relative.firstName].filter(Boolean).join(" ");
  const labels: Record<RelationRole, string> = {
    father: "отца",
    mother: "мать",
    spouse: "супруга",
    child: "ребёнка",
  };
  return `Отвязать ${labels[role]} ${who}? Сам человек останется в дереве.`;
}

function LinkedPerson({
  person,
  role,
  href,
  onUnlink,
}: {
  person: PersonDTO;
  role: RelationRole;
  href: string;
  onUnlink: () => void;
}) {
  return (
    <div className="grid gap-1">
      <PersonTile person={person} href={href} />
      <button type="button" className="unlink" onClick={onUnlink}>
        Отвязать {role === "father" ? "отца" : role === "mother" ? "мать" : role === "spouse" ? "супруга" : "ребёнка"}
      </button>
    </div>
  );
}

export function FamilyBoard({ family }: { family: FamilyDTO }) {
  const router = useRouter();
  const [role, setRole] = useState<RelationRole | null>(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  async function unlink(role: RelationRole, relative: PersonDTO) {
    if (!window.confirm(unlinkPrompt(role, relative))) return;
    setBusyId(relative.id);
    setError("");
    try {
      const params = new URLSearchParams({
        personId: family.person.id,
        role,
        relativeId: relative.id,
      });
      await api(`/api/relations?${params.toString()}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отвязать");
    } finally {
      setBusyId("");
    }
  }

  return (
    <div className="grid gap-6">
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <section className="grid gap-2">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
          Родители
        </h2>
        <div className="grid grid-cols-2 gap-2">
          {family.father ? (
            <LinkedPerson
              person={family.father}
              role="father"
              href={`/people/${family.father.id}`}
              onUnlink={() => unlink("father", family.father!)}
            />
          ) : (
            <AddSlot label="Добавить отца" onClick={() => setRole("father")} />
          )}
          {family.mother ? (
            <LinkedPerson
              person={family.mother}
              role="mother"
              href={`/people/${family.mother.id}`}
              onUnlink={() => unlink("mother", family.mother!)}
            />
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
            <LinkedPerson
              key={spouse.id}
              person={spouse}
              role="spouse"
              href={`/people/${spouse.id}`}
              onUnlink={() => unlink("spouse", spouse)}
            />
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
            <LinkedPerson
              key={child.id}
              person={child}
              role="child"
              href={`/people/${child.id}`}
              onUnlink={() => unlink("child", child)}
            />
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

      {busyId ? <p className="text-sm text-[var(--muted)]">Отвязываем…</p> : null}

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
