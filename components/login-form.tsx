"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

export function LoginForm({ setup }: { setup: boolean }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [name, setName] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError("");
    try {
      await api("/api/session", {
        method: "POST",
        body: JSON.stringify({ name, login, password }),
      });
      const next = searchParams.get("next");
      router.push(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось войти");
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
      {setup ? (
        <label className="grid gap-1">
          <span className="text-sm text-[var(--muted)]">Как к вам обращаться</span>
          <input
            className="field"
            value={name}
            autoComplete="name"
            onChange={(event) => setName(event.target.value)}
          />
        </label>
      ) : null}
      <label className="grid gap-1">
        <span className="text-sm text-[var(--muted)]">Логин</span>
        <input
          className="field"
          value={login}
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          onChange={(event) => setLogin(event.target.value)}
        />
      </label>
      <label className="grid gap-1">
        <span className="text-sm text-[var(--muted)]">Пароль</span>
        <input
          className="field"
          type="password"
          value={password}
          autoComplete={setup ? "new-password" : "current-password"}
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? "Сохраняем…" : setup ? "Создать вход хранителя" : "Войти"}
      </button>
    </form>
  );
}
