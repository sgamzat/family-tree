"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { indexGraph, type IndexedGraph, type KinGraph } from "@/lib/graph";
import { formatFio, normalizeName, personYears, type PersonDTO } from "@/lib/names";
import type { ClanTree, PersonTree } from "@/lib/tree";
import {
  BOX_H,
  BOX_W,
  layoutTree,
  routePath,
  type RouteStep,
  type TreeLayout,
} from "@/lib/tree-layout";
import { allRelatives, closePeople } from "@/lib/tree-views";

const K_MIN = 0.06;
const K_MAX = 1.6;
/** Мельче этого имена в карточках не читаются — прячем, остаются цветные прямоугольники. */
const K_NAMES = 0.55;
/** Годы рождения — только на крупных карточках. */
const K_YEARS = 0.85;
const FLAG_H = 22;

type View = { k: number; ox: number; oy: number };

function clamp(value: number): number {
  return Math.min(K_MAX, Math.max(K_MIN, value));
}

function rows(layout: TreeLayout): Array<{ y: number; year: number | null }> {
  const byY = new Map<number, number[]>();
  for (const box of layout.boxes) {
    const list = byY.get(box.y) ?? [];
    if (box.person.birthYear) list.push(box.person.birthYear);
    byY.set(box.y, list);
  }
  return [...byY.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([y, years]) => {
      if (years.length === 0) return { y, year: null };
      const sorted = [...years].sort((a, b) => a - b);
      return { y, year: Math.round(sorted[Math.floor(sorted.length / 2)] / 5) * 5 };
    });
}

export type TreeMapProps = {
  people: PersonDTO[];
  graph: IndexedGraph;
  focusId: string;
  doubledById?: Record<string, number>;
  /** Путь родства, который нужно нарисовать на карте. */
  path?: RouteStep[] | null;
  /** Режим выбора людей для родства: нажатие отдаёт человека наружу. */
  picking?: boolean;
  /** Кого подписать на дальнем масштабе, кроме «я» и выбранного. */
  marks?: string[];
  onPick?: (person: PersonDTO) => void;
  onAskKinship?: (person: PersonDTO) => void;
};

/**
 * Древо как карта: тянуть мышью или пальцем, масштаб колесом, щипком и
 * кнопками. Имена уменьшаются вместе с карточками, а издалека подписаны
 * только «я», выбранный, найденные и концы пути родства.
 */
export function TreeMap({
  people,
  graph,
  focusId,
  doubledById,
  path = null,
  picking = false,
  marks = [],
  onPick,
  onAskKinship,
}: TreeMapProps) {
  const router = useRouter();
  const frameRef = useRef<HTMLDivElement>(null);
  const layout = useMemo(() => layoutTree(people, graph, focusId), [people, graph, focusId]);
  const boxById = useMemo(
    () => new Map(layout.boxes.map((box) => [box.person.id, box])),
    [layout],
  );
  const rowMarks = useMemo(() => rows(layout), [layout]);
  const pathD = useMemo(() => (path ? routePath(layout, path) : null), [layout, path]);
  const onPath = useMemo(() => new Set(path?.map((step) => step.id) ?? []), [path]);

  const [view, setView] = useState<View>({ k: 1, ox: 0, oy: 0 });
  const viewRef = useRef(view);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [hitIndex, setHitIndex] = useState(0);

  const hits = useMemo(() => {
    const needle = normalizeName(query);
    if (needle.length < 2) return [];
    return layout.boxes
      .filter((box) =>
        [box.person.firstName, box.person.lastName, ...box.person.aliases].some((name) =>
          normalizeName(name).startsWith(needle),
        ),
      )
      .map((box) => box.person.id);
  }, [layout, query]);

  // --- Размер окна карты ------------------------------------------------------
  useLayoutEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const measure = () => setSize({ w: frame.clientWidth, h: frame.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(frame);
    return () => observer.disconnect();
  }, []);

  const centerOn = useCallback(
    (id: string, k?: number) => {
      const box = boxById.get(id);
      const frame = frameRef.current;
      if (!box || !frame) return;
      const nk = clamp(k ?? viewRef.current.k);
      setView({
        k: nk,
        ox: frame.clientWidth / 2 - (box.x + BOX_W / 2) * nk,
        oy: frame.clientHeight / 2 - (box.y + BOX_H / 2) * nk,
      });
    },
    [boxById],
  );

  const fitBox = useCallback((x0: number, y0: number, x1: number, y1: number, pad: number) => {
    const frame = frameRef.current;
    if (!frame) return;
    const w = frame.clientWidth;
    const h = frame.clientHeight;
    const nk = clamp(Math.min(1, (w - pad * 2) / (x1 - x0), (h - pad * 2) / (y1 - y0)));
    setView({
      k: nk,
      ox: (w - (x1 - x0) * nk) / 2 - x0 * nk,
      oy: (h - (y1 - y0) * nk) / 2 - y0 * nk,
    });
  }, []);

  const fitAll = useCallback(() => {
    fitBox(0, 0, layout.width, layout.height, 12);
  }, [fitBox, layout]);

  const fitPath = useCallback(() => {
    if (!path) return;
    const boxes = path
      .map((step) => boxById.get(step.id))
      .filter((box): box is TreeLayout["boxes"][number] => Boolean(box));
    if (boxes.length === 0) return;
    fitBox(
      Math.min(...boxes.map((box) => box.x)),
      Math.min(...boxes.map((box) => box.y)) - FLAG_H,
      Math.max(...boxes.map((box) => box.x + BOX_W)),
      Math.max(...boxes.map((box) => box.y + BOX_H)),
      40,
    );
  }, [boxById, fitBox, path]);

  // Новая схема (другая вкладка, другой человек) — встаём на «я».
  useLayoutEffect(() => {
    setSelectedId(null);
    centerOn(focusId, 1);
  }, [layout, focusId, centerOn]);

  // Новый путь родства — показываем его целиком.
  useEffect(() => {
    if (pathD) fitPath();
  }, [pathD, fitPath]);

  // --- Перетаскивание и щипок -------------------------------------------------
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{
    start: View;
    x: number;
    y: number;
    dist: number;
    moved: boolean;
  } | null>(null);
  const suppressClick = useRef(false);

  const beginGesture = () => {
    const points = [...pointers.current.values()];
    const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    const dist =
      points.length > 1 ? Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) : 0;
    gesture.current = {
      start: viewRef.current,
      x: cx,
      y: cy,
      dist,
      moved: gesture.current?.moved ?? false,
    };
  };

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("[data-map-ui]")) return;
    if (pointers.current.size === 0) {
      suppressClick.current = false;
      gesture.current = null;
    }
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    beginGesture();
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId) || !gesture.current) return;
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    const g = gesture.current;
    const points = [...pointers.current.values()];
    const cx = points.reduce((sum, p) => sum + p.x, 0) / points.length;
    const cy = points.reduce((sum, p) => sum + p.y, 0) / points.length;
    if (!g.moved && Math.abs(cx - g.x) + Math.abs(cy - g.y) < 6 && points.length < 2) return;
    if (!g.moved) {
      g.moved = true;
      suppressClick.current = true;
      frameRef.current?.setPointerCapture(event.pointerId);
    }
    const rect = frameRef.current!.getBoundingClientRect();
    let k = g.start.k;
    if (points.length > 1 && g.dist > 0) {
      const dist = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      k = clamp(g.start.k * (dist / g.dist));
    }
    const ax = g.x - rect.left;
    const ay = g.y - rect.top;
    setView({
      k,
      ox: ax - (ax - g.start.ox) * (k / g.start.k) + (cx - g.x),
      oy: ay - (ay - g.start.oy) * (k / g.start.k) + (cy - g.y),
    });
  };

  const onPointerEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.delete(event.pointerId);
    if (pointers.current.size > 0) beginGesture();
  };

  // Колесо мыши масштабирует относительно курсора (обработчик не «пассивный»).
  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;
    const onWheel = (event: WheelEvent) => {
      if ((event.target as HTMLElement).closest("[data-map-ui]")) return;
      event.preventDefault();
      const rect = frame.getBoundingClientRect();
      const mx = event.clientX - rect.left;
      const my = event.clientY - rect.top;
      const current = viewRef.current;
      const k = clamp(current.k * Math.exp(-event.deltaY * 0.0015));
      setView({
        k,
        ox: mx - (mx - current.ox) * (k / current.k),
        oy: my - (my - current.oy) * (k / current.k),
      });
    };
    frame.addEventListener("wheel", onWheel, { passive: false });
    return () => frame.removeEventListener("wheel", onWheel);
  }, []);

  const zoomBy = (factor: number) => {
    const current = viewRef.current;
    const k = clamp(current.k * factor);
    const mx = size.w / 2;
    const my = size.h / 2;
    setView({
      k,
      ox: mx - (mx - current.ox) * (k / current.k),
      oy: my - (my - current.oy) * (k / current.k),
    });
  };

  const findNext = () => {
    if (hits.length === 0) return;
    const id = hits[hitIndex % hits.length];
    setHitIndex((value) => value + 1);
    if (!picking) setSelectedId(id);
    centerOn(id, Math.max(viewRef.current.k, 0.9));
  };

  // --- Карточки (не зависят от масштаба — не перерисовываются при движении) ---
  const hitSet = useMemo(() => new Set(hits), [hits]);
  const nodes = useMemo(
    () =>
      layout.boxes.map((box) => {
        const person = box.person;
        const years = personYears(person);
        const pathCount = doubledById?.[person.id];
        const isSelected = person.id === selectedId && !box.current;
        const dim = Boolean(path) && !onPath.has(person.id);
        return (
          <Link
            key={person.id}
            href={`/people/${person.id}`}
            data-person={person.id}
            aria-label={[formatFio(person) || person.firstName, years].filter(Boolean).join(", ")}
            aria-pressed={isSelected}
            title={[person.firstName, years].filter(Boolean).join(", ")}
            className={[
              "tree-node",
              person.gender === "male" ? "tree-node-male" : "tree-node-female",
              person.inCensus1886 ? "tree-node-census" : "",
              box.current ? "tree-node-current" : "",
              isSelected ? "tree-node-selected" : "",
              hitSet.has(person.id) ? "tree-node-found" : "",
              path && onPath.has(person.id) ? "tree-node-onpath" : "",
              dim ? "is-dim" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            style={{ left: box.x, top: box.y }}
            onClick={(event) => {
              event.preventDefault();
              if (suppressClick.current) return;
              if (picking && onPick) {
                onPick(person);
                return;
              }
              if (box.current) {
                setSelectedId(null);
                return;
              }
              if (isSelected) {
                router.push(`/people/${person.id}`);
                return;
              }
              setSelectedId(person.id);
            }}
          >
            {person.inCensus1886 ? (
              <span className="tree-node-stamp" title="Записан в переписи 1886 года">
                1886
              </span>
            ) : null}
            <span className="tree-node-name">{person.firstName}</span>
            {years ? <span className="tree-node-years">{years}</span> : null}
            {pathCount && pathCount > 1 ? (
              <span className="tree-node-mark">×{pathCount}</span>
            ) : null}
          </Link>
        );
      }),
    [layout, doubledById, selectedId, hitSet, path, onPath, picking, onPick, router],
  );

  const lines = useMemo(
    () => (
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
        {pathD ? (
          <>
            <path d={pathD} className="tree-kin-halo" />
            <path d={pathD} className="tree-kin-line" />
          </>
        ) : null}
      </svg>
    ),
    [layout, pathD],
  );

  // --- Подписи-флажки на дальнем масштабе --------------------------------------
  const far = view.k < K_NAMES;
  const flags = useMemo(() => {
    if (!far) return [];
    const wanted = [
      { id: focusId, kind: "me" },
      ...(selectedId ? [{ id: selectedId, kind: "selected" }] : []),
      ...marks.map((id) => ({ id, kind: "kin" })),
      ...hits.map((id) => ({ id, kind: "found" })),
    ];
    const placed: Array<[number, number, number, number]> = [];
    const out: Array<{ id: string; kind: string; x: number; y: number; text: string }> = [];
    const seen = new Set<string>();
    for (const item of wanted) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      const box = boxById.get(item.id);
      if (!box) continue;
      const x = (box.x + BOX_W / 2) * view.k + view.ox;
      const y = box.y * view.k + view.oy;
      if (x < -80 || x > size.w + 80 || y < -40 || y > size.h + 40) continue;
      const text = item.kind === "me" ? `${box.person.firstName} · вы` : box.person.firstName;
      const width = text.length * 7.4 + 18;
      const rect: [number, number, number, number] = [x - width / 2, y - FLAG_H - 6, width, FLAG_H];
      if (
        placed.some(
          (o) =>
            rect[0] < o[0] + o[2] + 3 &&
            o[0] < rect[0] + rect[2] + 3 &&
            rect[1] < o[1] + o[3] &&
            o[1] < rect[1] + rect[3],
        )
      ) {
        continue;
      }
      placed.push(rect);
      out.push({ id: item.id, kind: item.kind, x, y, text });
    }
    return out;
  }, [far, focusId, selectedId, marks, hits, boxById, view, size]);

  // Метки поколений слева; если ряды сошлись издалека — показываем через одну.
  const rulerMarks = useMemo(() => {
    const out: Array<{ key: number; y: number; year: number }> = [];
    let lastY = -Infinity;
    for (const row of rowMarks) {
      if (!row.year) continue;
      const y = (row.y + BOX_H / 2) * view.k + view.oy;
      if (y < 12 || y > size.h - 12 || y - lastY < 24) continue;
      out.push({ key: row.y, y, year: row.year });
      lastY = y;
    }
    return out;
  }, [rowMarks, view, size]);

  const selected =
    selectedId && !picking ? (boxById.get(selectedId)?.person ?? null) : null;
  const focusPerson = boxById.get(focusId)?.person ?? null;

  return (
    <div
      ref={frameRef}
      className={`tree-map ${far ? "is-far" : ""} ${view.k < K_YEARS ? "no-years" : ""} ${
        picking ? "is-picking" : ""
      }`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
    >
      <div
        className="tree-world"
        style={{
          width: layout.width,
          height: layout.height,
          transform: `translate(${view.ox}px, ${view.oy}px) scale(${view.k})`,
        }}
      >
        {lines}
        {nodes}
      </div>

      <div className="tree-flags" aria-hidden="true">
        {flags.map((flag) => (
          <span
            key={flag.id}
            className={`tree-flag tree-flag-${flag.kind}`}
            style={{ left: flag.x, top: flag.y - 6 }}
          >
            {flag.text}
          </span>
        ))}
      </div>

      <div className="tree-ruler" aria-hidden="true">
        {rulerMarks.map((mark) => (
          <span key={mark.key} className="tree-ruler-mark" style={{ top: mark.y }}>
            ≈{mark.year}
          </span>
        ))}
      </div>

      <div className="tree-find" data-map-ui>
        <label className="tree-find-field">
          <span className="sr-only">Найти в древе</span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="M20 20l-3.5-3.5" />
          </svg>
          <input
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            spellCheck={false}
            placeholder="Найти в древе"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setHitIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;
              event.preventDefault();
              findNext();
            }}
          />
        </label>
        {normalizeName(query).length >= 2 ? (
          <p className="tree-find-note">
            {hits.length === 0
              ? "Такого имени нет на этой схеме"
              : hits.length === 1
                ? "Найден 1 — Enter, чтобы перейти"
                : `Найдено ${hits.length} — Enter переходит к следующему`}
          </p>
        ) : null}
      </div>

      <div className="tree-zoom" role="group" aria-label="Масштаб древа" data-map-ui>
        <button type="button" aria-label="Приблизить" onClick={() => zoomBy(1.4)}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
        <button type="button" aria-label="Отдалить" onClick={() => zoomBy(1 / 1.4)}>
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
          aria-label={pathD ? "Показать путь родства" : "Вернуться ко мне"}
          onClick={() => (pathD ? fitPath() : centerOn(focusId, Math.max(view.k, 1)))}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
        </button>
      </div>

      {selected ? (
        <div className="tree-pick" role="region" aria-label="Выбранный человек" data-map-ui>
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
            {onAskKinship && focusPerson ? (
              <button
                type="button"
                className="tree-pick-more"
                onClick={() => onAskKinship(selected)}
              >
                Кем приходится
              </button>
            ) : null}
            <button
              type="button"
              className="tree-pick-close"
              aria-label="Снять выбор"
              onClick={() => setSelectedId(null)}
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

/* Совместимость со старыми вызовами (components/tree-explorer.tsx). */

function useIndexed(graph?: KinGraph): IndexedGraph | null {
  return useMemo(() => (graph ? indexGraph(graph) : null), [graph]);
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
  const indexed = useIndexed(graph);
  const people = useMemo(
    () => (indexed ? closePeople(indexed, tree.person.id) : [tree.person]),
    [indexed, tree],
  );
  if (!indexed) return null;
  return (
    <TreeMap people={people} graph={indexed} focusId={tree.person.id} doubledById={doubledById} />
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
  const indexed = useIndexed(graph);
  const people = useMemo(
    () => (indexed ? allRelatives(indexed, tree.focus.id) : [tree.focus]),
    [indexed, tree],
  );
  if (!indexed) return null;
  return (
    <TreeMap people={people} graph={indexed} focusId={tree.focus.id} doubledById={doubledById} />
  );
}
