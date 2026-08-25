"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ClanTreeView, LineageTree } from "@/components/family-tree";
import type { KinGraph } from "@/lib/graph";
import {
  DOWN_DEPTHS,
  UP_DEPTHS,
  buildClanTree,
  buildPersonTree,
  clanCaption,
  clanHasRelatives,
  maxDown,
  maxUp,
  paternalRootId,
  treeHasRelatives,
  type TreeMode,
} from "@/lib/tree";

function DepthChips({
  label,
  options,
  value,
  max,
  allLabel,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: number; label: string }>;
  value: number;
  max: number;
  allLabel: string;
  onChange: (value: number) => void;
}) {
  if (max <= 0) return null;

  const chips = [
    ...options.filter((option) => option.value <= max),
    ...(max > 4 ? [{ value: max, label: allLabel }] : []),
  ];

  return (
    <div className="grid gap-1.5">
      <span className="text-xs font-medium uppercase tracking-wide text-[var(--muted)]">
        {label}
      </span>
      <div className="flex flex-wrap gap-1.5">
        {chips.map((option) => (
          <button
            key={option.label}
            type="button"
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              value === option.value
                ? "bg-[var(--accent)] text-white"
                : "bg-white text-[var(--ink)] ring-1 ring-[var(--line)]"
            }`}
            onClick={() => onChange(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function TreeExplorer({
  graph,
  personId,
}: {
  graph: KinGraph;
  personId: string;
}) {
  const upMax = maxUp(graph, personId);
  const downMax = maxDown(graph, personId);
  const rootId = paternalRootId(graph, personId);
  const clanDownMax = maxDown(graph, rootId);

  const [mode, setMode] = useState<TreeMode>("line");
  const [up, setUp] = useState(Math.min(2, upMax));
  const [down, setDown] = useState(Math.min(2, downMax));
  const [clanDown, setClanDown] = useState(Math.min(4, clanDownMax) || clanDownMax);

  const lineTree = useMemo(
    () => buildPersonTree(graph, personId, { up, down }),
    [graph, personId, up, down],
  );
  const clanTree = useMemo(
    () => buildClanTree(graph, personId, clanDown),
    [graph, personId, clanDown],
  );

  const hasAnything =
    (lineTree && treeHasRelatives(lineTree)) ||
    (clanTree && clanHasRelatives(clanTree));

  if (!hasAnything) return null;

  return (
    <section className="grid gap-3">
      <div className="flex items-end justify-between gap-3">
        <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--muted)]">
          Древо
        </h2>
        <Link
          href={`/kinship?from=${personId}`}
          className="text-sm font-medium text-[var(--accent)]"
        >
          Кем приходится
        </Link>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <button
          type="button"
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            mode === "line"
              ? "bg-[var(--accent)] text-white"
              : "bg-white ring-1 ring-[var(--line)]"
          }`}
          onClick={() => setMode("line")}
        >
          Предки и потомки
        </button>
        <button
          type="button"
          className={`rounded-full px-3 py-1.5 text-sm font-medium ${
            mode === "clan"
              ? "bg-[var(--accent)] text-white"
              : "bg-white ring-1 ring-[var(--line)]"
          }`}
          onClick={() => setMode("clan")}
        >
          Род
        </button>
      </div>

      {mode === "line" ? (
        <div className="grid gap-3">
          <DepthChips
            label="Вверх"
            options={UP_DEPTHS}
            value={up}
            max={upMax}
            allLabel="Все предки"
            onChange={setUp}
          />
          <DepthChips
            label="Вниз"
            options={DOWN_DEPTHS}
            value={down}
            max={downMax}
            allLabel="Все потомки"
            onChange={setDown}
          />
        </div>
      ) : (
        <div className="grid gap-2">
          {clanTree ? (
            <p className="text-sm text-[var(--muted)]">{clanCaption(clanTree)}</p>
          ) : null}
          <DepthChips
            label="Глубина рода"
            options={DOWN_DEPTHS}
            value={clanDown}
            max={clanDownMax}
            allLabel="Весь род"
            onChange={setClanDown}
          />
        </div>
      )}

      {mode === "line" && lineTree ? <LineageTree tree={lineTree} /> : null}
      {mode === "clan" && clanTree ? <ClanTreeView tree={clanTree} /> : null}

      <p className="text-xs text-[var(--muted)]">
        Стрелка вниз — к детям. Выделен тот, кого вы открыли.
      </p>
    </section>
  );
}
