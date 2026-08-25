import "server-only";

import type { Clan } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { KinGraph } from "@/lib/graph";
import {
  normalizeName,
  type ClanDTO,
  type ClanResolution,
} from "@/lib/names";
import { paternalLineIds } from "@/lib/tree";

export function toClanDto(clan: Clan): ClanDTO {
  return {
    id: clan.id,
    name: clan.name,
    founderId: clan.founderId,
    parentClanId: clan.parentClanId,
  };
}

export function computeClanFromGraph(
  graph: KinGraph,
  clans: ClanDTO[],
  personId: string,
): ClanDTO | null {
  const byFounder = new Map<string, ClanDTO>();
  for (const clan of clans) {
    if (clan.founderId && !byFounder.has(clan.founderId)) {
      byFounder.set(clan.founderId, clan);
    }
  }
  for (const ancestorId of paternalLineIds(graph, personId)) {
    const clan = byFounder.get(ancestorId);
    if (clan) return clan;
  }
  return null;
}

export function resolveClan(
  claimed: ClanDTO | null,
  computed: ClanDTO | null,
): ClanResolution {
  return {
    claimed,
    computed,
    mismatch: Boolean(claimed && computed && claimed.id !== computed.id),
  };
}

export async function listClans(): Promise<ClanDTO[]> {
  const clans = await prisma.clan.findMany({
    orderBy: { name: "asc" },
  });
  return clans.map(toClanDto);
}

export async function createClan(input: {
  name: string;
  founderId?: string | null;
  parentClanId?: string | null;
}): Promise<ClanDTO> {
  const name = input.name.trim();
  if (!name) throw new Error("Укажите название рода");
  const nameNorm = normalizeName(name);

  const existing = await prisma.clan.findFirst({ where: { nameNorm } });
  if (existing) {
    if (input.founderId && !existing.founderId) {
      const founder = await prisma.person.findUnique({
        where: { id: input.founderId },
      });
      if (!founder) throw new Error("Родоначальник не найден");
      const updated = await prisma.clan.update({
        where: { id: existing.id },
        data: { founderId: input.founderId },
      });
      return toClanDto(updated);
    }
    return toClanDto(existing);
  }

  if (input.founderId) {
    const founder = await prisma.person.findUnique({
      where: { id: input.founderId },
    });
    if (!founder) throw new Error("Родоначальник не найден");
  }
  if (input.parentClanId) {
    const parent = await prisma.clan.findUnique({
      where: { id: input.parentClanId },
    });
    if (!parent) throw new Error("Родительский род не найден");
  }

  const clan = await prisma.clan.create({
    data: {
      name,
      nameNorm,
      founderId: input.founderId ?? null,
      parentClanId: input.parentClanId ?? null,
    },
  });
  return toClanDto(clan);
}

export async function listClansFoundedBy(personId: string): Promise<ClanDTO[]> {
  const clans = await prisma.clan.findMany({
    where: { founderId: personId },
    orderBy: { name: "asc" },
  });
  return clans.map(toClanDto);
}

export async function resolvePersonClan(
  personId: string,
  claimedClanId: string | null,
): Promise<ClanResolution> {
  const [clans, parentLinks] = await Promise.all([
    prisma.clan.findMany(),
    prisma.parentChild.findMany({
      select: {
        childId: true,
        parent: { select: { id: true, gender: true } },
      },
    }),
  ]);
  const dtos = clans.map(toClanDto);
  const claimed = dtos.find((clan) => clan.id === claimedClanId) ?? null;

  const fatherOf = new Map<string, string>();
  for (const link of parentLinks) {
    if (link.parent.gender === "male") {
      fatherOf.set(link.childId, link.parent.id);
    }
  }

  const byFounder = new Map<string, ClanDTO>();
  for (const clan of dtos) {
    if (clan.founderId && !byFounder.has(clan.founderId)) {
      byFounder.set(clan.founderId, clan);
    }
  }

  const line: string[] = [];
  let currentId: string | null = personId;
  const seen = new Set<string>();
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    line.push(currentId);
    currentId = fatherOf.get(currentId) ?? null;
  }

  const computed =
    line
      .map((ancestorId) => byFounder.get(ancestorId) ?? null)
      .find((clan) => clan !== null) ?? null;

  return resolveClan(claimed, computed);
}
