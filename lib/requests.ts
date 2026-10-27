import "server-only";

import { isKeeper, type CurrentUser } from "@/lib/auth";
import { writeChangeLog } from "@/lib/changelog";
import { prisma } from "@/lib/db";
import { mergePeople } from "@/lib/duplicates";
import { HttpError } from "@/lib/http";
import { formatFio, personYears } from "@/lib/names";
import { deletePerson } from "@/lib/people";

/**
 * Разрушающие действия — удаление человека и слияние дублей — ждут
 * подтверждения. Владелец действует сразу; остальные подают заявку, её
 * подтверждает владелец или хранитель, но не автор заявки.
 */

export type RequestKind = "person.delete" | "person.merge";

export type RequestSnapshot = {
  name: string;
  years: string;
  parents: string[];
  spouses: string[];
  children: string[];
  keepName?: string;
};

async function snapshotOf(personId: string, keepId?: string | null): Promise<RequestSnapshot> {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    include: {
      asChild: { include: { parent: true } },
      asParent: { include: { child: true } },
      marriagesA: { include: { personB: true } },
      marriagesB: { include: { personA: true } },
    },
  });
  if (!person) throw new HttpError("Человек не найден", 404);
  const keep = keepId ? await prisma.person.findUnique({ where: { id: keepId } }) : null;
  if (keepId && !keep) throw new HttpError("Карточка, которая остаётся, не найдена", 404);
  return {
    name: formatFio(person) || person.firstName,
    years: personYears(person),
    parents: person.asChild.map((link) => link.parent.firstName),
    spouses: [
      ...person.marriagesA.map((marriage) => marriage.personB.firstName),
      ...person.marriagesB.map((marriage) => marriage.personA.firstName),
    ],
    children: person.asParent.map((link) => link.child.firstName),
    ...(keep ? { keepName: formatFio(keep) || keep.firstName } : {}),
  };
}

export async function createRequest(
  user: CurrentUser,
  input: { kind: RequestKind; personId: string; keepId?: string | null; reason?: string },
) {
  const existing = await prisma.changeRequest.findFirst({
    where: { personId: input.personId, status: "pending" },
  });
  if (existing) throw new HttpError("Заявка по этому человеку уже ждёт подтверждения", 409);

  const snapshot = await snapshotOf(input.personId, input.keepId);
  const request = await prisma.changeRequest.create({
    data: {
      kind: input.kind,
      personId: input.personId,
      keepId: input.keepId ?? null,
      reason: (input.reason ?? "").trim().slice(0, 500),
      snapshot: JSON.stringify(snapshot),
      requestedById: user.id,
      requestedByName: user.name,
    },
  });
  await writeChangeLog(prisma, {
    action: "request.create",
    personId: input.personId,
    actor: user,
    payload: { requestId: request.id, kind: input.kind, keepId: input.keepId, reason: request.reason },
  });
  return request;
}

export async function countPendingRequests(): Promise<number> {
  return prisma.changeRequest.count({ where: { status: "pending" } });
}

export async function listRequests(status: "pending" | "decided") {
  const rows = await prisma.changeRequest.findMany({
    where: status === "pending" ? { status: "pending" } : { status: { not: "pending" } },
    orderBy: status === "pending" ? { createdAt: "asc" } : { decidedAt: "desc" },
    take: status === "pending" ? 200 : 30,
  });
  return rows.map((row) => ({ ...row, snapshotData: JSON.parse(row.snapshot) as RequestSnapshot }));
}

export async function decideRequest(
  user: CurrentUser,
  requestId: string,
  decision: "approve" | "reject",
  note = "",
) {
  if (!isKeeper(user.role)) throw new HttpError("Решает только хранитель", 403);
  const request = await prisma.changeRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new HttpError("Заявка не найдена", 404);
  if (request.status !== "pending") throw new HttpError("Заявка уже решена", 409);
  if (request.requestedById === user.id && user.role !== "owner") {
    throw new HttpError("Свою заявку подтверждает другой хранитель или владелец", 403);
  }

  const decided = {
    decidedById: user.id,
    decidedByName: user.name,
    decidedAt: new Date(),
    decisionNote: note.trim().slice(0, 500),
  };

  if (decision === "reject") {
    await prisma.changeRequest.update({
      where: { id: requestId },
      data: { status: "rejected", ...decided },
    });
    await writeChangeLog(prisma, {
      action: "request.reject",
      personId: request.personId,
      actor: user,
      payload: { requestId, kind: request.kind, note: decided.decisionNote },
    });
    return { status: "rejected" as const };
  }

  try {
    if (request.kind === "person.delete") {
      await deletePerson(request.personId, { requestId, reason: request.reason });
    } else if (request.kind === "person.merge" && request.keepId) {
      await mergePeople(request.keepId, request.personId);
    } else {
      throw new Error("Неизвестный тип заявки");
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось выполнить";
    await prisma.changeRequest.update({
      where: { id: requestId },
      data: { status: "failed", ...decided, decisionNote: message },
    });
    throw new HttpError(`Не удалось выполнить: ${message}`, 409);
  }

  await prisma.changeRequest.update({
    where: { id: requestId },
    data: { status: "approved", ...decided },
  });
  await writeChangeLog(prisma, {
    action: "request.approve",
    personId: request.personId,
    actor: user,
    payload: { requestId, kind: request.kind, keepId: request.keepId },
  });
  return { status: "approved" as const };
}
