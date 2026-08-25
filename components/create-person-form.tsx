"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PersonFields, emptyPersonForm } from "@/components/person-fields";
import { SuggestionList } from "@/components/suggestion-list";
import { api } from "@/lib/api";
import { parsePersonInput, type PersonDTO } from "@/lib/names";
import { usePersonSearch } from "@/lib/use-person-search";

export function CreatePersonForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState(() => ({
    ...emptyPersonForm(),
    lastName: searchParams.get("lastName") ?? "",
    firstName: searchParams.get("firstName") ?? "",
    patronymic: searchParams.get("patronymic") ?? "",
  }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const { hits, loading } = usePersonSearch({
    lastName: form.lastName,
    firstName: form.firstName,
    patronymic: form.patronymic,
  });

  async function submit() {
    setSaving(true);
    setError("");
    try {
      const payload = parsePersonInput({
        ...form,
        birthYear: form.birthYear,
        deathYear: form.deathYear,
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

  return (
    <div className="grid gap-4">
      <PersonFields value={form} onChange={setForm} />
      <SuggestionList
        hits={hits}
        loading={loading}
        onPick={(hit) => router.push(`/people/${hit.id}`)}
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
