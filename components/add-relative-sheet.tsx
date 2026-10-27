"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PersonExtras } from "@/components/person-extras";
import { PersonFields, emptyPersonForm, formToInput, splitDate } from "@/components/person-fields";
import { Sheet } from "@/components/sheet";
import { MatchPanel } from "@/components/match-panel";
import { api } from "@/lib/api";
import {
  genitive,
  parsePersonInput,
  relativeYearWarning,
  suggestRelativeNames,
  type FamilyDTO,
  type Gender,
  type PersonDTO,
  type RelationRole,
} from "@/lib/names";
import { usePersonSearch } from "@/lib/use-person-search";

type Props = {
  personId: string;
  role: RelationRole;
  family: FamilyDTO;
  onClose: () => void;
  onSaved: () => void;
  /** «Продолжить»: добавить ещё одного родственника тому же человеку. */
  onAgain?: (role: RelationRole) => void;
};

function defaultGender(role: RelationRole, personGender: Gender): Gender {
  if (role === "father") return "male";
  if (role === "mother") return "female";
  if (role === "spouse") return personGender === "male" ? "female" : "male";
  return "male";
}

/** «Отец Гасан-Гусейна», «Жена Гамзата», «Ребёнок Розы». */
function sheetTitle(role: RelationRole, person: PersonDTO): string {
  const whose = genitive(person.firstName, person.gender);
  const noun =
    role === "father"
      ? "Отец"
      : role === "mother"
        ? "Мать"
        : role === "spouse"
          ? person.gender === "male"
            ? "Жена"
            : "Муж"
          : "Ребёнок";
  return `${noun} ${whose}`;
}

function relationWord(role: RelationRole, saved: PersonDTO, anchor: PersonDTO): string {
  const whose = genitive(anchor.firstName, anchor.gender);
  if (role === "father") return `отец ${whose}`;
  if (role === "mother") return `мать ${whose}`;
  if (role === "spouse") return `${saved.gender === "male" ? "муж" : "жена"} ${whose}`;
  return `${saved.gender === "male" ? "сын" : "дочь"} ${whose}`;
}

/** Кто появился после сохранения: новый человек или выбранный из древа. */
function findSaved(role: RelationRole, before: FamilyDTO, after: FamilyDTO, pickedId?: string) {
  const all = [after.father, after.mother, ...after.spouses, ...after.children].filter(
    (person): person is PersonDTO => Boolean(person),
  );
  if (pickedId) return all.find((person) => person.id === pickedId) ?? null;
  if (role === "father") return after.father;
  if (role === "mother") return after.mother;
  const known = new Set((role === "spouse" ? before.spouses : before.children).map((p) => p.id));
  return (role === "spouse" ? after.spouses : after.children).find((p) => !known.has(p.id)) ?? null;
}

type Next = { label: string; href?: string; again?: RelationRole };

function nextSteps(role: RelationRole, saved: PersonDTO, family: FamilyDTO): Next[] {
  const of = genitive(saved.firstName, saved.gender);
  const anchor = family.person;
  const steps: Next[] = [];
  if (role === "father" || role === "mother") {
    steps.push({ label: `Отец ${of}`, href: `/people/${saved.id}?add=father` });
    steps.push({ label: `Мать ${of}`, href: `/people/${saved.id}?add=mother` });
    if (role === "father" && !family.mother) steps.push({ label: `Мать ${genitive(anchor.firstName, anchor.gender)}`, again: "mother" });
    if (role === "mother" && !family.father) steps.push({ label: `Отец ${genitive(anchor.firstName, anchor.gender)}`, again: "father" });
  } else if (role === "child") {
    steps.push({ label: `Ещё ребёнок ${genitive(anchor.firstName, anchor.gender)}`, again: "child" });
    steps.push({ label: `${saved.gender === "male" ? "Жена" : "Муж"} ${of}`, href: `/people/${saved.id}?add=spouse` });
    steps.push({ label: `Дети ${of}`, href: `/people/${saved.id}?add=child` });
  } else {
    steps.push({ label: `Ребёнок ${genitive(anchor.firstName, anchor.gender)}`, again: "child" });
    steps.push({ label: `Отец ${of}`, href: `/people/${saved.id}?add=father` });
  }
  return steps;
}

export function AddRelativeSheet({ personId, role, family, onClose, onSaved, onAgain }: Props) {
  const router = useRouter();
  const genderLocked = role === "father" || role === "mother";
  const maleSpouse = family.spouses.find((spouse) => spouse.gender === "male") ?? null;
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
  const [saved, setSaved] = useState<PersonDTO | null>(null);
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
        lastName: form.lastName === previous.lastName ? updated.lastName : next.lastName,
        patronymic: form.patronymic === previous.patronymic ? updated.patronymic : next.patronymic,
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
  const [dismissKey, setDismissKey] = useState("");
  const [attentionKey, setAttentionKey] = useState("");
  const dismissed = dismissKey === nameKey;
  const unanswered = hits.length > 0 && !dismissed;

  const warning = relativeYearWarning(
    role,
    family.person,
    splitDate(form.born).year,
    splitDate(form.died).year,
    form.gender,
  );

  async function send(body: Record<string, unknown>, pickedId?: string) {
    setSaving(true);
    setError("");
    try {
      const after = await api<FamilyDTO>("/api/relations", {
        method: "POST",
        body: JSON.stringify({ personId, role, ...body }),
      });
      router.refresh();
      const person = findSaved(role, family, after, pickedId);
      if (person) setSaved(person);
      else onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  function create() {
    if (unanswered) {
      setAttentionKey(nameKey);
      setError("");
      return;
    }
    let newPerson;
    try {
      newPerson = parsePersonInput(formToInput(form));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Проверьте поля");
      return;
    }
    void send({ newPerson, namesakeOf: hits.map((hit) => hit.id) });
  }

  if (saved) {
    return (
      <Sheet title="Добавлено" onClose={onSaved}>
        <div className="added">
          <p className="added-title">
            {saved.firstName} — {relationWord(role, saved, family.person)}
          </p>
          <p className="added-lead">
            {role === "father" || role === "mother"
              ? "Линия стала на поколение длиннее. Продолжим?"
              : "Продолжим?"}
          </p>
          <ul className="added-next">
            {nextSteps(role, saved, family).map((step) => (
              <li key={step.label}>
                {step.href ? (
                  <Link href={step.href} className="added-step" onClick={onSaved}>
                    <span>{step.label}</span>
                    <span aria-hidden="true">+</span>
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="added-step"
                    onClick={() => (onAgain && step.again ? onAgain(step.again) : onSaved())}
                  >
                    <span>{step.label}</span>
                    <span aria-hidden="true">+</span>
                  </button>
                )}
              </li>
            ))}
          </ul>
          <div className="added-actions">
            <button type="button" className="btn-primary" onClick={onSaved}>
              Готово
            </button>
            <Link href={`/people/${saved.id}`} className="home-line-more" onClick={onSaved}>
              Открыть карточку {genitive(saved.firstName, saved.gender)}
            </Link>
          </div>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={sheetTitle(role, family.person)} onClose={onClose}>
      {hint ? <p className="person-form-hint">{hint}</p> : null}
      <PersonFields
        value={form}
        onChange={changeForm}
        lockGender={genderLocked}
        dateWarning={warning}
        afterName={
          <MatchPanel
            hits={hits}
            loading={loading}
            gender={form.gender}
            saving={saving}
            dismissed={dismissed}
            attention={attentionKey === nameKey && unanswered}
            onPick={(hit) => void send({ existingPersonId: hit.id }, hit.id)}
            onDismiss={() => setDismissKey(nameKey)}
            onUndo={() => setDismissKey("")}
          />
        }
        extras={<PersonExtras value={form} onChange={setForm} />}
      />
      <div className="person-form-submit">
        {attentionKey === nameKey && unanswered ? (
          <p className="person-form-warning">
            Сначала ответьте выше: это {form.gender === "male" ? "он" : "она"} или другой человек.
          </p>
        ) : null}
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <button type="button" className="btn-primary" disabled={saving} onClick={create}>
          {saving
            ? "Сохраняем…"
            : role === "father"
              ? "Добавить отца"
              : role === "mother"
                ? "Добавить мать"
                : role === "spouse"
                  ? family.person.gender === "male"
                    ? "Добавить жену"
                    : "Добавить мужа"
                  : "Добавить ребёнка"}
        </button>
      </div>
    </Sheet>
  );
}
