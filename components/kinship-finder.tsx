"use client";

import { useEffect, useState } from "react";
import { PersonPicker } from "@/components/person-picker";
import { PersonTile } from "@/components/person-tile";
import { api } from "@/lib/api";
import type { PersonDTO } from "@/lib/names";
import {
  pathUsesSpouse,
  splitAlternatePaths,
  stepCaption,
  type KinshipLookup,
  type KinshipPath,
  type KinshipStep,
} from "@/lib/kinship";

function KinshipPathView({
  from,
  to,
  relation,
  steps,
  compact,
}: {
  from: PersonDTO;
  to: PersonDTO;
  relation: string;
  steps: KinshipStep[];
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "grid gap-2"
          : "grid gap-3 rounded-2xl border border-[var(--line)] bg-white p-4"
      }
    >
      <p className={compact ? "font-medium" : "text-lg font-semibold"}>{relation}</p>
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
    </div>
  );
}

function AlternatePath({
  from,
  to,
  path,
  compact,
}: {
  from: PersonDTO;
  to: PersonDTO;
  path: KinshipPath;
  compact?: boolean;
}) {
  return (
    <KinshipPathView
      from={from}
      to={to}
      relation={path.relation}
      steps={path.steps}
      compact={compact}
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

  useEffect(() => {
    if (!from || !to) {
      setResult(null);
      setError("");
      setLoading(false);
      return;
    }

    const fromId = from.id;
    const toId = to.id;
    let cancelled = false;
    setLoading(true);
    setError("");
    setResult(null);

    void api<KinshipLookup | { error: string }>(
      `/api/kinship?from=${fromId}&to=${toId}`,
    )
      .then((data) => {
        if (cancelled) return;
        if ("error" in data && data.error) {
          setError(data.error);
          return;
        }
        setResult(data as KinshipLookup);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Не удалось найти связь");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [from, to]);

  const split = result
    ? splitAlternatePaths(
        { relation: result.relation, steps: result.steps },
        result.alternates,
      )
    : null;

  return (
    <div className="grid gap-5">
      <PersonPicker
        label="Для кого"
        value={from}
        onChange={setFrom}
        excludeId={to?.id}
      />
      <PersonPicker
        label="Кем приходится"
        value={to}
        onChange={setTo}
        excludeId={from?.id}
      />
      {loading ? <p className="text-sm text-[var(--muted)]">Ищем связь…</p> : null}
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {result && split ? (
        <div className="grid gap-4">
          <KinshipPathView
            from={result.from}
            to={result.to}
            relation={result.relation}
            steps={result.steps}
          />
          {split.close ? (
            <div className="grid gap-2">
              <div>
                <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
                  {pathUsesSpouse(split.close) ? "Через брак" : "Кровная линия"}
                </h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  При близких браках люди связаны сразу несколькими линиями.
                </p>
              </div>
              <AlternatePath
                from={result.from}
                to={result.to}
                path={split.close}
              />
            </div>
          ) : null}
          {split.extra.length > 0 ? (
            <details className="kin-more">
              <summary>
                Ещё {split.extra.length === 1 ? "одна линия" : `линии (${split.extra.length})`}
              </summary>
              <div className="mt-3 grid gap-4">
                {split.extra.map((path, index) => (
                  <AlternatePath
                    key={`${path.relation}-${index}`}
                    from={result.from}
                    to={result.to}
                    path={path}
                    compact
                  />
                ))}
              </div>
            </details>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
