"use client";

import { useState } from "react";
import { PersonPicker } from "@/components/person-picker";
import { PersonTile } from "@/components/person-tile";
import { api } from "@/lib/api";
import { formatFio, type PersonDTO } from "@/lib/names";
import { stepCaption, type KinshipResult } from "@/lib/kinship";

export function KinshipFinder({
  initialFrom,
}: {
  initialFrom?: PersonDTO | null;
}) {
  const [from, setFrom] = useState<PersonDTO | null>(initialFrom ?? null);
  const [to, setTo] = useState<PersonDTO | null>(null);
  const [result, setResult] = useState<KinshipResult | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function search() {
    if (!from || !to) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const data = await api<KinshipResult | { error: string }>(
        `/api/kinship?from=${from.id}&to=${to.id}`,
      );
      if ("error" in data && data.error) {
        setError(data.error);
        return;
      }
      setResult(data as KinshipResult);
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
        <div className="grid gap-3 rounded-2xl border border-[var(--line)] bg-white p-4">
          <p className="text-lg font-semibold">{result.relation}</p>
          <p className="text-[var(--muted)]">{result.sentence}</p>
          <ol className="grid gap-2">
            {result.steps.map((step, index) => (
              <li key={`${step.person.id}-${index}`} className="grid gap-1">
                {step.via ? (
                  <span className="text-xs uppercase tracking-wide text-[var(--muted)]">
                    ↓ {stepCaption(step)}
                  </span>
                ) : null}
                <PersonTile
                  person={step.person}
                  href={`/people/${step.person.id}`}
                  current={
                    step.person.id === result.from.id ||
                    step.person.id === result.to.id
                  }
                />
              </li>
            ))}
          </ol>
          {result.steps.length > 1 ? (
            <p className="text-xs text-[var(--muted)]">
              Цепочка: {result.steps.map((step) => formatFio(step.person)).join(" → ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
