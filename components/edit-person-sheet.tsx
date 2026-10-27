"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PersonExtras } from "@/components/person-extras";
import { PersonFields, formToInput, personToForm } from "@/components/person-fields";
import { Sheet } from "@/components/sheet";
import { api } from "@/lib/api";
import { parsePersonInput, formatFio, type ClanDTO, type FamilyDTO, type PersonDTO } from "@/lib/names";
import { useClans } from "@/lib/use-clans";

type Props = {
  person: PersonDTO;
  foundedClans: ClanDTO[];
  /** "now" — владелец удаляет сразу; "request" — заявка хранителям; null — нельзя. */
  deleteMode?: "now" | "request" | null;
  hasPendingDelete?: boolean;
  onClose: () => void;
};

export function EditPersonSheet({
  person,
  foundedClans,
  deleteMode = null,
  hasPendingDelete = false,
  onClose,
}: Props) {
  const router = useRouter();
  const { clans, addClan } = useClans();
  const [form, setForm] = useState(() => personToForm(person));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const [reason, setReason] = useState("");
  const [sent, setSent] = useState(false);

  async function save() {
    setSaving(true);
    setError("");
    try {
      await api<FamilyDTO>(`/api/people/${person.id}`, {
        method: "PATCH",
        body: JSON.stringify(parsePersonInput(formToInput(form, { inCensus1886: person.inCensus1886 }))),
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
    if (deleteMode === "now") {
      const confirmed = window.confirm(
        `Удалить ${name} из дерева? Связи с родственниками тоже пропадут, сами люди останутся. В журнале останется полный снимок — человека можно будет восстановить.${founderNote}`,
      );
      if (!confirmed) return;
    } else if (!reason.trim()) {
      setError("Напишите, почему его нужно удалить: хранителю будет проще решить");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const result = await api<{ ok?: boolean; pending?: boolean }>(`/api/people/${person.id}`, {
        method: "DELETE",
        body: JSON.stringify({ reason: reason.trim() }),
      });
      if (result.pending) {
        setSent(true);
        setSaving(false);
        router.refresh();
        return;
      }
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
        moreHint="другие имена, откуда известно, тухум"
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
        {deleteMode === "now" ? (
          <button type="button" className="btn-danger" disabled={saving} onClick={remove}>
            Удалить человека
          </button>
        ) : null}
        {deleteMode === "request" && hasPendingDelete ? (
          <p className="text-sm text-[var(--muted)]">
            Заявка на удаление уже ждёт подтверждения хранителя.
          </p>
        ) : null}
        {deleteMode === "request" && !hasPendingDelete && sent ? (
          <p className="text-sm text-[var(--accent)]">
            Заявка отправлена. Человек будет удалён, когда её подтвердит хранитель.
          </p>
        ) : null}
        {deleteMode === "request" && !hasPendingDelete && !sent && !asking ? (
          <button type="button" className="btn-danger" disabled={saving} onClick={() => setAsking(true)}>
            Предложить удаление
          </button>
        ) : null}
        {deleteMode === "request" && !hasPendingDelete && !sent && asking ? (
          <div className="grid gap-2">
            <label className="grid gap-1">
              <span className="text-sm font-medium">Почему его нужно удалить?</span>
              <textarea
                className="field"
                rows={2}
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder="Например: внесён по ошибке, такого человека не было"
              />
            </label>
            <button type="button" className="btn-danger" disabled={saving} onClick={remove}>
              {saving ? "Отправляем…" : "Отправить заявку хранителям"}
            </button>
          </div>
        ) : null}
      </div>
    </Sheet>
  );
}
