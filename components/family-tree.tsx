"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { indexGraph, type IndexedGraph, type KinGraph } from "@/lib/graph";
import { formatFio, personYears, type PersonDTO } from "@/lib/names";
import type { AncestorNode, ClanTree, DescentNode, PersonTree } from "@/lib/tree";
import { layoutTree } from "@/lib/tree-layout";

const ZOOM_MIN = 0.4;
const ZOOM_MAX = 1.6;
const ZOOM_STEP = 0.2;

function clampZoom(value: number): number {
  return Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value)) * 100) / 100;
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
  const shown = useMemo(() => [...people.values()].map((item) => item.person), [people]);
  const index = useMemo(
    () => graph ?? indexGraph({ people: shown, parentLinks: [], marriages: [] }),
    [graph, shown],
  );
  const layout = useMemo(() => layoutTree(shown, index, focusId), [shown, index, focusId]);
  const [zoom, setZoom] = useState(1);
  const [selectedId, setSelectedId] = useState(focusId);
  const selected =
    selectedId !== focusId
      ? (layout.boxes.find((box) => box.person.id === selectedId)?.person ?? null)
      : null;

  const centerOn = useCallback((id: string, smooth = false) => {
    const node = scrollRef.current?.querySelector<HTMLElement>(`[data-person="${id}"]`);
    node?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: smooth ? "smooth" : "auto",
    });
  }, []);

  useLayoutEffect(() => {
    centerOn(focusId);
  }, [layout, focusId, centerOn]);

  // При смене масштаба держим выбранного человека в поле зрения.
  const selectedRef = useRef(selectedId);
  useEffect(() => {
    selectedRef.current = selectedId;
  }, [selectedId]);
  useEffect(() => {
    centerOn(selectedRef.current);
  }, [zoom, centerOn]);

  const fitAll = () => {
    const frame = scrollRef.current;
    if (!frame || layout.width <= 0) return;
    const style = getComputedStyle(frame);
    const inner =
      frame.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
    setZoom(clampZoom(Math.min(1, Math.floor((inner / layout.width) * 100) / 100)));
  };

  return (
    <div className="tree-frame">
      <div ref={scrollRef} className="tree-scroll">
        <div
          className="tree-zoom-box"
          style={{ width: layout.width * zoom, height: layout.height * zoom }}
        >
          <div
            className="tree-echo"
            style={{
              width: layout.width,
              height: layout.height,
              transform: `scale(${zoom})`,
              transformOrigin: "0 0",
            }}
          >
            <svg className="tree-lines" aria-hidden="true">
              {layout.lines
                .filter((line) => line.kind === "parent")
                .map((line, index) => (
                  <g key={`p-${index}`}>
                    <path d={line.d} className="tree-line-halo" />
                    <path d={line.d} className="tree-line" />
                  </g>
                ))}
              {layout.lines
                .filter((line) => line.kind === "spouse")
                .map((line, index) => (
                  <path key={`s-${index}`} d={line.d} className="tree-line tree-line--spouse" />
                ))}
            </svg>
            {layout.boxes.map((box) => {
              const years = personYears(box.person);
              const pathCount = doubledById?.[box.person.id];
              const caption = [box.person.firstName, box.person.lastName, years]
                .filter(Boolean)
                .join(" ");
              const isSelected = box.person.id === selectedId && !box.current;
              return (
                <Link
                  key={box.person.id}
                  href={`/people/${box.person.id}`}
                  data-person={box.person.id}
                  aria-label={caption}
                  aria-pressed={isSelected}
                  className={`tree-node ${
                    box.person.inCensus1886 ? "tree-node-census" : ""
                  } ${box.current ? "tree-node-current" : ""} ${
                    isSelected ? "tree-node-selected" : ""
                  }`}
                  style={{ left: box.x, top: box.y }}
                  onClick={(event) => {
                    event.preventDefault();
                    if (box.current) {
                      setSelectedId(focusId);
                      return;
                    }
                    if (isSelected) {
                      router.push(`/people/${box.person.id}`);
                      return;
                    }
                    setSelectedId(box.person.id);
                  }}
                >
                  {box.person.inCensus1886 ? (
                    <span className="tree-node-stamp" title="Записан в переписи 1886 года">
                      1886
                    </span>
                  ) : null}
                  <span className="tree-node-name">{box.person.firstName}</span>
                  {years ? <span className="tree-node-years">{years}</span> : null}
                  {pathCount && pathCount > 1 ? (
                    <span className="tree-node-mark">×{pathCount}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      <div className="tree-zoom" role="group" aria-label="Масштаб древа">
        <button
          type="button"
          aria-label="Приблизить"
          onClick={() => setZoom((value) => clampZoom(value + ZOOM_STEP))}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Отдалить"
          onClick={() => setZoom((value) => clampZoom(value - ZOOM_STEP))}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M5 12h14" />
          </svg>
        </button>
        <button type="button" aria-label="Показать всё древо" onClick={fitAll}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Вернуться к выбранному человеку"
          onClick={() => {
            setZoom((value) => (value < 0.8 ? 1 : value));
            centerOn(selectedId, true);
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
      </div>

      {selected ? (
        <div className="tree-pick" role="region" aria-label="Выбранный человек">
          <div className="tree-pick-who">
            <p className="tree-pick-name serif">{formatFio(selected) || selected.firstName}</p>
            <p className="tree-pick-meta">
              {[personYears(selected), selected.inCensus1886 ? "перепись 1886" : ""]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="tree-pick-actions">
            <Link href={`/people/${selected.id}`} className="tree-pick-main">
              Открыть карточку
            </Link>
            <Link href={`/kinship?from=${focusId}&to=${selected.id}`} className="tree-pick-more">
              Кем приходится
            </Link>
            <button
              type="button"
              className="tree-pick-close"
              aria-label="Снять выбор"
              onClick={() => setSelectedId(focusId)}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        </div>
      ) : null}
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
