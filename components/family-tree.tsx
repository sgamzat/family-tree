"use client";

import Link from "next/link";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { personYears, type PersonDTO } from "@/lib/names";
import type { AncestorNode, ClanTree, DescentNode, PersonTree } from "@/lib/tree";

const RegisterCtx = createContext<
  ((id: string, el: HTMLElement | null) => void) | null
>(null);

const StructuralCtx = createContext<Set<string>>(new Set());

type Edge = { a: string; b: string; kind: "parent" | "parent2" | "spouse" };

type Rel = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  cx: number;
  cy: number;
  h: number;
};

function collectStructuralIds(opts: {
  ancestors?: AncestorNode | null;
  descentRoot?: DescentNode | null;
  extra?: string[];
}): Set<string> {
  const ids = new Set<string>();
  const up = (n: AncestorNode | null) => {
    if (!n) return;
    ids.add(n.person.id);
    up(n.father);
    up(n.mother);
  };
  const down = (n: DescentNode) => {
    ids.add(n.person.id);
    for (const child of n.children) down(child);
  };
  if (opts.ancestors) up(opts.ancestors);
  if (opts.descentRoot) down(opts.descentRoot);
  for (const id of opts.extra ?? []) ids.add(id);
  return ids;
}

function collectEdges(opts: {
  ancestors?: AncestorNode | null;
  descentRoot?: DescentNode | null;
  structuralIds: Set<string>;
}): Edge[] {
  const edges: Edge[] = [];
  const seen = new Set<string>();
  const add = (a: string, b: string, kind: Edge["kind"]) => {
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(k)) return;
    seen.add(k);
    edges.push({ a, b, kind });
  };

  const up = (n: AncestorNode | null) => {
    if (!n) return;
    if (n.father) {
      add(n.person.id, n.father.person.id, "parent");
      up(n.father);
    }
    if (n.mother) {
      add(n.person.id, n.mother.person.id, "parent");
      up(n.mother);
    }
    for (const pid of n.parentIds) {
      if (pid !== n.father?.person.id && pid !== n.mother?.person.id) {
        add(n.person.id, pid, "parent2");
      }
    }
    const pair = n.parentIds.filter((id) => opts.structuralIds.has(id));
    if (pair[0] && pair[1]) add(pair[0], pair[1], "spouse");
  };

  const down = (n: DescentNode) => {
    for (const spouse of n.spouses) {
      if (spouse.id !== n.person.id && opts.structuralIds.has(spouse.id)) {
        add(n.person.id, spouse.id, "spouse");
      }
    }
    for (const c of n.children) {
      add(n.person.id, c.person.id, "parent");
      for (const pid of c.parentIds) {
        if (pid !== n.person.id) add(pid, c.person.id, "parent2");
      }
      down(c);
    }
  };

  if (opts.ancestors) up(opts.ancestors);
  if (opts.descentRoot) down(opts.descentRoot);
  return edges;
}

function rectRel(el: HTMLElement, o: DOMRect): Rel {
  const r = el.getBoundingClientRect();
  return {
    left: r.left - o.left,
    right: r.right - o.left,
    top: r.top - o.top,
    bottom: r.bottom - o.top,
    cx: r.left + r.width / 2 - o.left,
    cy: r.top + r.height / 2 - o.top,
    h: r.height,
  };
}

function verticalLink(a: Rel, b: Rel): string {
  const aAbove = a.bottom <= b.top;
  const ay = aAbove ? a.bottom : a.top;
  const by = aAbove ? b.top : b.bottom;
  const m = (ay + by) / 2;
  return `M ${a.cx} ${ay} C ${a.cx} ${m}, ${b.cx} ${m}, ${b.cx} ${by}`;
}

function spouseRoute(
  A: Rel,
  B: Rel,
  obstacles: { el: HTMLElement; r: Rel }[],
  skip: HTMLElement[],
): string {
  const L = A.cx <= B.cx ? A : B;
  const R = A.cx <= B.cx ? B : A;
  const x1 = L.right;
  const y1 = L.cy;
  const x2 = R.left;
  const y2 = R.cy;

  let maxBottom = Math.max(L.bottom, R.bottom);
  for (const { el, r } of obstacles) {
    if (skip.includes(el)) continue;
    const between = r.cx > Math.min(L.cx, R.cx) + 1 && r.cx < Math.max(L.cx, R.cx) - 1;
    const sameRow = Math.abs(r.top - L.top) < L.h + 40;
    if (between && sameRow) maxBottom = Math.max(maxBottom, r.bottom);
  }

  const routeY = maxBottom + 14;
  const r = Math.min(
    12,
    Math.max(4, (x2 - x1) / 2),
    (routeY - Math.min(y1, y2)) / 2,
  );
  return (
    `M ${x1} ${y1}` +
    ` V ${routeY - r}` +
    ` Q ${x1} ${routeY} ${x1 + r} ${routeY}` +
    ` H ${x2 - r}` +
    ` Q ${x2} ${routeY} ${x2} ${routeY - r}` +
    ` V ${y2}`
  );
}

function TreeCanvas({
  edges,
  structuralIds,
  children,
}: {
  edges: Edge[];
  structuralIds: Set<string>;
  children: ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const registry = useRef<Map<string, HTMLElement>>(new Map());
  const [paths, setPaths] = useState<{ d: string; kind: Edge["kind"] }[]>([]);
  const [dots, setDots] = useState<{ x: number; y: number }[]>([]);

  const register = useCallback((id: string, el: HTMLElement | null) => {
    if (el) registry.current.set(id, el);
    else registry.current.delete(id);
  }, []);

  const compute = useCallback(() => {
    const box = containerRef.current;
    if (!box) return;
    const o = box.getBoundingClientRect();

    const relById = new Map<string, { el: HTMLElement; r: Rel }>();
    registry.current.forEach((el, id) => relById.set(id, { el, r: rectRel(el, o) }));
    const obstacles = Array.from(relById.values());

    const lines: { d: string; kind: Edge["kind"] }[] = [];
    const meet = new Map<string, { x: number; y: number; n: number }>();

    for (const e of edges) {
      const A = relById.get(e.a);
      const B = relById.get(e.b);
      if (!A || !B) continue;

      if (e.kind === "spouse") {
        lines.push({
          d: spouseRoute(A.r, B.r, obstacles, [A.el, B.el]),
          kind: "spouse",
        });
      } else {
        lines.push({ d: verticalLink(A.r, B.r), kind: e.kind });
        const child =
          e.kind === "parent2" || A.r.cy >= B.r.cy
            ? e.kind === "parent2"
              ? { id: e.b, r: B.r }
              : { id: e.a, r: A.r }
            : { id: e.b, r: B.r };
        const prev = meet.get(child.id);
        if (prev) prev.n += 1;
        else meet.set(child.id, { x: child.r.cx, y: child.r.top, n: 1 });
      }
    }
    lines.sort((p, q) => (p.kind === "spouse" ? 0 : 1) - (q.kind === "spouse" ? 0 : 1));

    setPaths(lines);
    setDots(
      [...meet.values()]
        .filter((item) => item.n > 1)
        .map(({ x, y }) => ({ x, y })),
    );
  }, [edges]);

  useLayoutEffect(() => {
    compute();
  }, [compute]);

  useEffect(() => {
    const box = containerRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => compute());
    ro.observe(box);
    window.addEventListener("resize", compute);
    void document.fonts?.ready.then(() => compute());
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [compute]);

  return (
    <RegisterCtx.Provider value={register}>
      <StructuralCtx.Provider value={structuralIds}>
        <div ref={containerRef} className="tree-canvas">
          <svg className="tree-lines" aria-hidden="true">
            {paths.map((p, i) => (
              <path
                key={`p${i}`}
                d={p.d}
                className={
                  p.kind === "spouse" ? "tree-line tree-line--spouse" : "tree-line"
                }
              />
            ))}
            {dots.map((d, i) => (
              <circle key={`d${i}`} cx={d.x} cy={d.y} r={3.5} className="tree-junction" />
            ))}
          </svg>
          <div className="tree-flow">{children}</div>
        </div>
      </StructuralCtx.Provider>
    </RegisterCtx.Provider>
  );
}

function TreeCard({
  person,
  current,
  doubledById,
  registerId,
}: {
  person: PersonDTO;
  current?: boolean;
  doubledById?: Record<string, number>;
  registerId?: string;
}) {
  const register = useContext(RegisterCtx);
  const years = personYears(person);
  const pathCount = doubledById?.[person.id];
  return (
    <Link
      ref={(node) => {
        if (registerId) register?.(registerId, node);
      }}
      href={`/people/${person.id}`}
      className={`tree-card ${current ? "tree-card-current" : ""} ${
        person.gender === "male" ? "tree-card-male" : "tree-card-female"
      }`}
    >
      <span className="block font-medium leading-snug">{person.firstName}</span>
      {person.lastName ? (
        <span className="block text-xs text-[var(--muted)]">{person.lastName}</span>
      ) : null}
      {years ? <span className="block text-xs text-[var(--muted)]">{years}</span> : null}
      {pathCount && pathCount > 1 ? (
        <span className="mt-1 inline-block rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--accent)]">
          ×{pathCount}
        </span>
      ) : null}
    </Link>
  );
}

function Couple({
  person,
  spouses,
  current,
  doubledById,
}: {
  person: PersonDTO;
  spouses: PersonDTO[];
  current?: boolean;
  doubledById?: Record<string, number>;
}) {
  const structuralIds = useContext(StructuralCtx);
  const inlineSpouses = spouses.filter((spouse) => !structuralIds.has(spouse.id));
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      <TreeCard
        person={person}
        current={current}
        doubledById={doubledById}
        registerId={person.id}
      />
      {inlineSpouses.map((spouse) => (
        <span key={spouse.id} className="flex items-center gap-1">
          <span className="text-[var(--muted)]">—</span>
          <TreeCard person={spouse} doubledById={doubledById} />
        </span>
      ))}
    </div>
  );
}

function AncestorBranch({
  node,
  doubledById,
}: {
  node: AncestorNode | null;
  doubledById?: Record<string, number>;
}) {
  if (!node) return null;
  const hasParents = node.father || node.mother;
  return (
    <div className="flex flex-col items-center">
      {hasParents ? (
        <div className="flex items-end justify-center gap-4">
          <AncestorBranch node={node.father} doubledById={doubledById} />
          <AncestorBranch node={node.mother} doubledById={doubledById} />
        </div>
      ) : null}
      <div className={hasParents ? "pt-10" : undefined}>
        <TreeCard
          person={node.person}
          doubledById={doubledById}
          registerId={node.person.id}
        />
      </div>
    </div>
  );
}

function DescentList({
  nodes,
  currentId,
  doubledById,
}: {
  nodes: DescentNode[];
  currentId: string;
  doubledById?: Record<string, number>;
}) {
  if (nodes.length === 0) return null;
  return (
    <ul>
      {nodes.map((node) => (
        <li key={node.person.id}>
          <Couple
            person={node.person}
            spouses={node.spouses}
            current={node.person.id === currentId}
            doubledById={doubledById}
          />
          <DescentList
            nodes={node.children}
            currentId={currentId}
            doubledById={doubledById}
          />
        </li>
      ))}
    </ul>
  );
}

export function LineageTree({
  tree,
  doubledById,
}: {
  tree: PersonTree;
  doubledById?: Record<string, number>;
}) {
  const structuralIds = useMemo(
    () =>
      collectStructuralIds({
        ancestors: tree.ancestors,
        descentRoot: tree.descendants,
        extra: tree.siblings.map((sibling) => sibling.id),
      }),
    [tree],
  );
  const edges = useMemo(
    () =>
      collectEdges({
        ancestors: tree.ancestors,
        descentRoot: tree.descendants,
        structuralIds,
      }),
    [tree, structuralIds],
  );
  const hasAncestors = Boolean(tree.ancestors.father || tree.ancestors.mother);
  const hasDescendants = tree.descendants.children.length > 0;

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2">
      <TreeCanvas edges={edges} structuralIds={structuralIds}>
        <div className="inline-flex min-w-full flex-col items-center py-2">
          {hasAncestors ? (
            <div className="flex items-end justify-center gap-6">
              <AncestorBranch node={tree.ancestors.father} doubledById={doubledById} />
              <AncestorBranch node={tree.ancestors.mother} doubledById={doubledById} />
            </div>
          ) : null}

          <div
            className={`flex flex-wrap items-center justify-center gap-2 ${
              hasAncestors ? "pt-10" : ""
            }`}
          >
            {tree.siblings.map((sibling) => (
              <TreeCard
                key={sibling.id}
                person={sibling}
                doubledById={doubledById}
                registerId={sibling.id}
              />
            ))}
            <Couple
              person={tree.person}
              spouses={tree.descendants.spouses}
              current
              doubledById={doubledById}
            />
          </div>

          {hasDescendants ? (
            <div className="tree-flow-descent">
              <DescentList
                nodes={tree.descendants.children}
                currentId={tree.person.id}
                doubledById={doubledById}
              />
            </div>
          ) : null}
        </div>
      </TreeCanvas>
    </div>
  );
}

export function ClanTreeView({
  tree,
  doubledById,
}: {
  tree: ClanTree;
  doubledById?: Record<string, number>;
}) {
  const structuralIds = useMemo(
    () => collectStructuralIds({ descentRoot: tree.root }),
    [tree],
  );
  const edges = useMemo(
    () => collectEdges({ descentRoot: tree.root, structuralIds }),
    [tree, structuralIds],
  );

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2">
      <TreeCanvas edges={edges} structuralIds={structuralIds}>
        <div className="flex flex-col items-center py-2">
          <Couple
            person={tree.root.person}
            spouses={tree.root.spouses}
            current={tree.root.person.id === tree.focus.id}
            doubledById={doubledById}
          />
          {tree.root.children.length > 0 ? (
            <div className="tree-flow-descent">
              <DescentList
                nodes={tree.root.children}
                currentId={tree.focus.id}
                doubledById={doubledById}
              />
            </div>
          ) : null}
        </div>
      </TreeCanvas>
    </div>
  );
}
