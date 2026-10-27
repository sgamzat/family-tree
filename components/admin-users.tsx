"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

export function AdminUsers() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"viewer" | "editor" | "admin">("editor");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError("");
    try {
      await api("/api/admin/users", {
        method: "POST",
        body: JSON.stringify({ name, login, password, role }),
      });
      setName("");
      setLogin("");
      setPassword("");
      setRole("editor");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось завести вход");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="grid gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        void submit();
      }}
    >
      <label className="grid gap-1">
        <span className="text-sm text-[var(--muted)]">Как обращаться</span>
        <input className="field" value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className="grid gap-1">
        <span className="text-sm text-[var(--muted)]">Логин</span>
        <input
          className="field"
          autoCapitalize="none"
          spellCheck={false}
          value={login}
          onChange={(event) => setLogin(event.target.value)}
        />
      </label>
      <label className="grid gap-1">
        <span className="text-sm text-[var(--muted)]">Пароль (не короче 8 символов)</span>
        <input
          className="field"
          type="text"
          autoComplete="off"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      <label className="grid gap-1">
        <span className="text-sm text-[var(--muted)]">Что может</span>
        <select
          className="field"
          value={role}
          onChange={(event) => setRole(event.target.value as "viewer" | "editor" | "admin")}
        >
          <option value="viewer">Только смотрит</option>
          <option value="editor">Дописывает древо</option>
          <option value="admin">Хранитель — подтверждает удаления, видит журнал</option>
        </select>
      </label>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? "Сохраняем…" : "Открыть вход"}
      </button>
    </form>
  );
}
