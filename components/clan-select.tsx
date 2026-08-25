"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import type { ClanDTO } from "@/lib/names";

type Props = {
  value: string;
  clans: ClanDTO[];
  onChange: (clanId: string) => void;
  onCreated: (clan: ClanDTO) => void;
  founderId?: string;
};

export function ClanSelect({
  value,
  clans,
  onChange,
  onCreated,
  founderId,
}: Props) {
  const [name, setName] = useState("");
  const [asFounder, setAsFounder] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function createClan() {
    setSaving(true);
    setError("");
    try {
      const data = await api<{ clan: ClanDTO }>("/api/clans", {
        method: "POST",
        body: JSON.stringify({
          name,
          founderId: asFounder ? founderId : undefined,
        }),
      });
      onCreated(data.clan);
      onChange(data.clan.id);
      setName("");
      setAsFounder(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать род");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-2">
      <label className="grid gap-1">
        <span className="text-sm text-[var(--muted)]">Род (тухум), заявка</span>
        <select
          className="field"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        >
          <option value="">Не указан</option>
          {clans.map((clan) => (
            <option key={clan.id} value={clan.id}>
              {clan.name}
            </option>
          ))}
        </select>
      </label>
      <p className="text-xs leading-4 text-[var(--muted)]">
        Это подсказка. Настоящий род считается по цепочке отцов до родоначальника.
      </p>
      <div className="grid gap-2 rounded-xl border border-[var(--line)] bg-white p-3">
        <span className="text-sm text-[var(--muted)]">Или создать род</span>
        <input
          className="field"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Апарисеб"
        />
        {founderId ? (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={asFounder}
              onChange={(event) => setAsFounder(event.target.checked)}
            />
            Этот человек — родоначальник
          </label>
        ) : null}
        <button
          type="button"
          className="btn-secondary"
          disabled={saving || name.trim().length === 0}
          onClick={createClan}
        >
          {saving ? "Создаём…" : "Добавить род"}
        </button>
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      </div>
    </div>
  );
}
