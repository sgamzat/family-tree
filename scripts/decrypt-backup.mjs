#!/usr/bin/env node
// Расшифровать копию, скачанную из облака:
//   BACKUP_ENCRYPTION_KEY=... node scripts/decrypt-backup.mjs tree-2026-10-27T12-00-00.db.enc
// Рядом появится расшифрованный файл без .enc.

import fs from "node:fs";
import { decrypt, log } from "./common.mjs";

const input = process.argv[2];
const key = process.env.BACKUP_ENCRYPTION_KEY;
if (!input || !key) {
  console.error("Нужно: BACKUP_ENCRYPTION_KEY=<ключ> node scripts/decrypt-backup.mjs <файл.enc> [куда]");
  process.exit(1);
}
const output = process.argv[3] || input.replace(/\.enc$/, "") || `${input}.out`;
let data;
try {
  data = decrypt(fs.readFileSync(input), key);
} catch (error) {
  console.error(
    error.message.includes("не зашифрованная")
      ? error.message
      : "Не расшифровалось: неверный ключ или файл повреждён.",
  );
  process.exit(1);
}
fs.writeFileSync(output, data, { mode: 0o600 });
log(`Расшифровано: ${output}`);
