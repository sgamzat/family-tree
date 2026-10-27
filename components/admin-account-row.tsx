"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { api } from "@/lib/api";

type Row = {
  id: string;
  name: string;
  login: string;
  role: "owner" | "admin" | "editor" | "viewer";
  active: boolean;
  personName: string | null;
  createdAt: string;
};

const ROLES = [
  { value: "viewer", label: "Только смотрит" },
  { value: "editor", label: "Дописывает" },
  { value: "admin", label: "Хранитель" },
] as const;

/** Строка жителя для владельца: роль, включён ли, новый пароль. */
export function AdminAccountRow({ account }: { account: Row }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [password, setPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [done, setDone] = useState("");

  async function patch(body: Record<string, unknown>, ok: string) {
    setBusy(true);
    setError("");
    setDone("");
    try {
      await api(`/api/admin/users/${account.id}`, { method: "PATCH", body: JSON.stringify(body) });
      setDone(ok);
      setPassword("");
      setResetting(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setBusy(false);
    }
  }

  const owner = account.role === "owner";

  return (
    <li className={`admin-card ${account.active ? "" : "is-done"}`}>
      <div>
        <p className="font-semibold">
          {account.name}{" "}
          {owner ? <span className="admin-tag is-ok">владелец</span> : null}
          {!account.active ? <span className="admin-tag is-danger">вход закрыт</span> : null}
        </p>
        <p className="admin-meta">
          логин {account.login}
          {account.personName ? ` · в древе: ${account.personName}` : " · своя карточка не отмечена"}
        </p>
      </div>
      {owner ? null : (
        <div className="admin-actions">
          <select
            className="field"
            style={{ width: "auto" }}
            aria-label={`Роль: ${account.name}`}
            value={account.role}
            disabled={busy}
            onChange={(event) => void patch({ role: event.target.value }, "Роль изменена")}
          >
            {ROLES.map((role) => (
              <option key={role.value} value={role.value}>
                {role.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy}
            onClick={() =>
              void patch(
                { active: !account.active },
                account.active ? "Вход закрыт, все сессии завершены" : "Вход открыт",
              )
            }
          >
            {account.active ? "Закрыть вход" : "Открыть вход"}
          </button>
          {resetting ? null : (
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => setResetting(true)}>
              Новый пароль
            </button>
          )}
        </div>
      )}
      {resetting ? (
        <div className="admin-actions">
          <input
            className="field"
            style={{ flex: "1 1 12rem", width: "auto" }}
            type="text"
            autoComplete="off"
            placeholder="новый пароль, от 8 символов"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
          <button
            type="button"
            className="btn-secondary"
            disabled={busy || password.length < 8}
            onClick={() => void patch({ password }, "Пароль сменён, старые сессии завершены")}
          >
            Сохранить
          </button>
          <button type="button" className="quiet-link" onClick={() => setResetting(false)}>
            Отмена
          </button>
        </div>
      ) : null}
      {error ? <p className="text-sm text-[var(--danger)]">{error}</p> : null}
      {done ? <p className="text-sm text-[var(--accent)]">{done}</p> : null}
    </li>
  );
}
