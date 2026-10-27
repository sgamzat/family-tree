"use client";

import { useId, useRef, type ReactNode } from "react";
import { DESCRIPTION_MAX, type Gender, type PersonDTO } from "@/lib/names";

/**
 * Поля карточки человека. Даты — одним полем: «1952», «около 1900», «весной 1943» —
 * год сайт найдёт сам. Отметки «жив/умер» нет: всё видно по дате смерти.
 */
export type PersonFormValue = {
  lastName: string;
  firstName: string;
  patronymic: string;
  gender: Gender;
  born: string;
  died: string;
  description: string;
  sourceNote: string;
  aliases: string;
  claimedClanId: string;
};

function dateToText(year: number | null, text: string): string {
  const words = text.trim();
  if (!year) return words;
  if (!words) return String(year);
  return words.includes(String(year)) ? words : `${words} ${year}`;
}

/** «около 1900» → год 1900 и подпись «около 1900»; «1952» → только год. */
export function splitDate(value: string): { year: number | null; text: string } {
  const words = value.trim().replace(/\s+/g, " ");
  const match = words.match(/(?:^|\D)(1[5-9]\d\d|20\d\d)(?!\d)/);
  const year = match ? Number(match[1]) : null;
  return { year, text: year !== null && words === String(year) ? "" : words };
}

export function personToForm(person: PersonDTO): PersonFormValue {
  return {
    lastName: person.lastName,
    firstName: person.firstName,
    patronymic: person.patronymic,
    gender: person.gender,
    born: dateToText(person.birthYear, person.birthDateText),
    died: dateToText(person.deathYear, person.deathDateText),
    description: person.description ?? "",
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
  born: "",
  died: "",
  description: "",
  sourceNote: "",
  aliases: "",
  claimedClanId: "",
});

/** Форма → тело запроса для parsePersonInput. */
export function formToInput(form: PersonFormValue, extra: Record<string, unknown> = {}) {
  const born = splitDate(form.born);
  const died = splitDate(form.died);
  return {
    lastName: form.lastName,
    firstName: form.firstName,
    patronymic: form.patronymic,
    gender: form.gender,
    birthYear: born.year,
    birthDateText: born.text,
    deathYear: died.year,
    deathDateText: died.text,
    description: form.description,
    sourceNote: form.sourceNote,
    aliases: form.aliases,
    claimedClanId: form.claimedClanId,
    ...extra,
  };
}

/** Пол по отчеству: -вич / оглы — мужчина, -вна / кызы — женщина. */
export function genderFromPatronymic(value: string): Gender | null {
  const word = value.trim().toLowerCase();
  if (/(вич|ич|оглы|улы)$/.test(word)) return "male";
  if (/(вна|чна|кызы|гызы)$/.test(word)) return "female";
  return null;
}

type Props = {
  value: PersonFormValue;
  onChange: (value: PersonFormValue) => void;
  /** Для отца и матери пол известен заранее — переключателя нет. */
  lockGender?: boolean;
  /** Совпадения «Возможно, он уже есть» — сразу под именем. */
  afterName?: ReactNode;
  /** Предупреждения о годах. */
  dateWarning?: string;
  /** Свёрнутый блок «Подробнее». */
  extras?: ReactNode;
  moreHint?: string;
};

export function PersonFields({
  value,
  onChange,
  lockGender,
  afterName,
  dateWarning,
  extras,
  moreHint,
}: Props) {
  const genderName = useId();
  const genderTouched = useRef(false);
  const male = value.gender === "male";

  function patch(partial: Partial<PersonFormValue>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="person-form">
      <label className="person-field">
        <span>Имя</span>
        <input
          autoComplete="off"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          className="field"
          value={value.firstName}
          onChange={(event) => patch({ firstName: event.target.value })}
          placeholder="например, Магомед"
          required
        />
      </label>
      <div className="person-form-row">
        <label className="person-field">
          <span>Отчество</span>
          <input
            autoComplete="off"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            className="field"
            value={value.patronymic}
            onChange={(event) => {
              const patronymic = event.target.value;
              const guessed = !lockGender && !genderTouched.current ? genderFromPatronymic(patronymic) : null;
              patch({ patronymic, ...(guessed ? { gender: guessed } : {}) });
            }}
            placeholder="если знаете"
          />
        </label>
        <label className="person-field">
          <span>Фамилия</span>
          <input
            autoComplete="off"
            autoCapitalize="words"
            autoCorrect="off"
            spellCheck={false}
            className="field"
            value={value.lastName}
            onChange={(event) => patch({ lastName: event.target.value })}
            placeholder="если была"
          />
        </label>
      </div>

      {lockGender ? null : (
        <fieldset className="person-field">
          <legend>Пол</legend>
          <div className="segmented">
            {(["male", "female"] as const).map((gender) => (
              <label key={gender} className={value.gender === gender ? "is-on" : ""}>
                <input
                  type="radio"
                  name={genderName}
                  checked={value.gender === gender}
                  onChange={() => {
                    genderTouched.current = true;
                    patch({ gender });
                  }}
                />
                {gender === "male" ? "Мужчина" : "Женщина"}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      {afterName}

      <div className="person-form-row">
        <label className="person-field">
          <span>{male ? "Родился" : "Родилась"}</span>
          <input
            className="field"
            value={value.born}
            onChange={(event) => patch({ born: event.target.value })}
            placeholder="1952, около 1900"
          />
        </label>
        <label className="person-field">
          <span>{male ? "Умер" : "Умерла"}</span>
          <input
            className="field"
            value={value.died}
            onChange={(event) => patch({ died: event.target.value })}
            placeholder="год, «до войны»"
          />
        </label>
      </div>
      {dateWarning ? <p className="person-form-warning">{dateWarning}</p> : null}

      <label className="person-field">
        <span>{male ? "Каким он был" : "Какой она была"}</span>
        <textarea
          className="field person-description"
          value={value.description}
          maxLength={DESCRIPTION_MAX}
          onChange={(event) => patch({ description: event.target.value })}
          placeholder={
            male
              ? "Чем занимался, какое ремесло знал, где учился, каким его помнят — внешность, характер, истории"
              : "Чем занималась, какое ремесло знала, где училась, какой её помнят — внешность, характер, истории"
          }
          rows={3}
        />
      </label>

      {extras ? (
        <details className="person-more">
          <summary>
            Подробнее <span>{moreHint ?? "другие имена, откуда известно"}</span>
          </summary>
          <div className="person-more-body">{extras}</div>
        </details>
      ) : null}
    </div>
  );
}
