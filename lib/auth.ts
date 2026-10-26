import "server-only";

import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { prisma } from "@/lib/db";
import { HttpError } from "@/lib/http";

export type UserRole = "admin" | "editor";

export type SessionUser = {
  id: string;
  name: string;
  login: string;
  role: UserRole;
};

const COOKIE = "ft_session";
const MONTH = 60 * 60 * 24 * 30;

type SessionPayload = SessionUser & { exp: number };

function secret() {
  return process.env.AUTH_SECRET || "family-tree-dev-secret";
}

export function normalizeLogin(value: unknown) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("ё", "е")
    .replace(/\s+/g, "");
}

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const actual = scryptSync(password, salt, 32);
  const expected = Buffer.from(hash, "hex");
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function sign(body: string) {
  return createHmac("sha256", secret()).update(body).digest("base64url");
}

export function sealSession(user: SessionUser) {
  const payload: SessionPayload = {
    ...user,
    exp: Date.now() + MONTH * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${sign(body)}`;
}

export function readSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [body, mac] = token.split(".");
  if (!body || !mac) return null;
  const expected = sign(body);
  const left = Buffer.from(mac);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !timingSafeEqual(left, right)) return null;
  try {
    const payload = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (!payload.exp || payload.exp < Date.now()) return null;
    if (payload.role !== "admin" && payload.role !== "editor") return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseRole(value: unknown): UserRole {
  return value === "admin" ? "admin" : "editor";
}

export async function currentUser(): Promise<SessionUser | null> {
  const jar = await cookies();
  const session = readSession(jar.get(COOKIE)?.value);
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.id } });
  if (!user) return null;
  if (user.role !== "admin" && user.role !== "editor") return null;
  return {
    id: user.id,
    name: user.name,
    login: user.login,
    role: user.role,
  };
}

export async function sessionActor() {
  const jar = await cookies();
  return readSession(jar.get(COOKIE)?.value)?.name ?? "anonymous";
}

export async function setSessionCookie(user: SessionUser) {
  const jar = await cookies();
  jar.set(COOKIE, sealSession(user), {
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

export async function requireWriter() {
  const user = await currentUser();
  if (!user) {
    throw new HttpError("Войдите, чтобы дописать древо", 401);
  }
  return user;
}

export async function requireKeeper() {
  const user = await requireWriter();
  if (user.role !== "admin") {
    throw new HttpError("Это может сделать только хранитель", 403);
  }
  return user;
}

export function assertAccount(input: {
  name: string;
  login: string;
  password: string;
}) {
  if (!input.name) throw new Error("Укажите, как к вам обращаться");
  if (input.login.length < 3) throw new Error("Логин не короче 3 символов");
  if (input.password.length < 6) throw new Error("Пароль не короче 6 символов");
}
