import "server-only";

import type { Prisma } from "@prisma/client";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

type DbClient = Prisma.TransactionClient | typeof prisma;

export type Actor = { id: string; name: string };

/**
 * Запись в журнал. Автор — тот, кто вошёл (id из data/accounts и имя на момент
 * действия), если его не передали явно.
 */
export async function writeChangeLog(
  db: DbClient,
  entry: {
    action: string;
    personId?: string | null;
    actor?: Actor | null;
    payload?: Record<string, unknown>;
  },
) {
  const actor = entry.actor ?? (await currentUser());
  await db.changeLog.create({
    data: {
      action: entry.action,
      personId: entry.personId ?? null,
      actorId: actor?.id ?? null,
      payload: JSON.stringify({
        actor: actor?.name ?? "anonymous",
        ...(entry.payload ?? {}),
      }),
    },
  });
}
