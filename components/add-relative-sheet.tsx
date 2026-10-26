"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PersonFields, emptyPersonForm } from "@/components/person-fields";
import { Sheet } from "@/components/sheet";
import { MatchPanel } from "@/components/match-panel";
import { api } from "@/lib/api";
import {
  formatFio,
  parsePersonInput,
  relationTitle,
  suggestRelativeNames,
  type FamilyDTO,
  type Gender,
  type RelationRole,
} from "@/lib/names";
import { usePersonSearch } from "@/lib/use-person-search";

type Props = {
  personId: string;
  role: RelationRole;
  family: FamilyDTO;
  onClose: () => void;
  onSaved: () => void;
};

function defaultGender(role: RelationRole, personGender: Gender): Gender {
  if (role === "father") return "male";
  if (role === "mother") return "female";
  if (role === "spouse") return personGender === "male" ? "female" : "male";
  return "male";
}

export function AddRelativeSheet({ personId, role, family, onClose, onSaved }: Props) {
  const router = useRouter();
  const genderLocked = role === "father" || role === "mother";
  const maleSpouse =
    family.spouses.find((spouse) => spouse.gender === "male") ?? null;
  const initialGender = defaultGender(role, family.person.gender);
  const suggested = suggestRelativeNames(role, family.person, {
    childGender: initialGender,
    spouse: maleSpouse,
  });
  const [form, setForm] = useState(() => ({
    ...emptyPersonForm(initialGender),
    lastName: suggested.lastName,
    firstName: suggested.firstName,
    patronymic: suggested.patronymic,
  }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const hint = suggestRelativeNames(role, family.person, {
    childGender: form.gender,
    spouse: maleSpouse,
  }).hint;

  function changeForm(next: typeof form) {
    if (role === "child" && next.gender !== form.gender) {
      const previous = suggestRelativeNames(role, family.person, {
        childGender: form.gender,
        spouse: maleSpouse,
      });
      const updated = suggestRelativeNames(role, family.person, {
        childGender: next.gender,
        spouse: maleSpouse,
      });
      setForm({
        ...next,
        lastName:
          form.lastName === previous.lastName ? updated.lastName : next.lastName,
        patronymic:
          form.patronymic === previous.patronymic
            ? updated.patronymic
            : next.patronymic,
      });
      return;
    }
    setForm(next);
  }

  const excludeIds = useMemo(() => {
    const ids = [
      family.person.id,
      family.father?.id,
      family.mother?.id,
      ...family.spouses.map((person) => person.id),
      ...family.children.map((person) => person.id),
      ...family.siblings.map((person) => person.id),
    ];
    return ids.filter((id): id is string => Boolean(id));
  }, [family]);

  const { hits, loading } = usePersonSearch({
    lastName: form.lastName,
    firstName: form.firstName,
    patronymic: form.patronymic,
    gender: form.gender,
    excludeIds,
    nearId: personId,
    role,
    match: true,
  });
  const nameKey = [form.lastName, form.firstName, form.patronymic, form.gender].join("|");
  const [confirmKey, setConfirmKey] = useState("");
  const confirmingNew = hits.length > 0 && confirmKey === nameKey;

  async function linkExisting(existingPersonId: string) {
    setSaving(true);
    setError("");
    try {
      await api("/api/relations", {
        method: "POST",
        body: JSON.stringify({ personId, role, existingPersonId }),
      });
      onSaved();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  async function createAndLink() {
    if (hits.length > 0 && !confirmingNew) {
      setConfirmKey(nameKey);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const newPerson = parsePersonInput({
        ...form,
        birthYear: form.birthYear,
        deathYear: form.deathYear,
      });
      await api("/api/relations", {
        method: "POST",
        body: JSON.stringify({
          personId,
          role,
          newPerson,
          namesakeOf: hits.map((hit) => hit.id),
        }),
      });
      onSaved();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet title={relationTitle(role)} onClose={onClose}>
      {hint ? (
        <p className="mb-4 text-sm leading-5 text-[var(--muted)]">{hint}</p>
      ) : null}
      <PersonFields value={form} onChange={changeForm} lockGender={genderLocked} />
      <div className="mt-4 grid gap-3">
        <MatchPanel
          hits={hits}
          loading={loading}
          gender={form.gender}
          typedName={formatFio(form)}
          saving={saving}
          confirmingNew={confirmingNew}
          onPick={(hit) => void linkExisting(hit.id)}
          onAskNew={() => setConfirmKey(nameKey)}
          onCancelNew={() => setConfirmKey("")}
          onCreateNew={() => void createAndLink()}
        />
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        {hits.length === 0 ? (
          <button
            type="button"
            className="btn-primary"
            disabled={saving || loading}
            onClick={() => void createAndLink()}
          >
            {saving ? "Сохраняем…" : "Создать и связать"}
          </button>
        ) : null}
      </div>
    </Sheet>
  );
}
