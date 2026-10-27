"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
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
        body: JSON.stringify({ login, password }),
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
          autoComplete="current-password"
          onChange={(event) => setPassword(event.target.value)}
        />
      </label>
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      <button type="submit" className="btn-primary" disabled={saving}>
        {saving ? "Входим…" : "Войти"}
      </button>
    </form>
  );
}
