"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PersonExtras } from "@/components/person-extras";
import { PersonFields, personToForm } from "@/components/person-fields";
import { api } from "@/lib/api";
import { parsePersonInput, type FamilyDTO, type PersonDTO } from "@/lib/names";
import { useClans } from "@/lib/use-clans";

type Props = {
  person: PersonDTO;
  onClose: () => void;
};

export function EditPersonSheet({ person, onClose }: Props) {
  const router = useRouter();
  const { clans, addClan } = useClans();
  const [form, setForm] = useState(() => personToForm(person));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setError("");
    try {
      await api<FamilyDTO>(`/api/people/${person.id}`, {
        method: "PATCH",
        body: JSON.stringify(parsePersonInput(form)),
      });
      onClose();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const name = [person.lastName, person.firstName, person.patronymic]
      .filter(Boolean)
      .join(" ");
    const confirmed = window.confirm(
      `Удалить ${name || "этого человека"} из дерева? Связи с родственниками тоже пропадут, сами люди останутся.`,
    );
    if (!confirmed) return;
    setSaving(true);
    setError("");
    try {
      await api(`/api/people/${person.id}`, { method: "DELETE" });
      router.push("/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить");
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-20 bg-black/40" onClick={onClose}>
      <div
        className="absolute inset-x-0 bottom-0 max-h-[92vh] overflow-auto rounded-t-2xl bg-[var(--paper)] p-4 shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto max-w-2xl">
          <div className="mb-4 flex items-start justify-between gap-3">
            <h2 className="text-lg font-semibold">Изменить карточку</h2>
            <button type="button" className="text-sm text-[var(--muted)]" onClick={onClose}>
              Закрыть
            </button>
          </div>
          <PersonFields
            value={form}
            onChange={setForm}
            extras={
              <PersonExtras
                value={form}
                onChange={setForm}
                clans={clans}
                onClanCreated={addClan}
                founderId={person.id}
              />
            }
          />
          {error ? <p className="mt-3 text-sm text-[var(--danger)]">{error}</p> : null}
          <div className="mt-4 grid gap-2">
            <button type="button" className="btn-primary" disabled={saving} onClick={save}>
              {saving ? "Сохраняем…" : "Сохранить"}
            </button>
            <button
              type="button"
              className="btn-danger"
              disabled={saving}
              onClick={remove}
            >
              Удалить человека
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
