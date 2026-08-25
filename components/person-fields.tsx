"use client";

import { useId, type ReactNode } from "react";
import type { Gender, PersonDTO } from "@/lib/names";

export type PersonFormValue = {
  lastName: string;
  firstName: string;
  patronymic: string;
  gender: Gender;
  birthYear: string;
  deathYear: string;
  birthDateText: string;
  deathDateText: string;
  isLiving: "" | "true" | "false";
  sourceNote: string;
  aliases: string;
  claimedClanId: string;
};

export function personToForm(person: PersonDTO): PersonFormValue {
  return {
    lastName: person.lastName,
    firstName: person.firstName,
    patronymic: person.patronymic,
    gender: person.gender,
    birthYear: person.birthYear ? String(person.birthYear) : "",
    deathYear: person.deathYear ? String(person.deathYear) : "",
    birthDateText: person.birthDateText,
    deathDateText: person.deathDateText,
    isLiving:
      person.isLiving === true ? "true" : person.isLiving === false ? "false" : "",
    sourceNote: person.sourceNote,
    aliases: person.aliases.join(", "),
    claimedClanId: person.claimedClanId ?? "",
  };
}

export const emptyPersonForm = (gender: Gender = "male"): PersonFormValue => ({
  lastName: "",
  firstName: "",
  patronymic: "",
  gender,
  birthYear: "",
  deathYear: "",
  birthDateText: "",
  deathDateText: "",
  isLiving: "",
  sourceNote: "",
  aliases: "",
  claimedClanId: "",
});

type Props = {
  value: PersonFormValue;
  onChange: (value: PersonFormValue) => void;
  lockGender?: boolean;
  extras?: ReactNode;
};

export function PersonFields({ value, onChange, lockGender, extras }: Props) {
  const genderName = useId();
  function patch(partial: Partial<PersonFormValue>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="grid gap-3">
      <label className="grid gap-1">
        <span className="text-sm text-[var(--muted)]">Фамилия (необязательно)</span>
        <input
          autoComplete="family-name"
          className="field"
          value={value.lastName}
          onChange={(event) => patch({ lastName: event.target.value })}
          placeholder="Ибрагимов"
        />
      </label>
      <label className="grid gap-1">
        <span className="text-sm text-[var(--muted)]">Имя</span>
        <input
          autoComplete="given-name"
          className="field"
          value={value.firstName}
          onChange={(event) => patch({ firstName: event.target.value })}
          placeholder="Магомед"
        />
      </label>
      <label className="grid gap-1">
        <span className="text-sm text-[var(--muted)]">Отчество</span>
        <input
          autoComplete="additional-name"
          className="field"
          value={value.patronymic}
          onChange={(event) => patch({ patronymic: event.target.value })}
          placeholder="Абдуллаевич"
        />
      </label>
      <fieldset className="grid gap-1">
        <legend className="text-sm text-[var(--muted)]">Пол</legend>
        <div className="flex gap-2">
          <label className="choice">
            <input
              type="radio"
              name={genderName}
              checked={value.gender === "male"}
              disabled={lockGender}
              onChange={() => patch({ gender: "male" })}
            />
            Мужчина
          </label>
          <label className="choice">
            <input
              type="radio"
              name={genderName}
              checked={value.gender === "female"}
              disabled={lockGender}
              onChange={() => patch({ gender: "female" })}
            />
            Женщина
          </label>
        </div>
      </fieldset>
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1">
          <span className="text-sm text-[var(--muted)]">Год рождения</span>
          <input
            className="field"
            inputMode="numeric"
            value={value.birthYear}
            onChange={(event) => patch({ birthYear: event.target.value })}
            placeholder="1952"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-[var(--muted)]">Год смерти</span>
          <input
            className="field"
            inputMode="numeric"
            value={value.deathYear}
            onChange={(event) => patch({ deathYear: event.target.value })}
            placeholder="если нет — пусто"
          />
        </label>
      </div>
      {extras}
    </div>
  );
}
