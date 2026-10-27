import "server-only";

import { createHmac, randomBytes, scrypt, timingSafeEqual } from "crypto";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  appendAuthEvent,
  findAccount,
  findAccountByLogin,
  normalizeLogin,
  type Account,
  type Role,
} from "@/lib/accounts";
import { HttpError } from "@/lib/http";

export { normalizeLogin };
export type { Role };

/**
 * Права:
 * - viewer (смотрит) — только читает древо;
 * - editor (дописывает) — добавляет и правит людей и связи, предлагает удаление;
 * - admin (хранитель) — плюс отвязка связей, журнал, подтверждение заявок;
 * - owner (владелец, один) — плюс аккаунты, роли и резервные копии.
 * Без входа не видно ничего, кроме страницы входа.
 */

export type CurrentUser = {
  id: string;
  name: string;
  login: string;
  role: Role;
  personId: string | null;
};

const COOKIE = "ft_session";
const MONTH = 60 * 60 * 24 * 30;
const DEV_SECRET = "family-tree-dev-secret-only-for-npm-run-dev";

type SessionPayload = { id: string; sv: number; exp: number };

function secret(): string {
  const value = process.env.AUTH_SECRET;
  if (value && value.length >= 16) return value;
  if (process.env.NODE_ENV === "production") {
    throw new Error("AUTH_SECRET не задан: без него сервис не запускается");
  }
  return DEV_SECRET;
}

export function isKeeper(role: Role | undefined | null): boolean {
  return role === "admin" || role === "owner";
}

export function canEdit(role: Role | undefined | null): boolean {
  return role === "editor" || isKeeper(role);
}

// --- Пароли --------------------------------------------------------------

function scryptAsync(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 32, (error, key) => (error ? reject(error) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const hash = await scryptAsync(password, salt);
  return `${salt}:${hash.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = await scryptAsync(password, salt);
  const expected = Buffer.from(hash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

export function assertAccount(input: { name: string; login: string; password: string }) {
  if (!input.name) throw new Error("Укажите, как к человеку обращаться");
  if (input.login.length < 3) throw new Error("Логин не короче 3 символов");
  assertPassword(input.password);
}

export function assertPassword(password: string) {
  if (password.length < 8) throw new Error("Пароль не короче 8 символов");
}

export function parseRole(value: unknown): Role {
  if (value === "admin" || value === "editor" || value === "viewer") return value;
  throw new Error("Неизвестная роль");
}

// --- Защита от подбора пароля ----------------------------------------------

const MAX_FAILS = 5;
const LOCK_MS = 15 * 60 * 1000;
const fails = new Map<string, { count: number; until: number }>();

async function clientIp(): Promise<string> {
  const list = await headers();
  return (
    list.get("x-forwarded-for")?.split(",")[0]?.trim() || list.get("x-real-ip") || "unknown"
  );
}

/** Вход по логину и паролю. Пять неудач подряд — пауза 15 минут для этого логина. */
export async function signIn(loginRaw: unknown, password: string): Promise<CurrentUser> {
  const login = normalizeLogin(loginRaw);
  const ip = await clientIp();
  const key = login || ip;
  const state = fails.get(key);
  if (state && state.until > Date.now()) {
    appendAuthEvent({ type: "login.locked", login, ip });
    const minutes = Math.ceil((state.until - Date.now()) / 60000);
    throw new HttpError(`Слишком много попыток. Попробуйте через ${minutes} мин.`, 429);
  }

  const account = findAccountByLogin(login);
  const ok = account?.active ? await verifyPassword(password, account.passwordHash) : false;
  if (!account || !ok) {
    const count = (state && state.until <= Date.now() ? 0 : (state?.count ?? 0)) + 1;
    fails.set(key, { count, until: count >= MAX_FAILS ? Date.now() + LOCK_MS : 0 });
    appendAuthEvent({ type: "login.fail", login, ip });
    throw new HttpError("Неверный логин или пароль", 401);
  }

  fails.delete(key);
  appendAuthEvent({ type: "login.ok", login, userId: account.id, ip });
  await setSessionCookie(account);
  return toCurrent(account);
}

// --- Сессия -------------------------------------------------------------

function sign(body: string) {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

function sealSession(account: Account) {
  const payload: SessionPayload = {
    id: account.id,
    sv: account.sessionVersion,
    exp: Date.now() + MONTH * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

function readSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const left = Buffer.from(mac);
  const right = Buffer.from(sign(body));
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload.id || !payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

async function setSessionCookie(account: Account) {
  const jar = await cookies();
  jar.set(COOKIE, sealSession(account), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: MONTH,
    secure: process.env.AUTH_COOKIE_SECURE === "true",
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(COOKIE);
}

function toCurrent(account: Account): CurrentUser {
  return {
    id: account.id,
    name: account.name,
    login: account.login,
    role: account.role,
    personId: account.personId,
  };
}

/** Кто вошёл. Отключённый аккаунт и устаревшая сессия — как не вошёл. */
export async function currentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const session = readSession(jar.get(COOKIE)?.value);
  if (!session) return null;
  const account = findAccount(session.id);
  if (!account || !account.active || account.sessionVersion !== session.sv) return null;
  return toCurrent(account);
}

// --- Проверки для API ----------------------------------------------------

export async function requireViewer(): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) throw new HttpError("Войдите, чтобы увидеть древо", 401);
  return user;
}

export async function requireEditor(): Promise<CurrentUser> {
  const user = await requireViewer();
  if (!canEdit(user.role)) throw new HttpError("У вас доступ только для просмотра", 403);
  return user;
}

/** Совместимость: «дописывать» могут editor, admin и owner. */
export const requireWriter = requireEditor;

export async function requireKeeper(): Promise<CurrentUser> {
  const user = await requireViewer();
  if (!isKeeper(user.role)) throw new HttpError("Это может сделать только хранитель", 403);
  return user;
}

export async function requireOwner(): Promise<CurrentUser> {
  const user = await requireViewer();
  if (user.role !== "owner") throw new HttpError("Это может сделать только владелец", 403);
  return user;
}

// --- Проверки для страниц -------------------------------------------------

/** Страница только для вошедших: иначе — на вход и обратно. */
export async function pageUser(nextPath: string): Promise<CurrentUser> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(nextPath)}`);
  return user;
}

export async function pageKeeper(nextPath: string): Promise<CurrentUser> {
  const user = await pageUser(nextPath);
  if (!isKeeper(user.role)) redirect("/");
  return user;
}

export async function pageOwner(nextPath: string): Promise<CurrentUser> {
  const user = await pageUser(nextPath);
  if (user.role !== "owner") redirect("/");
  return user;
}
