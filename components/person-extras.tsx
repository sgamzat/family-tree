"use client";

import { bornFromCensusAge, type PersonFormValue } from "@/components/person-fields";
import { ClanSelect } from "@/components/clan-select";
import type { ClanDTO } from "@/lib/names";

type Props = {
  value: PersonFormValue;
  onChange: (value: PersonFormValue) => void;
  /** Без списка родов поле тухума не показываем (у родственника род считается по отцу). */
  clans?: ClanDTO[];
  onClanCreated?: (clan: ClanDTO) => void;
  founderId?: string;
};

/** Второстепенное — внутри «Подробнее». Любое поле можно оставить пустым. */
export function PersonExtras({ value, onChange, clans, onClanCreated, founderId }: Props) {
  const male = value.gender === "male";

  function patch(partial: Partial<PersonFormValue>) {
    onChange({ ...value, ...partial });
  }

  function changeCensusAge(censusAge: string) {
    // Год рождения подставляем, только если он пустой или был подставлен из прежнего возраста.
    const auto = !value.born.trim() || value.born === bornFromCensusAge(value.censusAge);
    patch({ censusAge, ...(auto ? { born: bornFromCensusAge(censusAge) } : {}) });
  }

  return (
    <div className="person-form">
      <label className="person-field">
        <span>Другие имена</span>
        <input
          className="field"
          value={value.aliases}
          onChange={(event) => patch({ aliases: event.target.value })}
          placeholder="Магомет, Мухаммад — через запятую"
        />
      </label>

      <fieldset className="person-census">
        <label className="person-check">
          <input
            type="checkbox"
            checked={value.inCensus}
            onChange={(event) => patch({ inCensus: event.target.checked })}
          />
          <span>{male ? "Записан" : "Записана"} в переписи 1886 года</span>
        </label>
        {value.inCensus ? (
          <div className="person-form-row">
            <label className="person-field">
              <span>Семья № по списку</span>
              <input
                className="field"
                inputMode="numeric"
                value={value.censusFamily}
                onChange={(event) => patch({ censusFamily: event.target.value })}
                placeholder="8"
              />
            </label>
            <label className="person-field">
              <span>Возраст в 1886</span>
              <input
                className="field"
                inputMode="numeric"
                value={value.censusAge}
                onChange={(event) => changeCensusAge(event.target.value.replace(/\D/g, "").slice(0, 3))}
                placeholder="65"
              />
            </label>
          </div>
        ) : null}
      </fieldset>

      <label className="person-field">
        <span>{male ? "Где похоронен" : "Где похоронена"}</span>
        <input
          className="field"
          value={value.burialPlace}
          onChange={(event) => patch({ burialPlace: event.target.value })}
          placeholder="кладбище, село"
        />
      </label>
      <label className="person-field">
        <span>{male ? "Где жил" : "Где жила"}, если не в селе</span>
        <input
          className="field"
          value={value.residence}
          onChange={(event) => patch({ residence: event.target.value })}
          placeholder="Махачкала, с 1960 года"
        />
      </label>
      <label className="person-field">
        <span>Война</span>
        <input
          className="field"
          value={value.warService}
          onChange={(event) => patch({ warService: event.target.value })}
          placeholder="где воевал, вернулся ли, награды"
        />
      </label>
      <label className="person-field">
        <span>Откуда известно</span>
        <textarea
          className="field"
          rows={2}
          value={value.sourceNote}
          onChange={(event) => patch({ sourceNote: event.target.value })}
          placeholder="Так рассказывала бабушка; книга о селе, с. 37"
        />
      </label>
      {clans && onClanCreated ? (
        <ClanSelect
          value={value.claimedClanId}
          clans={clans}
          founderId={founderId}
          onChange={(claimedClanId) => patch({ claimedClanId })}
          onCreated={onClanCreated}
        />
      ) : null}
    </div>
  );
}
