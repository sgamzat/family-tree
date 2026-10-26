import type { IndexedGraph } from "@/lib/graph";
import type { ClanDTO, PersonDTO } from "@/lib/names";

/**
 * Перепись 1886 года — верхний конец древа, живущие — нижний.
 * Здесь всё, что нужно, чтобы показать, соединились ли они.
 * Чистые функции без базы: работают и на сервере, и в браузере.
 */

const MAX_AGE = 100;

/** Живой ли человек. Если признак не указан — считаем живым того, кто родился меньше 100 лет назад и о чьей смерти ничего не известно. */
export function isPresumedLiving(
  person: PersonDTO,
  nowYear = new Date().getFullYear(),
): boolean {
  if (person.isLiving !== null) return person.isLiving;
  if (person.inCensus1886) return false;
  if (person.deathYear || person.deathDateText.trim()) return false;
  return person.birthYear !== null && nowYear - person.birthYear < MAX_AGE;
}

function fatherFirst(graph: IndexedGraph, ids: string[]): string[] {
  return [...ids].sort((a, b) => {
    const left = graph.byId.get(a)?.gender === "male" ? 0 : 1;
    const right = graph.byId.get(b)?.gender === "male" ? 0 : 1;
    return left - right;
  });
}

export type CensusStep = { person: PersonDTO; up: number };

/**
 * Кратчайший путь вверх по родителям до ближайшего человека из переписи.
 * Первый шаг — сам человек, последний — предок из переписи. При равной длине
 * предпочитается отцовская линия. null — линия до переписи пока не дошла.
 */
export function censusPathUp(
  graph: IndexedGraph,
  personId: string,
): CensusStep[] | null {
  const start = graph.byId.get(personId);
  if (!start) return null;
  const prev = new Map<string, string | null>([[personId, null]]);
  const queue = [personId];
  for (let i = 0; i < queue.length; i += 1) {
    const id = queue[i];
    const person = graph.byId.get(id);
    if (person?.inCensus1886) {
      const ids: string[] = [];
      let cursor: string | null = id;
      while (cursor) {
        ids.push(cursor);
        cursor = prev.get(cursor) ?? null;
      }
      return ids
        .reverse()
        .map((stepId, up) => ({ person: graph.byId.get(stepId)!, up }));
    }
    for (const parentId of fatherFirst(graph, graph.parentsOf.get(id) ?? [])) {
      if (prev.has(parentId) || !graph.byId.has(parentId)) continue;
      prev.set(parentId, id);
      queue.push(parentId);
    }
  }
  return null;
}

/** Сколько живущих среди потомков человека (сам человек не считается). */
export function livingDescendantCount(
  graph: IndexedGraph,
  personId: string,
): number {
  const seen = new Set<string>([personId]);
  const queue = [personId];
  let living = 0;
  for (let i = 0; i < queue.length; i += 1) {
    for (const childId of graph.childrenOf.get(queue[i]) ?? []) {
      if (seen.has(childId)) continue;
      seen.add(childId);
      queue.push(childId);
      const child = graph.byId.get(childId);
      if (child && isPresumedLiving(child)) living += 1;
    }
  }
  return living;
}

export type CensusProgress = {
  total: number;
  linked: number;
  linkedIds: Set<string>;
};

/** Сколько людей переписи уже связаны с живущими через своих потомков. */
export function censusProgress(graph: IndexedGraph): CensusProgress {
  const hasLivingDescendant = new Set<string>();
  const queue: string[] = [];
  for (const person of graph.byId.values()) {
    if (isPresumedLiving(person)) queue.push(person.id);
  }
  for (let i = 0; i < queue.length; i += 1) {
    for (const parentId of graph.parentsOf.get(queue[i]) ?? []) {
      if (hasLivingDescendant.has(parentId)) continue;
      hasLivingDescendant.add(parentId);
      queue.push(parentId);
    }
  }

  let total = 0;
  const linkedIds = new Set<string>();
  for (const person of graph.byId.values()) {
    if (!person.inCensus1886) continue;
    total += 1;
    if (hasLivingDescendant.has(person.id)) linkedIds.add(person.id);
  }
  return { total, linked: linkedIds.size, linkedIds };
}

/** Как назвать предка, стоящего на `up` поколений выше. */
export function generationWord(up: number, gender: PersonDTO["gender"]): string {
  const male = gender === "male";
  if (up === 0) return male ? "он сам" : "она сама";
  if (up === 1) return male ? "отец" : "мать";
  if (up === 2) return male ? "дед" : "бабушка";
  if (up === 3) return male ? "прадед" : "прабабушка";
  if (up === 4) return male ? "прапрадед" : "прапрабабушка";
  return `предок, ${up}-е поколение`;
}

export type ClanCount = { clan: ClanDTO; count: number };

/** Сколько людей в каждом тухуме — по отцовской линии до родоначальника, как и вычисляется род. */
export function clanCounts(graph: IndexedGraph, clans: ClanDTO[]): ClanCount[] {
  const byFounder = new Map<string, ClanDTO>();
  for (const clan of clans) {
    if (clan.founderId && !byFounder.has(clan.founderId)) {
      byFounder.set(clan.founderId, clan);
    }
  }

  const fatherOf = (id: string) =>
    (graph.parentsOf.get(id) ?? []).find(
      (parentId) => graph.byId.get(parentId)?.gender === "male",
    ) ?? null;

  const clanOf = new Map<string, string | null>();
  for (const id of graph.byId.keys()) {
    const chain: string[] = [];
    const inChain = new Set<string>();
    let cursor: string | null = id;
    let found: string | null = null;
    while (cursor && !inChain.has(cursor)) {
      if (clanOf.has(cursor)) {
        found = clanOf.get(cursor) ?? null;
        break;
      }
      chain.push(cursor);
      inChain.add(cursor);
      const clan = byFounder.get(cursor);
      if (clan) {
        found = clan.id;
        break;
      }
      cursor = fatherOf(cursor);
    }
    for (const member of chain) clanOf.set(member, found);
  }

  const counts = new Map<string, number>();
  for (const clanId of clanOf.values()) {
    if (clanId) counts.set(clanId, (counts.get(clanId) ?? 0) + 1);
  }
  return clans
    .map((clan) => ({ clan, count: counts.get(clan.id) ?? 0 }))
    .sort((a, b) => b.count - a.count || a.clan.name.localeCompare(b.clan.name, "ru"));
}
