import type { PersonDTO } from "@/lib/names";

export type KinGraph = {
  people: PersonDTO[];
  parentLinks: Array<{ parentId: string; childId: string }>;
  marriages: Array<{ personAId: string; personBId: string }>;
};

export type KinStepType = "parent" | "child" | "spouse";

export type IndexedGraph = {
  byId: Map<string, PersonDTO>;
  parentsOf: Map<string, string[]>;
  childrenOf: Map<string, string[]>;
  spousesOf: Map<string, string[]>;
};

export function indexGraph(graph: KinGraph): IndexedGraph {
  const byId = new Map(graph.people.map((person) => [person.id, person]));
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const spousesOf = new Map<string, string[]>();

  function push(map: Map<string, string[]>, key: string, value: string) {
    const list = map.get(key) ?? [];
    if (!list.includes(value)) list.push(value);
    map.set(key, list);
  }

  for (const link of graph.parentLinks) {
    push(parentsOf, link.childId, link.parentId);
    push(childrenOf, link.parentId, link.childId);
  }
  for (const marriage of graph.marriages) {
    push(spousesOf, marriage.personAId, marriage.personBId);
    push(spousesOf, marriage.personBId, marriage.personAId);
  }

  return { byId, parentsOf, childrenOf, spousesOf };
}

export function neighbors(
  graph: IndexedGraph,
  id: string,
): Array<{ id: string; type: KinStepType }> {
  return [
    ...(graph.parentsOf.get(id) ?? []).map((parentId) => ({
      id: parentId,
      type: "parent" as const,
    })),
    ...(graph.childrenOf.get(id) ?? []).map((childId) => ({
      id: childId,
      type: "child" as const,
    })),
    ...(graph.spousesOf.get(id) ?? []).map((spouseId) => ({
      id: spouseId,
      type: "spouse" as const,
    })),
  ];
}
