import type { IndexedGraph } from "@/lib/graph";
import type { PersonDTO } from "@/lib/names";

/** Три вида древа на странице человека. */
export type TreeView = "close" | "all" | "tukhum";

export const TREE_VIEWS: ReadonlyArray<{ value: TreeView; label: string }> = [
  { value: "close", label: "Близкие" },
  { value: "all", label: "Все родные" },
  { value: "tukhum", label: "Тухум" },
];

const CLOSE_UP = 3;
const CLOSE_DOWN = 2;

function people(graph: IndexedGraph, ids: Iterable<string>): PersonDTO[] {
  const out: PersonDTO[] = [];
  for (const id of ids) {
    const person = graph.byId.get(id);
    if (person) out.push(person);
  }
  return out;
}

function addSpouses(graph: IndexedGraph, set: Set<string>, id: string) {
  for (const spouseId of graph.spousesOf.get(id) ?? []) set.add(spouseId);
}

/**
 * «Близкие»: предки до прадедов по обеим сторонам, братья и сёстры,
 * супруги, дети и внуки — и супруги тех, кто ниже, и вторые родители детей.
 * Без настроек: набор всегда один и тот же.
 */
export function closePeople(graph: IndexedGraph, personId: string): PersonDTO[] {
  const set = new Set<string>([personId]);
  addSpouses(graph, set, personId);

  let level = [personId];
  for (let up = 0; up < CLOSE_UP; up += 1) {
    const next: string[] = [];
    for (const id of level) {
      for (const parentId of graph.parentsOf.get(id) ?? []) {
        if (set.has(parentId)) continue;
        set.add(parentId);
        next.push(parentId);
      }
    }
    level = next;
  }

  for (const parentId of graph.parentsOf.get(personId) ?? []) {
    for (const siblingId of graph.childrenOf.get(parentId) ?? []) set.add(siblingId);
  }
  // Родители супругов: тесть, тёща, свёкор, свекровь.
  for (const spouseId of graph.spousesOf.get(personId) ?? []) {
    for (const parentId of graph.parentsOf.get(spouseId) ?? []) set.add(parentId);
  }

  level = [personId];
  for (let down = 0; down < CLOSE_DOWN; down += 1) {
    const next: string[] = [];
    for (const id of level) {
      for (const childId of graph.childrenOf.get(id) ?? []) {
        set.add(childId);
        addSpouses(graph, set, childId);
        for (const coParent of graph.parentsOf.get(childId) ?? []) set.add(coParent);
        next.push(childId);
      }
    }
    level = next;
  }

  return people(graph, set);
}

/**
 * «Все родные»: все, до кого от человека можно дойти по любой цепочке —
 * через родителей, детей и браки, в том числе через кого-то.
 */
export function allRelatives(graph: IndexedGraph, personId: string): PersonDTO[] {
  if (!graph.byId.has(personId)) return [];
  const seen = new Set<string>([personId]);
  const queue = [personId];
  for (let i = 0; i < queue.length; i += 1) {
    const id = queue[i];
    for (const next of [
      ...(graph.parentsOf.get(id) ?? []),
      ...(graph.childrenOf.get(id) ?? []),
      ...(graph.spousesOf.get(id) ?? []),
    ]) {
      if (seen.has(next) || !graph.byId.has(next)) continue;
      seen.add(next);
      queue.push(next);
    }
  }
  return people(graph, seen);
}

function fatherOf(graph: IndexedGraph, id: string): string | null {
  return (
    (graph.parentsOf.get(id) ?? []).find(
      (parentId) => graph.byId.get(parentId)?.gender === "male",
    ) ?? null
  );
}

/** Самый верхний известный предок по отцам. */
export function paternalRoot(graph: IndexedGraph, personId: string): string {
  let current = personId;
  const seen = new Set<string>();
  while (!seen.has(current)) {
    seen.add(current);
    const father = fatherOf(graph, current);
    if (!father) break;
    current = father;
  }
  return current;
}

/**
 * «Тухум»: род по мужской линии от самого верхнего известного предка по отцам.
 * Дочери показаны, их дети — нет: они уже из рода мужа. Жёны мужчин рода показаны.
 */
export function tukhumPeople(
  graph: IndexedGraph,
  personId: string,
): { people: PersonDTO[]; rootId: string } {
  const rootId = paternalRoot(graph, personId);
  const set = new Set<string>([rootId]);
  const visited = new Set<string>([rootId]);
  const queue = [rootId];
  for (let i = 0; i < queue.length; i += 1) {
    const id = queue[i];
    if (graph.byId.get(id)?.gender !== "male") continue;
    addSpouses(graph, set, id);
    for (const childId of graph.childrenOf.get(id) ?? []) {
      set.add(childId);
      // Мать ребёнка — жена, даже если брак не записан.
      for (const parentId of graph.parentsOf.get(childId) ?? []) set.add(parentId);
      if (visited.has(childId)) continue;
      visited.add(childId);
      queue.push(childId);
    }
  }
  return { people: people(graph, set), rootId };
}
