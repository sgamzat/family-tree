import "server-only";

import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";

/**
 * Пользователи хранятся отдельно от древа: data/accounts/accounts.json.
 * Древо (data/tree/tree.db) — главное достояние, его бэкапят чаще и
 * восстанавливают независимо; здесь только аккаунты, роли и журнал входов.
 *
 * Жителей десятки, максимум сотни — поэтому это файл, а не отдельная СУБД:
 * запись атомарная (временный файл → rename), процесс один (next start).
 * Формат версии 1 повторяет scripts/split-accounts.mjs.
 */

export type Role = "owner" | "admin" | "editor" | "viewer";

export const ROLE_LABEL: Record<Role, string> = {
  owner: "владелец",
  admin: "хранитель",
  editor: "дописывает",
  viewer: "смотрит",
};

export type Account = {
  id: string;
  name: string;
  login: string;
  passwordHash: string;
  role: Role;
  /** Карточка жителя в древе («Это я»). */
  personId: string | null;
  active: boolean;
  /** Растёт при «выйти на всех устройствах» и смене пароля — старые сессии гаснут. */
  sessionVersion: number;
  createdAt: string;
  createdBy: string | null;
  updatedAt: string;
};

type AccountsFile = { version: 1; users: Account[] };

export type AuthEvent = {
  at: string;
  type:
    | "login.ok"
    | "login.fail"
    | "login.locked"
    | "logout"
    | "logout.all"
    | "account.create"
    | "account.update"
    | "password.reset";
  login?: string;
  userId?: string;
  by?: string;
  ip?: string;
  details?: Record<string, unknown>;
};

export function accountsDir(): string {
  return process.env.ACCOUNTS_DIR || path.join(process.cwd(), "data", "accounts");
}

function accountsFile(): string {
  return path.join(accountsDir(), "accounts.json");
}

function authLogFile(): string {
  return path.join(accountsDir(), "auth-log.jsonl");
}

let cache: { mtimeMs: number; data: AccountsFile } | null = null;

function read(): AccountsFile {
  const file = accountsFile();
  let stat: fs.Stats;
  try {
    stat = fs.statSync(file);
  } catch {
    return { version: 1, users: [] };
  }
  if (cache && cache.mtimeMs === stat.mtimeMs) return cache.data;
  const data = JSON.parse(fs.readFileSync(file, "utf8")) as AccountsFile;
  if (data.version !== 1 || !Array.isArray(data.users)) {
    throw new Error("Неизвестный формат accounts.json");
  }
  cache = { mtimeMs: stat.mtimeMs, data };
  return data;
}

function write(data: AccountsFile) {
  const dir = accountsDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = accountsFile();
  const tmp = `${file}.${process.pid}.${Date.now()}.tmp`;
  const fd = fs.openSync(tmp, "w", 0o600);
  try {
    fs.writeSync(fd, `${JSON.stringify(data, null, 2)}\n`);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
  cache = null;
}

function mutate<T>(change: (data: AccountsFile) => T): T {
  const current = read();
  const data: AccountsFile = { version: 1, users: current.users.map((user) => ({ ...user })) };
  const result = change(data);
  write(data);
  return result;
}

export function normalizeLogin(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/\s+/g, "");
}

export function listAccounts(): Account[] {
  return [...read().users].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function countAccounts(): number {
  return read().users.length;
}

export function findAccount(id: string): Account | null {
  return read().users.find((user) => user.id === id) ?? null;
}

export function findAccountByLogin(login: string): Account | null {
  const key = normalizeLogin(login);
  return read().users.find((user) => user.login === key) ?? null;
}

export function findAccountByPerson(personId: string): Account | null {
  return read().users.find((user) => user.personId === personId) ?? null;
}

export function createAccount(input: {
  name: string;
  login: string;
  passwordHash: string;
  role: Role;
  createdBy: string | null;
}): Account {
  return mutate((data) => {
    const login = normalizeLogin(input.login);
    if (data.users.some((user) => user.login === login)) {
      throw new Error("Такой логин уже есть");
    }
    if (input.role === "owner" && data.users.some((user) => user.role === "owner")) {
      throw new Error("Владелец уже есть — он может быть только один");
    }
    const now = new Date().toISOString();
    const account: Account = {
      id: randomUUID(),
      name: input.name.trim(),
      login,
      passwordHash: input.passwordHash,
      role: input.role,
      personId: null,
      active: true,
      sessionVersion: 1,
      createdAt: now,
      createdBy: input.createdBy,
      updatedAt: now,
    };
    data.users.push(account);
    return account;
  });
}

export function updateAccount(
  id: string,
  patch: Partial<Pick<Account, "name" | "role" | "active" | "personId" | "passwordHash">> & {
    bumpSessions?: boolean;
  },
): Account {
  return mutate((data) => {
    const user = data.users.find((item) => item.id === id);
    if (!user) throw new Error("Пользователь не найден");
    if (patch.role && patch.role !== user.role) {
      if (user.role === "owner") throw new Error("Роль владельца не меняется");
      if (patch.role === "owner") throw new Error("Владелец может быть только один");
    }
    if (patch.active === false && user.role === "owner") {
      throw new Error("Владельца нельзя отключить");
    }
    if (patch.personId) {
      const taken = data.users.find((item) => item.personId === patch.personId && item.id !== id);
      if (taken) throw new Error("Эту карточку уже отметил другой житель");
    }
    if (patch.name !== undefined) user.name = patch.name.trim();
    if (patch.role !== undefined) user.role = patch.role;
    if (patch.active !== undefined) user.active = patch.active;
    if (patch.personId !== undefined) user.personId = patch.personId;
    if (patch.passwordHash !== undefined) user.passwordHash = patch.passwordHash;
    if (patch.bumpSessions || patch.passwordHash !== undefined || patch.active === false) {
      user.sessionVersion += 1;
    }
    user.updatedAt = new Date().toISOString();
    return { ...user };
  });
}

/** Карточку слили с другой: связь аккаунта переходит на оставшуюся. */
export function moveAccountLink(fromPersonId: string, toPersonId: string) {
  const data = read();
  const from = data.users.find((user) => user.personId === fromPersonId);
  if (!from) return;
  const toTaken = data.users.some((user) => user.personId === toPersonId);
  mutate((copy) => {
    const user = copy.users.find((item) => item.id === from.id)!;
    user.personId = toTaken ? null : toPersonId;
    user.updatedAt = new Date().toISOString();
  });
}

/** Карточку удалили: снимаем отметку «Это я». */
export function dropAccountLink(personId: string) {
  if (!findAccountByPerson(personId)) return;
  mutate((data) => {
    for (const user of data.users) {
      if (user.personId === personId) {
        user.personId = null;
        user.updatedAt = new Date().toISOString();
      }
    }
  });
}

export function appendAuthEvent(event: Omit<AuthEvent, "at">) {
  try {
    fs.mkdirSync(accountsDir(), { recursive: true });
    fs.appendFileSync(
      authLogFile(),
      `${JSON.stringify({ at: new Date().toISOString(), ...event })}\n`,
      { mode: 0o600 },
    );
  } catch {
    // Журнал входов не должен ломать вход.
  }
}

export function readAuthEvents(limit = 100): AuthEvent[] {
  try {
    const lines = fs.readFileSync(authLogFile(), "utf8").trim().split("\n").filter(Boolean);
    return lines
      .slice(-limit)
      .reverse()
      .map((line) => JSON.parse(line) as AuthEvent);
  } catch {
    return [];
  }
}
