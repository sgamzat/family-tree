#!/usr/bin/env node
// Резервные копии.
//   node scripts/backup.mjs              — одна копия сейчас (древо + аккаунты)
//   node scripts/backup.mjs --tag=pre-start --local — с пометкой, без отправки в облако
//                                         (так делает контейнер перед каждым запуском)
//   node scripts/backup.mjs --loop       — сервис: древо каждые TREE_BACKUP_HOURS (6) ч,
//                                         аккаунты раз в сутки
//
// Древо — главное: снимок через VACUUM INTO (безопасно на работающем сервере),
// проверка PRAGMA integrity_check, хранение 8 последних + 14 дневных + 8 недельных
// + 12 месячных. Аккаунты: 3 последних + 14 дневных.
// В облако (OFFSITE_REMOTE, через rclone) уходят только зашифрованные копии
// (BACKUP_ENCRYPTION_KEY). Без ключа отправка не выполняется.

import { execFile } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { DatabaseSync } from "node:sqlite";
import { accountsDir, backupDir, encrypt, legacyDbPath, log, stamp, treeDbPath } from "./common.mjs";

const run = promisify(execFile);
const args = new Map(
  process.argv.slice(2).map((arg) => {
    const [key, value] = arg.replace(/^--/, "").split("=");
    return [key, value ?? true];
  }),
);
const HOURS = Number(process.env.TREE_BACKUP_HOURS || 6);

const treeDir = path.join(backupDir(), "tree");
const accDir = path.join(backupDir(), "accounts");

function readStatus() {
  try {
    return JSON.parse(fs.readFileSync(path.join(backupDir(), "status.json"), "utf8"));
  } catch {
    return {};
  }
}

function writeStatus(status) {
  fs.mkdirSync(backupDir(), { recursive: true });
  const file = path.join(backupDir(), "status.json");
  fs.writeFileSync(`${file}.tmp`, JSON.stringify(status, null, 2));
  fs.renameSync(`${file}.tmp`, file);
}

/** Имя файла, которого ещё нет: две копии в одну секунду получают -2, -3… */
function freeName(dir, base, ext) {
  for (let n = 1; ; n += 1) {
    const file = path.join(dir, `${base}${n > 1 ? `-${n}` : ""}${ext}`);
    if (!fs.existsSync(file)) return file;
  }
}

/** Снимок базы древа и проверка, что копия целая. */
function backupTree(tag) {
  const source = fs.existsSync(treeDbPath()) ? treeDbPath() : legacyDbPath();
  if (!fs.existsSync(source)) {
    log("Базы древа нет — копировать нечего.");
    return null;
  }
  fs.mkdirSync(treeDir, { recursive: true });
  const file = freeName(treeDir, `tree-${stamp()}${tag ? `-${tag}` : ""}`, ".db");
  const db = new DatabaseSync(source, { readOnly: true });
  try {
    db.exec(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
  } finally {
    db.close();
  }
  const copy = new DatabaseSync(file, { readOnly: true });
  let ok = false;
  let people = 0;
  try {
    ok = Object.values(copy.prepare("PRAGMA integrity_check").get())[0] === "ok";
    people = copy.prepare('SELECT count(*) AS n FROM "Person"').get().n;
  } finally {
    copy.close();
  }
  const bytes = fs.statSync(file).size;
  log(`Древо: ${path.basename(file)} · ${Math.round(bytes / 1024)} КБ · людей ${people} · проверка ${ok ? "ok" : "НЕ ПРОШЛА"}`);
  if (!ok) throw new Error(`Копия ${file} не прошла проверку целостности`);
  return { file, bytes, ok, people };
}

function backupAccounts(tag) {
  const source = path.join(accountsDir(), "accounts.json");
  if (!fs.existsSync(source)) {
    log("accounts.json ещё нет — копировать нечего.");
    return null;
  }
  fs.mkdirSync(accDir, { recursive: true });
  const base = freeName(accDir, `accounts-${stamp()}${tag ? `-${tag}` : ""}`, ".json").replace(/\.json$/, "");
  fs.copyFileSync(source, `${base}.json`);
  fs.chmodSync(`${base}.json`, 0o600);
  const authLog = path.join(accountsDir(), "auth-log.jsonl");
  if (fs.existsSync(authLog)) fs.copyFileSync(authLog, `${base}.auth-log.jsonl`);
  JSON.parse(fs.readFileSync(`${base}.json`, "utf8"));
  const bytes = fs.statSync(`${base}.json`).size;
  log(`Аккаунты: ${path.basename(base)}.json · ${bytes} байт`);
  return { file: `${base}.json`, bytes };
}

/**
 * Оставить: `latest` последних, плюс самую свежую копию за каждый из `daily` дней,
 * `weekly` недель и `monthly` месяцев.
 */
export function selectToKeep(files, { latest, daily = 0, weekly = 0, monthly = 0 }, now = new Date()) {
  const dated = files
    .map((name) => {
      const match = name.match(/(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})/);
      return match ? { name, at: new Date(`${match[1]}T${match[2]}:${match[3]}:${match[4]}Z`) } : null;
    })
    .filter(Boolean)
    .sort((a, b) => b.at - a.at);
  const keep = new Set(dated.slice(0, latest).map((item) => item.name));
  const bucket = (limitDays, keyOf) => {
    const seen = new Set();
    for (const item of dated) {
      if ((now - item.at) / 86_400_000 > limitDays) continue;
      const key = keyOf(item.at);
      if (seen.has(key)) continue;
      seen.add(key);
      keep.add(item.name);
    }
  };
  if (daily) bucket(daily, (d) => d.toISOString().slice(0, 10));
  if (weekly) {
    bucket(weekly * 7, (d) => {
      const monday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - ((d.getUTCDay() + 6) % 7)));
      return monday.toISOString().slice(0, 10);
    });
  }
  if (monthly) bucket(monthly * 31, (d) => d.toISOString().slice(0, 7));
  return keep;
}

function prune(dir, rules, groupOf = (name) => name) {
  if (!fs.existsSync(dir)) return 0;
  const names = fs.readdirSync(dir);
  const groups = [...new Set(names.map(groupOf))];
  const keep = selectToKeep(groups, rules);
  let removed = 0;
  for (const name of names) {
    if (keep.has(groupOf(name))) continue;
    fs.rmSync(path.join(dir, name), { force: true });
    removed += 1;
  }
  return removed;
}

async function sendOffsite(files) {
  const remote = process.env.OFFSITE_REMOTE;
  if (!remote) return null;
  const key = process.env.BACKUP_ENCRYPTION_KEY;
  if (!key || key.length < 16) {
    return { ok: false, error: "не задан BACKUP_ENCRYPTION_KEY (от 16 символов) — без шифрования в облако не отправляем" };
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "ft-offsite-"));
  try {
    for (const { file, folder } of files) {
      const enc = path.join(tmp, `${path.basename(file)}.enc`);
      fs.writeFileSync(enc, encrypt(fs.readFileSync(file), key));
      await run("rclone", ["copyto", enc, `${remote.replace(/\/$/, "")}/${folder}/${path.basename(enc)}`], {
        timeout: 10 * 60 * 1000,
      });
      log(`В облако: ${folder}/${path.basename(enc)}`);
    }
    return { ok: true, at: new Date().toISOString() };
  } catch (error) {
    const message = String(error.stderr || error.message || error).trim().split("\n").slice(-1)[0];
    log(`Облако: ошибка — ${message}`);
    return { ok: false, error: message };
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

export async function backupOnce({ tag = "", withAccounts = true, localOnly = false } = {}) {
  const status = readStatus();
  const tree = backupTree(tag);
  const accounts = withAccounts ? backupAccounts(tag) : null;
  const removed =
    prune(treeDir, { latest: 8, daily: 14, weekly: 8, monthly: 12 }) +
    prune(accDir, { latest: 3, daily: 14 }, (name) => name.replace(/\.auth-log\.jsonl$|\.json$/, ""));
  if (removed) log(`Удалено старых копий: ${removed}`);

  const toSend = [
    ...(tree ? [{ file: tree.file, folder: "tree" }] : []),
    ...(accounts ? [{ file: accounts.file, folder: "accounts" }] : []),
  ];
  const offsite = toSend.length && !localOnly ? await sendOffsite(toSend) : null;

  writeStatus({
    ...status,
    at: new Date().toISOString(),
    ...(tree ? { tree: { file: path.basename(tree.file), bytes: tree.bytes, ok: tree.ok, people: tree.people } } : {}),
    ...(accounts ? { accounts: { file: path.basename(accounts.file), bytes: accounts.bytes, at: new Date().toISOString() } } : {}),
    ...(offsite ? { offsite } : {}),
  });
  return { tree, accounts, offsite };
}

async function loop() {
  log(`Сервис резервных копий: древо каждые ${HOURS} ч, аккаунты раз в сутки.`);
  for (;;) {
    const status = readStatus();
    const lastAccounts = status.accounts?.at ? new Date(status.accounts.at) : null;
    const dueAccounts = !lastAccounts || Date.now() - lastAccounts.getTime() > 23 * 3_600_000;
    try {
      await backupOnce({ withAccounts: dueAccounts });
    } catch (error) {
      log(`ОШИБКА резервной копии: ${error.message}`);
      writeStatus({ ...readStatus(), error: { at: new Date().toISOString(), message: error.message } });
    }
    await new Promise((resolve) => setTimeout(resolve, HOURS * 3_600_000));
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (isMain) {
  if (args.get("loop")) {
    await loop();
  } else {
    try {
      const result = await backupOnce({
        tag: typeof args.get("tag") === "string" ? args.get("tag") : "",
        localOnly: Boolean(args.get("local")),
      });
      if (result.offsite && !result.offsite.ok) process.exitCode = 2;
    } catch (error) {
      log(`ОШИБКА: ${error.message}`);
      process.exit(1);
    }
  }
}
