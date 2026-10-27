import { censusPathUp, generationWord } from "@/lib/census";
import type { IndexedGraph } from "@/lib/graph";
import { genitive, type PersonDTO } from "@/lib/names";

/** Личная главная: что показать жителю, который связал аккаунт со своей карточкой. */

export type LineStep = { person: PersonDTO; word: string };

export type Action = { label: string; href: string };

export type MyLine = {
  steps: LineStep[];
  reachedCensus: boolean;
  next: Action;
  secondary: Action | null;
};

const MAX_DEPTH = 30;

function parentsOf(graph: IndexedGraph, id: string): PersonDTO[] {
  return (graph.parentsOf.get(id) ?? [])
    .map((parentId) => graph.byId.get(parentId))
    .filter((person): person is PersonDTO => Boolean(person));
}

function father(graph: IndexedGraph, id: string): PersonDTO | null {
  return parentsOf(graph, id).find((person) => person.gender === "male") ?? null;
}

function mother(graph: IndexedGraph, id: string): PersonDTO | null {
  return parentsOf(graph, id).find((person) => person.gender === "female") ?? null;
}

function word(up: number, person: PersonDTO): string {
  return up === 0 ? "вы" : generationWord(up, person.gender);
}

/** Самая длинная известная цепочка предков; при равной длине — через отца. */
function longestLine(graph: IndexedGraph, personId: string): PersonDTO[] {
  const memo = new Map<string, number>();
  const depth = (id: string, guard: Set<string>): number => {
    const known = memo.get(id);
    if (known !== undefined) return known;
    if (guard.has(id) || guard.size > MAX_DEPTH) return 0;
    guard.add(id);
    const best = Math.max(0, ...parentsOf(graph, id).map((parent) => depth(parent.id, guard)));
    guard.delete(id);
    memo.set(id, best + 1);
    return best + 1;
  };

  const chain: PersonDTO[] = [];
  let current = graph.byId.get(personId) ?? null;
  const seen = new Set<string>();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    chain.push(current);
    const parents = parentsOf(graph, current.id).sort(
      (a, b) =>
        depth(b.id, new Set()) - depth(a.id, new Set()) ||
        (a.gender === "male" ? -1 : 1) - (b.gender === "male" ? -1 : 1),
    );
    current = parents[0] ?? null;
  }
  return chain;
}

export function myLine(graph: IndexedGraph, personId: string): MyLine | null {
  if (!graph.byId.has(personId)) return null;

  const toCensus = censusPathUp(graph, personId);
  if (toCensus) {
    return {
      steps: toCensus.map((step) => ({ person: step.person, word: word(step.up, step.person) })),
      reachedCensus: true,
      next: { label: "Открыть древо", href: `/people/${personId}` },
      secondary: { label: "Кем вам приходятся другие", href: `/kinship?from=${personId}` },
    };
  }

  const chain = longestLine(graph, personId);
  const oldest = chain[chain.length - 1];
  const role = father(graph, oldest.id) ? "mother" : "father";
  const who = genitive(oldest.firstName, oldest.gender);
  return {
    steps: chain.map((person, up) => ({ person, word: word(up, person) })),
    reachedCensus: false,
    next: {
      label:
        oldest.id === personId
          ? role === "father"
            ? "Добавить своего отца"
            : "Добавить свою мать"
          : `Добавить ${role === "father" ? "отца" : "мать"} ${who}`,
      href: `/people/${oldest.id}?add=${role}`,
    },
    secondary: { label: "Поискать в переписи", href: "/census" },
  };
}

export type Gap = { key: string; title: string; hint: string; href: string };

/** Пробелы вокруг жителя — что проще всего дописать. Не больше трёх. */
export function gaps(graph: IndexedGraph, personId: string, line: MyLine | null): Gap[] {
  const me = graph.byId.get(personId);
  if (!me) return [];
  const out: Gap[] = [];
  const mainTarget = line && !line.reachedCensus ? line.next.href : "";

  // 1. Где обрывается отцовская линия.
  let tip = me;
  const seen = new Set<string>();
  while (!seen.has(tip.id)) {
    seen.add(tip.id);
    const next = father(graph, tip.id);
    if (!next) break;
    tip = next;
  }
  const fatherHref = `/people/${tip.id}?add=father`;
  if (!father(graph, tip.id) && fatherHref !== mainTarget && !tip.inCensus1886) {
    out.push({
      key: "father",
      title: tip.id === me.id ? "Ваш отец" : `Отец ${genitive(tip.firstName, tip.gender)}`,
      hint: tip.id === me.id ? "пока не указан" : "здесь обрывается ваша отцовская линия",
      href: fatherHref,
    });
  }

  // 2. Мать.
  const motherHref = `/people/${me.id}?add=mother`;
  if (!mother(graph, me.id) && motherHref !== mainTarget) {
    out.push({ key: "mother", title: "Ваша мать", hint: "пока не указана", href: motherHref });
  }

  // 3. Предки без годов — до прапрадедов.
  const noYears: PersonDTO[] = [];
  let level = [me.id];
  const visited = new Set<string>([me.id]);
  for (let up = 0; up < 4 && noYears.length < 2; up += 1) {
    const next: string[] = [];
    for (const id of level) {
      for (const parent of parentsOf(graph, id)) {
        if (visited.has(parent.id)) continue;
        visited.add(parent.id);
        next.push(parent.id);
        if (!parent.birthYear && !parent.birthDateText.trim() && noYears.length < 2) {
          noYears.push(parent);
        }
      }
    }
    level = next;
  }
  if (noYears.length > 0) {
    out.push({
      key: "years",
      title: `Годы ${noYears.map((person) => genitive(person.firstName, person.gender)).join(" и ")}`,
      hint: "хотя бы примерно — «около 1900»",
      href: `/people/${noYears[0].id}?edit=1`,
    });
  }

  // 4. Братья и сёстры.
  const parents = parentsOf(graph, me.id);
  const hasSiblings = parents.some((parent) =>
    (graph.childrenOf.get(parent.id) ?? []).some((childId) => childId !== me.id),
  );
  if (parents.length > 0 && !hasSiblings) {
    out.push({
      key: "siblings",
      title: "Братья и сёстры",
      hint: "у вас пока никто не указан",
      href: `/people/${me.id}`,
    });
  }

  return out.slice(0, 3);
}

/* --- Лента «Новое в селе» ---------------------------------------------------- */

export type ChangeEntry = {
  action: string;
  personId: string | null;
  payload: string;
  createdAt: Date;
};

export type FeedItem = {
  key: string;
  actor: string;
  isYou: boolean;
  text: string;
  date: Date;
};

export function pluralPeople(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} человек`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} человека`;
  return `${count} человек`;
}

function listNames(names: string[]): string {
  // Без схлопывания одинаковых имён: два Гасан-Гусейна — два разных человека.
  const unique = names.filter(Boolean);
  if (unique.length <= 3) {
    return unique.length > 1
      ? `${unique.slice(0, -1).join(", ")} и ${unique[unique.length - 1]}`
      : (unique[0] ?? "");
  }
  return `${unique.slice(0, 2).join(", ")} и ещё ${unique.length - 2}`;
}

/**
 * Записи журнала → короткие строки. Добавления одного жителя за день
 * собираются в одну строку: «добавлено 4 человека: Тамари, Залму и ещё 2».
 */
export function buildFeed(
  entries: ChangeEntry[],
  graph: IndexedGraph,
  myName: string,
  limit = 5,
): FeedItem[] {
  type Group = { actor: string; kind: string; day: string; date: Date; names: string[] };
  const groups: Group[] = [];
  const byKey = new Map<string, Group>();

  for (const entry of entries) {
    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(entry.payload) as Record<string, unknown>;
    } catch {
      payload = {};
    }
    const actor =
      typeof payload.actor === "string" && payload.actor !== "anonymous" ? payload.actor : "";

    let kind = "";
    let name = "";
    if (entry.action === "person.create") {
      kind = "add";
      const person = payload.person as { firstName?: string } | undefined;
      name = person?.firstName ?? graph.byId.get(entry.personId ?? "")?.firstName ?? "";
    } else if (entry.action === "relation.add" && payload.created === true) {
      kind = "add";
      name = graph.byId.get(String(payload.relativeId ?? ""))?.firstName ?? "";
    } else if (entry.action === "person.census") {
      kind = "census";
      name = graph.byId.get(entry.personId ?? "")?.firstName ?? "";
    } else if (entry.action === "person.merge") {
      kind = "merge";
    } else {
      continue;
    }

    const day = entry.createdAt.toISOString().slice(0, 10);
    const key = `${actor}|${kind}|${day}`;
    let group = byKey.get(key);
    if (!group) {
      group = { actor, kind, day, date: entry.createdAt, names: [] };
      byKey.set(key, group);
      groups.push(group);
    }
    if (name) group.names.push(name);
    if (entry.createdAt > group.date) group.date = entry.createdAt;
  }

  return groups.slice(0, limit).map((group) => {
    const count = Math.max(1, group.names.length);
    let text = "";
    if (group.kind === "add") {
      text = `добавлено ${pluralPeople(count)}${group.names.length ? `: ${listNames(group.names)}` : ""}`;
    } else if (group.kind === "census") {
      text = `отмечено в переписи 1886: ${listNames(group.names) || pluralPeople(count)}`;
    } else {
      text = "объединены карточки-двойники";
    }
    return {
      key: `${group.actor}|${group.kind}|${group.day}`,
      actor: group.actor || "Кто-то",
      isYou: Boolean(group.actor) && group.actor === myName,
      text,
      date: group.date,
    };
  });
}

/** «сегодня», «вчера», «26 окт.» */
export function relativeDay(date: Date, now = new Date()): string {
  const startOfDay = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(date)) / 86_400_000);
  if (days <= 0) return "сегодня";
  if (days === 1) return "вчера";
  return new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(date);
}

export type VillageStats = { people: number; generations: number };

/** Сколько людей в древе и сколько поколений в самой длинной известной цепочке. */
export function villageStats(graph: IndexedGraph): VillageStats {
  const memo = new Map<string, number>();
  const onPath = new Set<string>();
  const depth = (id: string): number => {
    const known = memo.get(id);
    if (known !== undefined) return known;
    if (onPath.has(id)) return 0;
    onPath.add(id);
    let best = 0;
    for (const parentId of graph.parentsOf.get(id) ?? []) {
      if (graph.byId.has(parentId)) best = Math.max(best, depth(parentId));
    }
    onPath.delete(id);
    memo.set(id, best + 1);
    return best + 1;
  };
  let generations = 0;
  for (const id of graph.byId.keys()) generations = Math.max(generations, depth(id));
  return { people: graph.byId.size, generations };
}

/** 1 род, 2 рода, 5 родов — для подписей к числам. */
export function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}
