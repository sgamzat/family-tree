"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PersonExtras } from "@/components/person-extras";
import { PersonFields, personToForm } from "@/components/person-fields";
import { Sheet } from "@/components/sheet";
import { api } from "@/lib/api";
import { parsePersonInput, formatFio, type ClanDTO, type FamilyDTO, type PersonDTO } from "@/lib/names";
import { useClans } from "@/lib/use-clans";

type Props = {
  person: PersonDTO;
  foundedClans: ClanDTO[];
  onClose: () => void;
};

export function EditPersonSheet({ person, foundedClans, onClose }: Props) {
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
    const name = formatFio(person) || "этого человека";
    const founderNote =
      foundedClans.length === 0
        ? ""
        : foundedClans.length === 1
          ? `\n\nЭтот человек — родоначальник рода «${foundedClans[0].name}». После удаления у рода не будет родоначальника, и потомки перестанут вычислять этот тухум. Удалить всё равно?`
          : `\n\nЭтот человек — родоначальник родов ${foundedClans
              .map((clan) => `«${clan.name}»`)
              .join(", ")}. После удаления у этих родов не будет родоначальника, и потомки перестанут вычислять тухум. Удалить всё равно?`;
    const confirmed = window.confirm(
      `Удалить ${name} из дерева? Связи с родственниками тоже пропадут, сами люди останутся.${founderNote}`,
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
    <Sheet title="Изменить карточку" onClose={onClose}>
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
    </Sheet>
  );
}
