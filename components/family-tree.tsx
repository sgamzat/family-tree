"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect, useMemo, useRef } from "react";
import { indexGraph, type IndexedGraph, type KinGraph } from "@/lib/graph";
import { personYears, type PersonDTO } from "@/lib/names";
import type { AncestorNode, ClanTree, DescentNode, PersonTree } from "@/lib/tree";

const BOX_W = 108;
const BOX_H = 54;
const PAIR_GAP = 24;
const UNIT_GAP = 40;
const ROW_GAP = 52;
const ROW = BOX_H + ROW_GAP;
const PAD = 16;

type Placed = {
  person: PersonDTO;
  x: number;
  y: number;
  current: boolean;
};

type Line = { d: string; kind: "parent" | "spouse" };

type Unit = {
  id: string;
  members: PersonDTO[];
  gen: number;
  children: Unit[];
  parentUnits: Unit[];
  x: number;
  y: number;
  subtree: number;
};

function round(value: number): number {
  return Math.round(value * 10) / 10;
}

function unitSpan(count: number): number {
  return count * BOX_W + Math.max(0, count - 1) * PAIR_GAP;
}

function orderCouple(people: PersonDTO[]): PersonDTO[] {
  const female = people.filter((person) => person.gender === "female");
  const male = people.filter((person) => person.gender === "male");
  return [...female, ...male];
}

function birthRank(person: PersonDTO): number {
  return person.birthYear ?? 9999;
}

function addPerson(
  map: Map<string, { person: PersonDTO; gen: number }>,
  person: PersonDTO | null | undefined,
  gen: number,
  override = false,
) {
  if (!person) return;
  if (map.has(person.id) && !override) return;
  map.set(person.id, { person, gen });
}

function collectFromAncestors(
  node: AncestorNode | null,
  gen: number,
  map: Map<string, { person: PersonDTO; gen: number }>,
) {
  if (!node) return;
  addPerson(map, node.person, gen);
  collectFromAncestors(node.father, gen - 1, map);
  collectFromAncestors(node.mother, gen - 1, map);
}

function collectFromDescent(
  node: DescentNode | null,
  gen: number,
  map: Map<string, { person: PersonDTO; gen: number }>,
) {
  if (!node) return;
  addPerson(map, node.person, gen);
  for (const spouse of node.spouses) addPerson(map, spouse, gen);
  for (const child of node.children) collectFromDescent(child, gen + 1, map);
}

function peopleFromLineage(
  tree: PersonTree,
  graph: IndexedGraph | null,
): Map<string, { person: PersonDTO; gen: number }> {
  const map = new Map<string, { person: PersonDTO; gen: number }>();
  collectFromAncestors(tree.ancestors, 0, map);
  collectFromDescent(tree.descendants, 0, map);
  for (const sibling of tree.siblings) addPerson(map, sibling, 0);

  if (!graph) return map;

  for (const { person, gen } of [...map.values()]) {
    for (const spouseId of graph.spousesOf.get(person.id) ?? []) {
      addPerson(map, graph.byId.get(spouseId), gen);
    }
  }

  for (const spouse of tree.descendants.spouses) {
    addPerson(map, spouse, 0);
    for (const parentId of graph.parentsOf.get(spouse.id) ?? []) {
      addPerson(map, graph.byId.get(parentId), -1);
    }
  }

  for (const [childId, { gen }] of [...map.entries()]) {
    if (gen <= 0) continue;
    for (const parentId of graph.parentsOf.get(childId) ?? []) {
      addPerson(map, graph.byId.get(parentId), gen - 1);
    }
  }

  return map;
}

function peopleFromClan(
  tree: ClanTree,
): Map<string, { person: PersonDTO; gen: number }> {
  const map = new Map<string, { person: PersonDTO; gen: number }>();
  collectFromDescent(tree.root, 0, map);
  return map;
}

function formUnits(
  people: Map<string, { person: PersonDTO; gen: number }>,
  graph: IndexedGraph | null,
): Unit[] {
  const units: Unit[] = [];
  const genOf = (id: string) => people.get(id)?.gen ?? 0;
  const rootOf = new Map<string, string>();
  const find = (id: string): string => {
    if (!rootOf.has(id)) rootOf.set(id, id);
    const cur = rootOf.get(id) ?? id;
    if (cur !== id) rootOf.set(id, find(cur));
    return rootOf.get(id) ?? id;
  };
  const join = (a: string, b: string) => {
    if (genOf(a) !== genOf(b)) return;
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) rootOf.set(ra, rb);
  };

  for (const id of people.keys()) find(id);
  if (graph) {
    for (const id of people.keys()) {
      for (const spouseId of graph.spousesOf.get(id) ?? []) {
        if (people.has(spouseId)) join(id, spouseId);
      }
    }
    const hasSpouseOnTree = (id: string) =>
      (graph.spousesOf.get(id) ?? []).some((spouseId) => people.has(spouseId));
    for (const childId of people.keys()) {
      const parents = (graph.parentsOf.get(childId) ?? []).filter((id) => people.has(id));
      for (let i = 1; i < parents.length; i++) {
        if (hasSpouseOnTree(parents[0]) || hasSpouseOnTree(parents[i])) continue;
        join(parents[0], parents[i]);
      }
    }
  }

  const groups = new Map<string, PersonDTO[]>();
  for (const { person } of people.values()) {
    const key = `${find(person.id)}@${genOf(person.id)}`;
    const list = groups.get(key) ?? [];
    list.push(person);
    groups.set(key, list);
  }

  for (const members of groups.values()) {
    const ordered = orderCouple(members);
    units.push({
      id: ordered.map((member) => member.id).join("|"),
      members: ordered,
      gen: genOf(ordered[0].id),
      children: [],
      parentUnits: [],
      x: 0,
      y: 0,
      subtree: 0,
    });
  }

  const byId = new Map<string, Unit>();
  for (const unit of units) {
    for (const member of unit.members) byId.set(member.id, unit);
  }

  for (const unit of units) {
    const parentIds = new Set<string>();
    for (const member of unit.members) {
      if (graph) {
        for (const parentId of graph.parentsOf.get(member.id) ?? []) {
          parentIds.add(parentId);
        }
      }
    }
    const parents = [
      ...new Set(
        [...parentIds]
          .map((id) => byId.get(id))
          .filter((parent): parent is Unit => Boolean(parent) && parent !== unit),
      ),
    ];
    unit.parentUnits = parents;
  }

  for (const unit of units) {
    if (unit.parentUnits.length === 0) continue;
    const female = unit.members.find((member) => member.gender === "female") ?? unit.members[0];
    const motherParents = graph ? (graph.parentsOf.get(female.id) ?? []) : [];
    const primary =
      unit.parentUnits.find((parent) =>
        parent.members.some((member) => motherParents.includes(member.id)),
      ) ?? unit.parentUnits[0];
    if (!primary.children.includes(unit)) primary.children.push(unit);
  }

  for (const unit of units) {
    unit.children.sort((a, b) => {
      const aYear = Math.min(...a.members.map(birthRank));
      const bYear = Math.min(...b.members.map(birthRank));
      return aYear - bYear;
    });
  }

  return units;
}

function subtreeWidth(unit: Unit): number {
  if (unit.subtree) return unit.subtree;
  const self = unitSpan(unit.members.length);
  if (unit.children.length === 0) {
    unit.subtree = self;
    return self;
  }
  const kids =
    unit.children.reduce((sum, child) => sum + subtreeWidth(child), 0) +
    UNIT_GAP * (unit.children.length - 1);
  unit.subtree = Math.max(self, kids);
  return unit.subtree;
}

function placeUnit(unit: Unit, left: number, minGen: number) {
  const width = subtreeWidth(unit);
  const self = unitSpan(unit.members.length);
  unit.x = left + (width - self) / 2;
  unit.y = (unit.gen - minGen) * ROW + PAD;
  const kids =
    unit.children.reduce((sum, child) => sum + subtreeWidth(child), 0) +
    UNIT_GAP * Math.max(0, unit.children.length - 1);
  let cursor = left + Math.max(0, (width - kids) / 2);
  for (const child of unit.children) {
    placeUnit(child, cursor, minGen);
    cursor += subtreeWidth(child) + UNIT_GAP;
  }
}

function unitMidX(unit: Unit): number {
  const self = unitSpan(unit.members.length);
  return unit.x + self / 2;
}

function attachY(unit: Unit): number {
  return unit.y + BOX_H / 2;
}

function memberBox(unit: Unit, index: number): { x: number; y: number; cx: number; cy: number } {
  const x = unit.x + index * (BOX_W + PAIR_GAP);
  const y = unit.y;
  return { x, y, cx: x + BOX_W / 2, cy: y + BOX_H / 2 };
}

function childAnchors(
  parent: Unit,
  child: Unit,
  graph: IndexedGraph | null,
): { x: number; y: number }[] {
  const parentIds = new Set(parent.members.map((member) => member.id));
  const kids = child.members.filter((person) =>
    (graph?.parentsOf.get(person.id) ?? []).some((id) => parentIds.has(id)),
  );
  return kids.map((person) => {
    const index = child.members.findIndex((member) => member.id === person.id);
    const box = memberBox(child, Math.max(0, index));
    return { x: round(box.cx), y: round(box.cy) };
  });
}

function parentLines(
  parent: Unit,
  children: Unit[],
  graph: IndexedGraph | null,
): string[] {
  if (children.length === 0) return [];
  const hang = children.flatMap((child) => childAnchors(parent, child, graph));
  if (hang.length === 0) return [];
  const stemX = round(unitMidX(parent));
  const stemY = round(attachY(parent));
  const childTop = Math.min(...children.map((child) => child.y));
  if (childTop - (parent.y + BOX_H) < 8) return [];
  const barY = round(parent.y + BOX_H + (childTop - parent.y - BOX_H) * 0.5);
  const xs = [stemX, ...hang.map((item) => item.x)].sort((a, b) => a - b);
  const parts = [`M ${stemX} ${stemY} V ${barY}`];
  if (xs[xs.length - 1] - xs[0] > 4) {
    parts.push(`M ${xs[0]} ${barY} H ${xs[xs.length - 1]}`);
  }
  for (const child of hang) {
    parts.push(`M ${child.x} ${barY} V ${child.y}`);
  }
  return [parts.join(" ")];
}

function layoutPeople(
  people: Map<string, { person: PersonDTO; gen: number }>,
  graph: IndexedGraph | null,
  focusId: string,
): { boxes: Placed[]; lines: Line[]; width: number; height: number } {
  if (people.size === 0) {
    return { boxes: [], lines: [], width: BOX_W + PAD * 2, height: BOX_H + PAD * 2 };
  }

  const units = formUnits(people, graph);
  const minGen = Math.min(...units.map((unit) => unit.gen));
  const roots = units.filter((unit) => !units.some((other) => other.children.includes(unit)));
  const minRootGen = Math.min(...roots.map((unit) => unit.gen));
  const mainRoots = roots
    .filter((unit) => unit.gen === minRootGen)
    .sort((a, b) => a.members[0].firstName.localeCompare(b.members[0].firstName, "ru"));
  const extraRoots = roots.filter((unit) => unit.gen !== minRootGen);

  let cursor = PAD;
  for (const root of mainRoots) {
    placeUnit(root, cursor, minGen);
    cursor += subtreeWidth(root) + UNIT_GAP * 1.4;
  }

  for (const extra of extraRoots) {
    extra.y = (extra.gen - minGen) * ROW + PAD;
    extra.subtree = unitSpan(extra.members.length);
    const child = units.find((unit) => unit.parentUnits.includes(extra));
    const primary = child?.parentUnits.find((parent) => parent.children.includes(child));
    if (primary && primary !== extra) {
      extra.x = primary.x - extra.subtree - UNIT_GAP * 1.4;
    } else if (child) {
      extra.x = child.x - extra.subtree - UNIT_GAP * 1.4;
    } else {
      extra.x = cursor;
      cursor += extra.subtree + UNIT_GAP;
    }
  }

  const boxes: Placed[] = [];
  const rawLines: Line[] = [];

  for (const unit of units) {
    unit.members.forEach((person, index) => {
      const box = memberBox(unit, index);
      boxes.push({
        person,
        x: box.x,
        y: box.y,
        current: person.id === focusId,
      });
    });

    if (unit.members.length >= 2) {
      for (let i = 0; i < unit.members.length - 1; i++) {
        const left = memberBox(unit, i);
        const right = memberBox(unit, i + 1);
        const y = round((left.cy + right.cy) / 2);
        rawLines.push({
          d: `M ${round(left.cx)} ${y} H ${round(right.cx)}`,
          kind: "spouse",
        });
      }
    }
  }

  for (const unit of units) {
    const kids = units.filter((child) => child.parentUnits.includes(unit));
    for (const d of parentLines(unit, kids, graph)) {
      rawLines.push({ d, kind: "parent" });
    }
  }

  const minX = Math.min(...boxes.map((box) => box.x), PAD);
  const shift = PAD - minX;
  for (const box of boxes) box.x += shift;
  const lines = rawLines.map((line) => ({
    ...line,
    d: shiftPathX(line.d, shift),
  }));

  const width = Math.max(...boxes.map((box) => box.x + BOX_W)) + PAD;
  const height = Math.max(...boxes.map((box) => box.y + BOX_H)) + PAD;

  return { boxes, lines, width, height };
}

function shiftPathX(d: string, shift: number): string {
  return d.replace(/([MH])\s*(-?\d+(?:\.\d+)?)/g, (_, cmd: string, num: string) => {
    return `${cmd} ${round(Number(num) + shift)}`;
  });
}

function EchoTree({
  people,
  graph,
  focusId,
  doubledById,
}: {
  people: Map<string, { person: PersonDTO; gen: number }>;
  graph: IndexedGraph | null;
  focusId: string;
  doubledById?: Record<string, number>;
}) {
  const router = useRouter();
  const scrollRef = useRef<HTMLDivElement>(null);
  const layout = useMemo(
    () => layoutPeople(people, graph, focusId),
    [people, graph, focusId],
  );

  useLayoutEffect(() => {
    const current = scrollRef.current?.querySelector(".tree-node-current");
        current?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [layout]);

  return (
    <div ref={scrollRef} className="tree-scroll">
      <div className="tree-echo" style={{ width: layout.width, height: layout.height }}>
        <svg className="tree-lines" aria-hidden="true">
          {layout.lines.map((line, index) => (
            <path
              key={`${line.kind}-${index}`}
              d={line.d}
              className={
                line.kind === "spouse" ? "tree-line tree-line--spouse" : "tree-line"
              }
            />
          ))}
        </svg>
        {layout.boxes.map((box) => {
          const years = personYears(box.person);
          const pathCount = doubledById?.[box.person.id];
          const caption = [box.person.firstName, box.person.lastName, years]
            .filter(Boolean)
            .join(" ");
          return (
            <Link
              key={box.person.id}
              href={`/people/${box.person.id}`}
              aria-label={caption}
              className={`tree-node ${
                box.person.gender === "male" ? "tree-node-male" : "tree-node-female"
              } ${box.current ? "tree-node-current" : ""}`}
              style={{ left: box.x, top: box.y }}
              onClick={(event) => {
                event.preventDefault();
                router.push(`/people/${box.person.id}`);
              }}
            >
              <span className="tree-node-name">{box.person.firstName}</span>
              {pathCount && pathCount > 1 ? (
                <span className="tree-node-mark">×{pathCount}</span>
              ) : null}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function LineageTree({
  tree,
  graph,
  doubledById,
}: {
  tree: PersonTree;
  graph?: KinGraph;
  doubledById?: Record<string, number>;
}) {
  const indexed = useMemo(() => (graph ? indexGraph(graph) : null), [graph]);
  const people = useMemo(
    () => peopleFromLineage(tree, indexed),
    [tree, indexed],
  );
  return (
    <EchoTree
      people={people}
      graph={indexed}
      focusId={tree.person.id}
      doubledById={doubledById}
    />
  );
}

export function ClanTreeView({
  tree,
  graph,
  doubledById,
}: {
  tree: ClanTree;
  graph?: KinGraph;
  doubledById?: Record<string, number>;
}) {
  const indexed = useMemo(() => (graph ? indexGraph(graph) : null), [graph]);
  const people = useMemo(() => peopleFromClan(tree), [tree]);
  return (
    <EchoTree
      people={people}
      graph={indexed}
      focusId={tree.focus.id}
      doubledById={doubledById}
    />
  );
}
