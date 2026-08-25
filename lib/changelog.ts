import "server-only";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function writeChangeLog(
  db: DbClient,
  entry: {
    action: string;
    personId?: string | null;
    payload?: Record<string, unknown>;
  },
) {
  await db.changeLog.create({
    data: {
      action: entry.action,
      personId: entry.personId ?? null,
      payload: JSON.stringify({
        actor: "anonymous",
        ...(entry.payload ?? {}),
      }),
    },
  });
}
