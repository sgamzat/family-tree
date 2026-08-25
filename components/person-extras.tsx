"use client";

import type { PersonFormValue } from "@/components/person-fields";
import { ClanSelect } from "@/components/clan-select";
import type { ClanDTO } from "@/lib/names";

type Props = {
  value: PersonFormValue;
  onChange: (value: PersonFormValue) => void;
  clans: ClanDTO[];
  onClanCreated: (clan: ClanDTO) => void;
  founderId?: string;
};

export function PersonExtras({
  value,
  onChange,
  clans,
  onClanCreated,
  founderId,
}: Props) {
  function patch(partial: Partial<PersonFormValue>) {
    onChange({ ...value, ...partial });
  }

  return (
    <div className="grid gap-3">
      <div className="grid grid-cols-2 gap-3">
        <label className="grid gap-1">
          <span className="text-sm text-[var(--muted)]">Дата рождения, словами</span>
          <input
            className="field"
            value={value.birthDateText}
            onChange={(event) => patch({ birthDateText: event.target.value })}
            placeholder="около 1900"
          />
        </label>
        <label className="grid gap-1">
          <span className="text-sm text-[var(--muted)]">Дата смерти, словами</span>
          <input
            className="field"
            value={value.deathDateText}
            onChange={(event) => patch({ deathDateText: event.target.value })}
            placeholder="до войны"
          />
        </label>
      </div>
      <label className="grid gap-1">
        <span className="text-sm text-[var(--muted)]">Жив?</span>
        <select
          className="field"
          value={value.isLiving}
          onChange={(event) =>
            patch({ isLiving: event.target.value as PersonFormValue["isLiving"] })
          }
        >
          <option value="">Неизвестно</option>
          <option value="true">Да</option>
          <option value="false">Нет</option>
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-sm text-[var(--muted)]">Другие имена</span>
        <input
          className="field"
          value={value.aliases}
          onChange={(event) => patch({ aliases: event.target.value })}
          placeholder="Магомет, Мухаммад"
        />
      </label>
      <label className="grid gap-1">
        <span className="text-sm text-[var(--muted)]">Откуда известно</span>
        <textarea
          className="field min-h-[4.5rem] resize-y"
          value={value.sourceNote}
          onChange={(event) => patch({ sourceNote: event.target.value })}
          placeholder="Так рассказывала бабушка"
        />
      </label>
      <ClanSelect
        value={value.claimedClanId}
        clans={clans}
        founderId={founderId}
        onChange={(claimedClanId) => patch({ claimedClanId })}
        onCreated={onClanCreated}
      />
    </div>
  );
}
