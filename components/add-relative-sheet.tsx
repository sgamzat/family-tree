"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PersonFields, emptyPersonForm } from "@/components/person-fields";
import { SuggestionList } from "@/components/suggestion-list";
import { api } from "@/lib/api";
import {
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

  const genderFilter = role === "father" ? "male" : role === "mother" ? "female" : undefined;
  const { hits, loading } = usePersonSearch({
    lastName: form.lastName,
    firstName: form.firstName,
    patronymic: form.patronymic,
    gender: genderFilter,
    excludeIds,
    nearId: personId,
    role,
  });

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
    if (hits.length > 0) {
      const ok = window.confirm(
        "Похожие люди уже есть в дереве. Точно создать нового, а не нажать «Это он»?",
      );
      if (!ok) return;
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
        body: JSON.stringify({ personId, role, newPerson }),
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
    <div className="fixed inset-0 z-20 bg-black/40" onClick={onClose}>
      <div
        className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-auto rounded-t-2xl bg-[var(--paper)] p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold">{relationTitle(role)}</h2>
            <button type="button" className="text-sm text-[var(--muted)]" onClick={onClose}>
              Закрыть
            </button>
          </div>
          {hint ? (
            <p className="mb-4 text-sm leading-5 text-[var(--muted)]">{hint}</p>
          ) : null}
          <PersonFields value={form} onChange={changeForm} lockGender={genderLocked} />
          <div className="mt-4 grid gap-3">
            <SuggestionList hits={hits} loading={loading} onPick={(hit) => linkExisting(hit.id)} />
            {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
            <button
              type="button"
              className="btn-primary"
              disabled={saving}
              onClick={createAndLink}
            >
              {hits.length > 0
                ? "Это другой человек — создать нового"
                : saving
                  ? "Сохраняем…"
                  : "Создать и связать"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
