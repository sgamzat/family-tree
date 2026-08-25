"use client";

import { useState } from "react";
import { PersonPicker } from "@/components/person-picker";
import { PersonTile } from "@/components/person-tile";
import { api } from "@/lib/api";
import { formatFio, type PersonDTO } from "@/lib/names";
import {
  stepCaption,
  type KinshipLookup,
  type KinshipPath,
  type KinshipStep,
} from "@/lib/kinship";

function KinshipPathView({
  from,
  to,
  relation,
  sentence,
  steps,
}: {
  from: PersonDTO;
  to: PersonDTO;
  relation: string;
  sentence?: string;
  steps: KinshipStep[];
}) {
  const text =
    sentence ?? `${formatFio(to)} — ${relation} для ${formatFio(from)}.`;

  return (
    <div className="grid gap-3 rounded-2xl border border-[var(--line)] bg-white p-4">
      <p className="text-lg font-semibold">{relation}</p>
      <p className="text-[var(--muted)]">{text}</p>
      <ol className="grid gap-2">
        {steps.map((step, index) => (
          <li key={`${step.person.id}-${index}`} className="grid gap-1">
            {step.via ? (
              <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
                ↓ {stepCaption(step)}
              </span>
            ) : null}
            <PersonTile
              person={step.person}
              href={`/people/${step.person.id}`}
              current={step.person.id === from.id || step.person.id === to.id}
            />
          </li>
        ))}
      </ol>
      {steps.length > 1 ? (
        <p className="text-xs text-[var(--muted)]">
          Цепочка: {steps.map((step) => formatFio(step.person)).join(" → ")}
        </p>
      ) : null}
    </div>
  );
}

function AlternatePath({
  from,
  to,
  path,
}: {
  from: PersonDTO;
  to: PersonDTO;
  path: KinshipPath;
}) {
  return (
    <KinshipPathView
      from={from}
      to={to}
      relation={path.relation}
      steps={path.steps}
    />
  );
}

export function KinshipFinder({
  initialFrom,
}: {
  initialFrom?: PersonDTO | null;
}) {
  const [from, setFrom] = useState<PersonDTO | null>(initialFrom ?? null);
  const [to, setTo] = useState<PersonDTO | null>(null);
  const [result, setResult] = useState<KinshipLookup | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function search() {
    if (!from || !to) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await api<KinshipLookup | { error: string }>(
        `/api/kinship?from=${from.id}&to=${to.id}`,
      );
      if ("error" in data && data.error) {
        setError(data.error);
        return;
      }
      setResult(data as KinshipLookup);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось найти связь");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <PersonPicker
        label="Первый человек"
        value={from}
        onChange={(person) => {
          setFrom(person);
          setResult(null);
        }}
        excludeId={to?.id}
      />
      <PersonPicker
        label="Второй человек"
        value={to}
        onChange={(person) => {
          setTo(person);
          setResult(null);
        }}
        excludeId={from?.id}
      />
      <button
        type="button"
        className="btn-primary"
        disabled={!from || !to || loading}
        onClick={search}
      >
        {loading ? "Ищем связь…" : "Показать родство"}
      </button>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {result ? (
        <div className="grid gap-4">
          <KinshipPathView
            from={result.from}
            to={result.to}
            relation={result.relation}
            sentence={result.sentence}
            steps={result.steps}
          />
          {result.alternates.length > 0 ? (
            <div className="grid gap-3">
              <div>
                <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
                  Ещё {result.alternates.length === 1 ? "один путь" : "пути"}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  При близких браках люди часто связаны сразу несколькими
                  линиями — кровной и через свойство.
                </p>
              </div>
              {result.alternates.map((path, index) => (
                <AlternatePath
                  key={`${path.relation}-${index}`}
                  from={result.from}
                  to={result.to}
                  path={path}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
