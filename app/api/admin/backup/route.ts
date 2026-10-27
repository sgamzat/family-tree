import fs from "fs";
import os from "os";
import path from "path";
import { accountsDir } from "@/lib/accounts";
import { requireOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}

/**
 * Свежая копия для владельца: ?what=tree — база древа (снимок через
 * VACUUM INTO, безопасно на работающем сервере), ?what=accounts — аккаунты.
 */
export async function GET(request: Request) {
  try {
    await requireOwner();
    const what = new URL(request.url).searchParams.get("what");

    if (what === "accounts") {
      const data = fs.readFileSync(path.join(accountsDir(), "accounts.json"));
      return new Response(data, {
        headers: {
          "Content-Type": "application/json",
          "Content-Disposition": `attachment; filename="accounts-${stamp()}.json"`,
          "Cache-Control": "no-store",
        },
      });
    }

    if (what !== "tree") throw new Error("Укажите, что скачать: tree или accounts");
    const file = path.join(os.tmpdir(), `tree-download-${process.pid}-${Date.now()}.db`);
    try {
      await prisma.$executeRawUnsafe(`VACUUM INTO '${file.replace(/'/g, "''")}'`);
      const data = fs.readFileSync(file);
      return new Response(data, {
        headers: {
          "Content-Type": "application/vnd.sqlite3",
          "Content-Disposition": `attachment; filename="tree-${stamp()}.db"`,
          "Cache-Control": "no-store",
        },
      });
    } finally {
      fs.rmSync(file, { force: true });
    }
  } catch (error) {
    return jsonError(error);
  }
}
