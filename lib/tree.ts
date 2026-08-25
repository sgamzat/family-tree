import { formatFio, type PersonDTO } from "@/lib/names";
import { indexGraph, type IndexedGraph, type KinGraph } from "@/lib/graph";

export type AncestorNode = {
  person: PersonDTO;
  father: AncestorNode | null;
  mother: AncestorNode | null;
};

export type DescentNode = {
  person: PersonDTO;
  spouses: PersonDTO[];
  children: DescentNode[];
};

export type PersonTree = {
  person: PersonDTO;
  ancestors: AncestorNode;
  descendants: DescentNode;
  siblings: PersonDTO[];
};

export type ClanTree = {
  focus: PersonDTO;
  root: DescentNode;
  rootPerson: PersonDTO;
};

export type TreeMode = "line" | "clan";

export const UP_DEPTHS = [
  { value: 1, label: "Родители" },
  { value: 2, label: "Деды" },
  { value: 3, label: "Прадеды" },
  { value: 4, label: "Прапрадеды" },
] as const;

export const DOWN_DEPTHS = [
  { value: 1, label: "Дети" },
  { value: 2, label: "Внуки" },
  { value: 3, label: "Правнуки" },
  { value: 4, label: "Праправнуки" },
] as const;

function asParents(
  graph: IndexedGraph,
  id: string,
): { father: PersonDTO | null; mother: PersonDTO | null } {
  const parents = (graph.parentsOf.get(id) ?? [])
    .map((parentId) => graph.byId.get(parentId))
    .filter((person): person is PersonDTO => Boolean(person));
  return {
    father: parents.find((person) => person.gender === "male") ?? null,
    mother: parents.find((person) => person.gender === "female") ?? null,
  };
}

function buildAncestors(
  graph: IndexedGraph,
  id: string,
  depth: number,
  visiting: Set<string>,
): AncestorNode | null {
  const person = graph.byId.get(id);
  if (!person || visiting.has(id) || depth < 0) return null;
  visiting.add(id);
  const { father, mother } = asParents(graph, id);
  const node: AncestorNode = {
    person,
    father: father
      ? buildAncestors(graph, father.id, depth - 1, visiting)
      : null,
    mother: mother
      ? buildAncestors(graph, mother.id, depth - 1, visiting)
      : null,
  };
  visiting.delete(id);
  return node;
}

function buildDescent(
  graph: IndexedGraph,
  id: string,
  depth: number,
  visiting: Set<string>,
): DescentNode | null {
  const person = graph.byId.get(id);
  if (!person || visiting.has(id) || depth < 0) return null;
  visiting.add(id);
  const spouses = (graph.spousesOf.get(id) ?? [])
    .map((spouseId) => graph.byId.get(spouseId))
    .filter((spouse): spouse is PersonDTO => Boolean(spouse));
  const children = (graph.childrenOf.get(id) ?? [])
    .map((childId) => buildDescent(graph, childId, depth - 1, visiting))
    .filter((child): child is DescentNode => Boolean(child));
  visiting.delete(id);
  return { person, spouses, children };
}

function siblingsOf(graph: IndexedGraph, personId: string): PersonDTO[] {
  const parentIds = graph.parentsOf.get(personId) ?? [];
  const siblingIds = new Set<string>();
  for (const parentId of parentIds) {
    for (const childId of graph.childrenOf.get(parentId) ?? []) {
      if (childId !== personId) siblingIds.add(childId);
    }
  }
  return [...siblingIds]
    .map((id) => graph.byId.get(id))
    .filter((sibling): sibling is PersonDTO => Boolean(sibling));
}

export function maxUp(graph: KinGraph, personId: string): number {
  const indexed = indexGraph(graph);
  function walk(id: string, visiting: Set<string>): number {
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const parents = indexed.parentsOf.get(id) ?? [];
    if (parents.length === 0) return 0;
    return 1 + Math.max(0, ...parents.map((parentId) => walk(parentId, visiting)));
  }
  return walk(personId, new Set());
}

export function maxDown(graph: KinGraph, personId: string): number {
  const indexed = indexGraph(graph);
  function walk(id: string, visiting: Set<string>): number {
    if (visiting.has(id)) return 0;
    visiting.add(id);
    const children = indexed.childrenOf.get(id) ?? [];
    if (children.length === 0) return 0;
    return 1 + Math.max(0, ...children.map((childId) => walk(childId, visiting)));
  }
  return walk(personId, new Set());
}

export function paternalLineIds(graph: KinGraph, personId: string): string[] {
  const indexed = indexGraph(graph);
  const ids: string[] = [];
  let current = personId;
  const seen = new Set<string>();
  while (!seen.has(current)) {
    seen.add(current);
    ids.push(current);
    const { father } = asParents(indexed, current);
    if (!father) break;
    current = father.id;
  }
  return ids;
}

export function paternalRootId(graph: KinGraph, personId: string): string {
  const line = paternalLineIds(graph, personId);
  return line[line.length - 1] ?? personId;
}

export function buildPersonTree(
  graph: KinGraph,
  personId: string,
  depth: { up?: number; down?: number } = {},
): PersonTree | null {
  const indexed = indexGraph(graph);
  const person = indexed.byId.get(personId);
  if (!person) return null;

  const up = depth.up ?? 3;
  const down = depth.down ?? 3;
  const ancestors = buildAncestors(indexed, personId, up, new Set());
  const descendants = buildDescent(indexed, personId, down, new Set());
  if (!ancestors || !descendants) return null;

  return {
    person,
    ancestors,
    descendants,
    siblings: siblingsOf(indexed, personId),
  };
}

export function buildClanTree(
  graph: KinGraph,
  personId: string,
  down = 8,
): ClanTree | null {
  const indexed = indexGraph(graph);
  const focus = indexed.byId.get(personId);
  if (!focus) return null;
  const rootId = paternalRootId(graph, personId);
  const root = buildDescent(indexed, rootId, down, new Set());
  const rootPerson = indexed.byId.get(rootId);
  if (!root || !rootPerson) return null;
  return { focus, root, rootPerson };
}

export function treeHasRelatives(tree: PersonTree): boolean {
  return Boolean(
    tree.ancestors.father ||
      tree.ancestors.mother ||
      tree.descendants.spouses.length ||
      tree.descendants.children.length ||
      tree.siblings.length,
  );
}

export function clanHasRelatives(tree: ClanTree): boolean {
  return (
    tree.root.person.id !== tree.focus.id ||
    tree.root.children.length > 0 ||
    tree.root.spouses.length > 0
  );
}

export function clanCaption(tree: ClanTree): string {
  return `Род от ${formatFio(tree.rootPerson)} (по отцовской линии)`;
}
