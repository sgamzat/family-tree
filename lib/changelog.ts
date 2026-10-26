import "server-only";

import type { Prisma } from "@prisma/client";
import { sessionActor } from "@/lib/auth";
import { prisma } from "@/lib/db";

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function writeChangeLog(
  db: DbClient,
  entry: {
    action: string;
    personId?: string | null;
    actor?: string;
    payload?: Record<string, unknown>;
  },
) {
  const actor = entry.actor ?? (await sessionActor());
  await db.changeLog.create({
    data: {
      action: entry.action,
      personId: entry.personId ?? null,
      payload: JSON.stringify({
        actor,
        ...(entry.payload ?? {}),
      }),
    },
  });
}
