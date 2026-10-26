"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PersonExtras } from "@/components/person-extras";
import { PersonFields, emptyPersonForm, type PersonFormValue } from "@/components/person-fields";
import { SuggestionList } from "@/components/suggestion-list";
import { api } from "@/lib/api";
import { parsePersonInput, type PersonDTO, type SearchHit } from "@/lib/names";
import { useClans } from "@/lib/use-clans";
import { usePersonSearch } from "@/lib/use-person-search";

export function CreatePersonForm({ census = false }: { census?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clans, addClan } = useClans();
  const [form, setForm] = useState<PersonFormValue>(() => ({
    ...emptyPersonForm(),
    lastName: searchParams.get("lastName") ?? "",
    firstName: searchParams.get("firstName") ?? "",
    patronymic: searchParams.get("patronymic") ?? "",
    isLiving: census ? "false" : "",
  }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { hits, loading } = usePersonSearch({
    lastName: form.lastName,
    firstName: form.firstName,
    patronymic: form.patronymic,
  });

  async function submit() {
    if (hits.length > 0) {
      const ok = window.confirm(
        "Похожие люди уже есть в дереве. Точно создать нового, а не нажать «Это он»?",
      );
      if (!ok) return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = parsePersonInput({
        ...form,
        birthYear: form.birthYear,
        deathYear: form.deathYear,
        inCensus1886: census,
      });
      const data = await api<{ person: PersonDTO }>("/api/people", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      router.push(`/people/${data.person.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  async function pickExisting(hit: SearchHit) {
    if (census && !hit.inCensus1886) {
      setSaving(true);
      setError("");
      try {
        await api("/api/census", {
          method: "POST",
          body: JSON.stringify({ personId: hit.id }),
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось добавить в перепись");
        setSaving(false);
        return;
      }
    }
    router.push(`/people/${hit.id}`);
    router.refresh();
  }

  return (
    <div className="grid gap-4">
      {census ? (
        <p className="rounded-xl bg-[var(--accent-soft)] px-3 py-2 text-sm text-[var(--accent)]">
          Карточка попадёт в перепись населения 1886 года и в общее древо. Если это
          тот же человек, нажмите «Это он».
        </p>
      ) : null}
      <PersonFields
        value={form}
        onChange={setForm}
        extras={
          <PersonExtras
            value={form}
            onChange={setForm}
            clans={clans}
            onClanCreated={addClan}
          />
        }
      />
      <SuggestionList
        hits={hits}
        loading={loading}
        onPick={(hit) => void pickExisting(hit)}
      />
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <button type="button" className="btn-primary" disabled={saving} onClick={submit}>
        {hits.length > 0
          ? "Это другой человек — создать нового"
          : saving
            ? "Сохраняем…"
            : "Сохранить"}
      </button>
    </div>
  );
}
