"use client";

import Link from "next/link";
import { useState } from "react";
import { PersonTile } from "@/components/person-tile";
import { stepCaption, type KinshipPath } from "@/lib/kinship";
import { formatFio, type PersonDTO } from "@/lib/names";
import { usePersonSearch } from "@/lib/use-person-search";

function Slot({
  label,
  value,
  active,
  excludeId,
  onChange,
}: {
  label: string;
  value: PersonDTO | null;
  active: boolean;
  excludeId?: string;
  onChange: (person: PersonDTO | null) => void;
}) {
  const [query, setQuery] = useState("");
  const { hits, loading } = usePersonSearch({
    query,
    excludeIds: excludeId ? [excludeId] : [],
    enabled: !value,
  });
  const showList = !value && query.trim().length >= 2;

  if (value) {
    return (
      <div className="kin-slot is-filled">
        <span className="kin-slot-label">{label}</span>
        <span className="kin-slot-name">{formatFio(value) || value.firstName}</span>
        <button
          type="button"
          className="kin-slot-clear"
          aria-label={`Убрать: ${value.firstName}`}
          onClick={() => {
            onChange(null);
            setQuery("");
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div className={`kin-slot picker ${active ? "is-active" : ""}`}>
      <label className="kin-slot-field">
        <span className="kin-slot-label">{label}</span>
        <input
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          autoCapitalize="words"
          spellCheck={false}
          role="combobox"
          aria-expanded={showList}
          aria-autocomplete="list"
          placeholder={active ? "нажмите на карте или введите имя" : "имя"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {showList ? (
        <div className="picker-results kin-slot-results">
          {loading && hits.length === 0 ? (
            <p className="px-1 text-sm text-[var(--muted)]">Ищем…</p>
          ) : null}
          {hits.map((hit) => (
            <PersonTile
              key={hit.id}
              person={hit}
              onClick={() => {
                onChange(hit);
                setQuery("");
              }}
            />
          ))}
          {hits.length === 0 && !loading ? (
            <p className="px-1 text-sm text-[var(--muted)]">Такого имени нет в древе.</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * «Родство» на карте: двое выбираются нажатием на карте или по имени,
 * путь между ними рисуется линией, здесь — кем они приходятся друг другу.
 */
export function KinshipBar({
  focus,
  first,
  second,
  onFirst,
  onSecond,
  loading,
  error,
  lines,
  lineIndex,
  onNextLine,
  offMap,
  onClose,
}: {
  focus: PersonDTO;
  first: PersonDTO | null;
  second: PersonDTO | null;
  onFirst: (person: PersonDTO | null) => void;
  onSecond: (person: PersonDTO | null) => void;
  loading: boolean;
  error: string;
  lines: KinshipPath[];
  lineIndex: number;
  onNextLine: () => void;
  offMap: boolean;
  onClose: () => void;
}) {
  const line = lines[lineIndex] ?? null;
  const hint = !first
    ? "Нажмите на первого человека на карте или введите имя."
    : !second
      ? "Теперь второго — на карте или по имени."
      : null;

  return (
    <section className="kin-bar" aria-label="Родство">
      <div className="kin-bar-head">
        <p className="kin-bar-title serif">Кем приходятся друг другу</p>
        <button type="button" className="kin-bar-close" onClick={onClose}>
          Закрыть
        </button>
      </div>

      <div className="kin-slots">
        <Slot
          label="Первый"
          value={first}
          active={!first}
          excludeId={second?.id}
          onChange={onFirst}
        />
        <Slot
          label="Второй"
          value={second}
          active={Boolean(first) && !second}
          excludeId={first?.id}
          onChange={onSecond}
        />
      </div>

      {!first && focus ? (
        <button type="button" className="kin-quick" onClick={() => onFirst(focus)}>
          Начать с: {focus.firstName}
        </button>
      ) : null}
      {hint ? <p className="kin-hint">{hint}</p> : null}
      {loading ? <p className="kin-hint">Ищем связь…</p> : null}
      {error ? <p className="kin-error">{error}</p> : null}

      {line && first && second ? (
        <div className="kin-result">
          <p className="kin-relation">
            <span className="serif">{second.firstName}</span> — {line.relation} для{" "}
            {first.firstName}
          </p>
          <ol className="kin-chain">
            {line.steps.map((step, index) => (
              <li key={`${step.person.id}-${index}`}>
                {index > 0 ? <span className="kin-arrow" aria-hidden="true">→</span> : null}
                <span className="kin-chip">
                  {stepCaption(step) ? `${stepCaption(step)} ` : ""}
                  {step.person.firstName}
                </span>
              </li>
            ))}
          </ol>
          <div className="kin-actions">
            {lines.length > 1 ? (
              <button
                type="button"
                className="kin-next"
                title="Эти двое связаны сразу несколькими линиями — так бывает при близких браках"
                onClick={onNextLine}
              >
                Ещё линия · {lineIndex + 1} из {lines.length}
              </button>
            ) : null}
            <Link href={`/kinship?from=${first.id}&to=${second.id}`} className="kin-link">
              Подробнее
            </Link>
          </div>
          {offMap ? (
            <p className="kin-hint">
              Этих людей нет на древе {focus.firstName}, поэтому линию нарисовать негде.
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
