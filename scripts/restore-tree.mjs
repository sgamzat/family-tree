#!/usr/bin/env node
// Восстановить базу древа из копии. Сайт на это время должен быть остановлен:
//   docker compose stop web
//   docker compose run --rm --no-deps web node scripts/restore-tree.mjs /backups/tree/tree-....db
//   docker compose start web
// Текущая база не удаляется — она сохраняется рядом как tree.db.replaced-<дата>.

import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { log, stamp, treeDbPath } from "./common.mjs";

const source = process.argv[2];
if (!source || !fs.existsSync(source)) {
  console.error("Укажите файл копии: node scripts/restore-tree.mjs <копия.db>");
  process.exit(1);
}

const check = new DatabaseSync(source, { readOnly: true });
const ok = Object.values(check.prepare("PRAGMA integrity_check").get())[0] === "ok";
const people = ok ? check.prepare('SELECT count(*) AS n FROM "Person"').get().n : 0;
check.close();
if (!ok) {
  console.error("Копия повреждена (integrity_check) — восстанавливать из неё нельзя.");
  process.exit(1);
}

const target = treeDbPath();
if (fs.existsSync(target)) {
  const kept = `${target}.replaced-${stamp()}`;
  const current = new DatabaseSync(target);
  current.exec(`VACUUM INTO '${kept.replace(/'/g, "''")}'`);
  current.close();
  log(`Текущая база сохранена: ${kept}`);
  for (const suffix of ["", "-wal", "-shm"]) fs.rmSync(target + suffix, { force: true });
}
fs.copyFileSync(source, target);
const db = new DatabaseSync(target);
db.prepare("PRAGMA journal_mode = WAL").get();
db.close();
log(`Восстановлено из ${source}: людей ${people}. Запустите сайт: docker compose start web`);
