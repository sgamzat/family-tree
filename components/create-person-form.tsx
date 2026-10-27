"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PersonExtras } from "@/components/person-extras";
import { PersonFields, emptyPersonForm, formToInput, splitDate, type PersonFormValue } from "@/components/person-fields";
import { PersonPicker } from "@/components/person-picker";
import { MatchPanel } from "@/components/match-panel";
import { api } from "@/lib/api";
import {
  genitive,
  parsePersonInput,
  relativeYearWarning,
  type FamilyDTO,
  type PersonDTO,
  type RelationRole,
  type SearchHit,
} from "@/lib/names";
import { useClans } from "@/lib/use-clans";
import { usePersonSearch } from "@/lib/use-person-search";

const ROLES: ReadonlyArray<{ value: RelationRole; label: (anchor: PersonDTO) => string }> = [
  { value: "father", label: () => "отец" },
  { value: "mother", label: () => "мать" },
  { value: "spouse", label: (anchor) => (anchor.gender === "male" ? "жена" : "муж") },
  { value: "child", label: () => "сын или дочь" },
];

export function CreatePersonForm({ census = false }: { census?: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { clans, addClan } = useClans();
  const [form, setForm] = useState<PersonFormValue>(() => ({
    ...emptyPersonForm(),
    lastName: searchParams.get("lastName") ?? "",
    firstName: searchParams.get("firstName") ?? "",
    patronymic: searchParams.get("patronymic") ?? "",
  }));
  const [anchor, setAnchor] = useState<PersonDTO | null>(null);
  const [role, setRole] = useState<RelationRole>("child");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const attached = !census && anchor !== null;

  const { hits, loading } = usePersonSearch({
    lastName: form.lastName,
    firstName: form.firstName,
    patronymic: form.patronymic,
    ...(attached ? { gender: form.gender, nearId: anchor.id, role, excludeIds: [anchor.id], match: true } : {}),
  });
  const nameKey = [form.lastName, form.firstName, form.patronymic, form.gender].join("|");
  const [dismissKey, setDismissKey] = useState("");
  const [attentionKey, setAttentionKey] = useState("");
  const dismissed = dismissKey === nameKey;
  const unanswered = hits.length > 0 && !dismissed;

  const warning = attached
    ? relativeYearWarning(role, anchor, splitDate(form.born).year, splitDate(form.died).year, form.gender)
    : "";

  function chooseRole(next: RelationRole) {
    setRole(next);
    if (next === "father") setForm((value) => ({ ...value, gender: "male" }));
    if (next === "mother") setForm((value) => ({ ...value, gender: "female" }));
    if (next === "spouse" && anchor) {
      setForm((value) => ({ ...value, gender: anchor.gender === "male" ? "female" : "male" }));
    }
  }

  async function submit() {
    if (unanswered) {
      setAttentionKey(nameKey);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const payload = parsePersonInput(
        formToInput(form, census ? { inCensus1886: true, isLiving: false } : {}),
      );
      const namesakeOf = hits.map((hit) => hit.id);
      if (attached) {
        const after = await api<FamilyDTO>("/api/relations", {
          method: "POST",
          body: JSON.stringify({ personId: anchor.id, role, newPerson: payload, namesakeOf }),
        });
        const created =
          role === "father"
            ? after.father
            : role === "mother"
              ? after.mother
              : [...after.spouses, ...after.children].find(
                  (person) => person.firstName === payload.firstName && person.patronymic === payload.patronymic,
                );
        router.push(`/people/${created?.id ?? anchor.id}`);
      } else {
        const data = await api<{ person: PersonDTO }>("/api/people", {
          method: "POST",
          body: JSON.stringify({ ...payload, namesakeOf }),
        });
        router.push(`/people/${data.person.id}`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  }

  async function pickExisting(hit: SearchHit) {
    setSaving(true);
    setError("");
    try {
      if (census && !hit.inCensus1886) {
        await api("/api/census", { method: "POST", body: JSON.stringify({ personId: hit.id }) });
      }
      if (attached) {
        await api("/api/relations", {
          method: "POST",
          body: JSON.stringify({ personId: anchor.id, role, existingPersonId: hit.id }),
        });
      }
      router.push(`/people/${hit.id}`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
      setSaving(false);
    }
  }

  return (
    <div className="person-form">
      {census ? (
        <p className="person-form-hint is-census">
          Карточка попадёт в перепись 1886 года и в общее древо. Если такой человек уже есть,
          нажмите «Это он».
        </p>
      ) : (
        <section className="person-anchor" aria-label="Кому он родственник">
          <PersonPicker label="Кому он родственник?" value={anchor} onChange={setAnchor} />
          {anchor ? (
            <fieldset className="person-field">
              <legend>Кем приходится {genitive(anchor.firstName, anchor.gender)}</legend>
              <div className="segmented is-wrap">
                {ROLES.map((item) => (
                  <label key={item.value} className={role === item.value ? "is-on" : ""}>
                    <input
                      type="radio"
                      name="anchor-role"
                      checked={role === item.value}
                      onChange={() => chooseRole(item.value)}
                    />
                    {item.label(anchor)}
                  </label>
                ))}
              </div>
            </fieldset>
          ) : (
            <p className="person-form-hint">
              Найдите отца, мать, супруга или ребёнка этого человека — так он сразу встанет в
              древо. Можно и без этого, но тогда карточка будет стоять отдельно.
            </p>
          )}
        </section>
      )}

      <PersonFields
        value={form}
        onChange={setForm}
        lockGender={attached && (role === "father" || role === "mother")}
        dateWarning={warning}
        afterName={
          <MatchPanel
            hits={hits}
            loading={loading}
            gender={form.gender}
            saving={saving}
            dismissed={dismissed}
            attention={attentionKey === nameKey && unanswered}
            onPick={(hit) => void pickExisting(hit)}
            onDismiss={() => setDismissKey(nameKey)}
            onUndo={() => setDismissKey("")}
          />
        }
        moreHint={attached ? undefined : "другие имена, откуда известно, тухум"}
        extras={
          attached ? (
            <PersonExtras value={form} onChange={setForm} />
          ) : (
            <PersonExtras value={form} onChange={setForm} clans={clans} onClanCreated={addClan} />
          )
        }
      />

      <div className="person-form-submit">
        {attentionKey === nameKey && unanswered ? (
          <p className="person-form-warning">
            Сначала ответьте выше: это {form.gender === "male" ? "он" : "она"} или другой человек.
          </p>
        ) : null}
        {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
        <button type="button" className="btn-primary" disabled={saving} onClick={() => void submit()}>
          {saving
            ? "Сохраняем…"
            : census
              ? "Внести в перепись"
              : attached
                ? `Добавить в древо`
                : "Сохранить без связи"}
        </button>
      </div>
    </div>
  );
}
