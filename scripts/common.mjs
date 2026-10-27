// Общее для служебных скриптов (Node 22+, встроенный node:sqlite, без Prisma).
// Скрипты запускаются на сервере: docker compose exec web node scripts/<имя>.mjs

import { createCipheriv, createDecipheriv, randomBytes, randomUUID, scryptSync } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();

/** Путь к базе древа из DATABASE_URL ("file:/data/tree/tree.db" или относительно папки prisma). */
export function treeDbPath() {
  if (process.env.TREE_DB) return path.resolve(process.env.TREE_DB);
  const url = process.env.DATABASE_URL || "file:../data/tree/tree.db";
  const raw = url.replace(/^file:/, "").split("?")[0];
  return path.isAbsolute(raw) ? raw : path.resolve(cwd, "prisma", raw);
}

/** Старая общая база (до разделения): data/family-tree.db рядом с папкой tree. */
export function legacyDbPath() {
  if (process.env.LEGACY_DB) return path.resolve(process.env.LEGACY_DB);
  return path.join(path.dirname(path.dirname(treeDbPath())), "family-tree.db");
}

export function accountsDir() {
  return path.resolve(process.env.ACCOUNTS_DIR || path.join(cwd, "data", "accounts"));
}

export function backupDir() {
  return path.resolve(process.env.BACKUP_DIR || path.join(cwd, "backups"));
}

export function stamp(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

export function log(...parts) {
  console.log(`[${new Date().toISOString()}]`, ...parts);
}

// --- Аккаунты (формат версии 1 — как в lib/accounts.ts) ------------------------

export function accountsFile() {
  return path.join(accountsDir(), "accounts.json");
}

export function readAccounts() {
  try {
    const data = JSON.parse(fs.readFileSync(accountsFile(), "utf8"));
    if (data.version !== 1 || !Array.isArray(data.users)) throw new Error("Неизвестный формат accounts.json");
    return data;
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

export function writeAccounts(data) {
  fs.mkdirSync(accountsDir(), { recursive: true });
  const file = accountsFile();
  const tmp = `${file}.${process.pid}.tmp`;
  const fd = fs.openSync(tmp, "w", 0o600);
  try {
    fs.writeSync(fd, `${JSON.stringify(data, null, 2)}\n`);
    fs.fsyncSync(fd);
  } finally {
    fs.closeSync(fd);
  }
  fs.renameSync(tmp, file);
}

export function newAccount({ name, login, passwordHash, role, personId = null, createdAt, createdBy = null }) {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    name: String(name).trim(),
    login: normalizeLogin(login),
    passwordHash,
    role,
    personId,
    active: true,
    sessionVersion: 1,
    createdAt: createdAt ?? now,
    createdBy,
    updatedAt: now,
  };
}

export function normalizeLogin(value) {
  return String(value ?? "").trim().toLowerCase().replaceAll("ё", "е").replace(/\s+/g, "");
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 32).toString("hex")}`;
}

// --- Шифрование копий для облака ------------------------------------------------
// Формат: "FTB1" | соль 16 | iv 12 | тег 16 | шифртекст (AES-256-GCM, ключ — scrypt от пароля).

const MAGIC = Buffer.from("FTB1");

export function encrypt(data, passphrase) {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = scryptSync(passphrase, salt, 32);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const body = Buffer.concat([cipher.update(data), cipher.final()]);
  return Buffer.concat([MAGIC, salt, iv, cipher.getAuthTag(), body]);
}

export function decrypt(data, passphrase) {
  if (!data.subarray(0, 4).equals(MAGIC)) throw new Error("Это не зашифрованная копия древа");
  const salt = data.subarray(4, 20);
  const iv = data.subarray(20, 32);
  const tag = data.subarray(32, 48);
  const key = scryptSync(passphrase, salt, 32);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data.subarray(48)), decipher.final()]);
}
