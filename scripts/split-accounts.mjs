#!/usr/bin/env node
// Разделение баз (выполняется при каждом запуске, повторный запуск ничего не ломает):
// 1) старая общая база data/family-tree.db → копия data/tree/tree.db (оригинал сохраняется
//    под именем family-tree.db.before-split-<дата>);
// 2) пользователи из таблицы User → data/accounts/accounts.json; самый ранний хранитель
//    становится владельцем;
// 3) таблица User удаляется из базы древа — в ней остаются только люди, связи и журнал;
// 4) база древа переводится в режим WAL (надёжнее при одновременном чтении и бэкапе).

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { accountsFile, legacyDbPath, log, newAccount, readAccounts, stamp, treeDbPath, writeAccounts } from "./common.mjs";

const tree = treeDbPath();
const legacy = legacyDbPath();
fs.mkdirSync(path.dirname(tree), { recursive: true });

if (!fs.existsSync(tree) && fs.existsSync(legacy)) {
  log(`Переношу старую базу ${legacy} → ${tree}`);
  const source = new DatabaseSync(legacy);
  source.exec(`VACUUM INTO '${tree.replace(/'/g, "''")}'`);
  source.close();
  const kept = `${legacy}.before-split-${stamp()}`;
  fs.renameSync(legacy, kept);
  for (const suffix of ["-wal", "-shm", "-journal"]) {
    if (fs.existsSync(legacy + suffix)) fs.renameSync(legacy + suffix, kept + suffix);
  }
  log(`Старая база сохранена как ${kept}`);
}

if (!fs.existsSync(tree)) {
  log("Базы древа ещё нет — её создаст prisma db push.");
  process.exit(0);
}

const db = new DatabaseSync(tree);
const hasUsers = db
  .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'User'")
  .get();

if (hasUsers) {
  const rows = db.prepare('SELECT * FROM "User" ORDER BY "createdAt" ASC').all();
  const existing = readAccounts();
  if (existing) {
    log(`accounts.json уже есть (${existing.users.length} аккаунтов) — повторно не переношу.`);
  } else {
    const ownerRow = rows.find((row) => row.role === "admin") ?? rows[0];
    const users = rows.map((row) =>
      newAccount({
        name: row.name,
        login: row.login,
        passwordHash: row.passwordHash,
        role: row === ownerRow ? "owner" : row.role === "admin" ? "admin" : "editor",
        personId: row.personId ?? null,
        createdAt: new Date(Number(row.createdAt) || row.createdAt).toISOString(),
      }),
    );
    writeAccounts({ version: 1, users });
    log(`Перенесено аккаунтов: ${users.length} → ${accountsFile()}`);
    if (ownerRow) log(`Владелец: ${ownerRow.name} (${ownerRow.login})`);
  }
  // Проверяем, что файл читается, и только потом убираем таблицу из базы древа.
  const check = readAccounts();
  if (!check || check.users.length < Math.min(rows.length, 1)) {
    throw new Error("accounts.json не прочитался — таблицу User не трогаю");
  }
  db.exec('DROP TABLE "User"');
  log("Таблица User убрана из базы древа.");
}

const mode = db.prepare("PRAGMA journal_mode = WAL").get();
db.close();
log(`База древа готова: ${tree} (журнал: ${Object.values(mode)[0]})`);
