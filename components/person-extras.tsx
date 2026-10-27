"use client";

import type { PersonFormValue } from "@/components/person-fields";
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

/** Второстепенное — внутри «Подробнее». */
export function PersonExtras({ value, onChange, clans, onClanCreated, founderId }: Props) {
  function patch(partial: Partial<PersonFormValue>) {
    onChange({ ...value, ...partial });
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
      <label className="person-field">
        <span>Откуда известно</span>
        <textarea
          className="field"
          rows={2}
          value={value.sourceNote}
          onChange={(event) => patch({ sourceNote: event.target.value })}
          placeholder="Так рассказывала бабушка; запись в метрической книге"
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
