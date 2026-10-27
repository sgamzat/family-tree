#!/usr/bin/env node
// Создать владельца древа (один раз, на сервере):
//   docker compose exec web node scripts/create-owner.mjs
// Имя, логин и пароль спрашиваются; можно передать через OWNER_NAME, OWNER_LOGIN, OWNER_PASSWORD.

import readline from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { hashPassword, log, newAccount, normalizeLogin, readAccounts, writeAccounts } from "./common.mjs";

const data = readAccounts() ?? { version: 1, users: [] };
if (data.users.some((user) => user.role === "owner")) {
  console.error("Владелец уже есть. Новых жителей заводите на странице «Жители и доступ».");
  process.exit(1);
}

const rl = readline.createInterface({ input: stdin, output: stdout });
const ask = async (env, question) => process.env[env] || (await rl.question(question)).trim();
const name = await ask("OWNER_NAME", "Как к вам обращаться: ");
const login = normalizeLogin(await ask("OWNER_LOGIN", "Логин: "));
const password = await ask("OWNER_PASSWORD", "Пароль (от 8 символов): ");
rl.close();

if (!name || login.length < 3 || password.length < 8) {
  console.error("Нужно имя, логин от 3 символов и пароль от 8 символов.");
  process.exit(1);
}
if (data.users.some((user) => user.login === login)) {
  console.error("Такой логин уже есть.");
  process.exit(1);
}

data.users.push(newAccount({ name, login, passwordHash: hashPassword(password), role: "owner" }));
writeAccounts(data);
log(`Владелец создан: ${name} (${login}). Теперь можно войти на сайт.`);
