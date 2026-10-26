import type { IndexedGraph } from "@/lib/graph";
import type { PersonDTO } from "@/lib/names";

/**
 * Раскладка древа по поколениям.
 *
 * 1. Поколения считаются по связям: ребёнок всегда ниже родителей, супруги
 *    (по записи о браке или по общим детям) — в одном ряду.
 * 2. Супруги образуют «пару» — неделимый блок в ряду. Каждый человек рисуется
 *    один раз, даже при близкородственных браках.
 * 3. Порядок блоков в ряду подбирается так, чтобы линии пересекались реже.
 * 4. Места в ряду выбираются так, чтобы родители стояли над детьми, но
 *    между блоками всегда остаётся промежуток: карточки не наезжают.
 * 5. У каждой семьи своя горизонталь в промежутке между рядами: если
 *    горизонтали разных семей перекрываются, они идут на разной высоте.
 */

export const BOX_W = 128;
export const BOX_H = 58;
export const PAIR_GAP = 24;
const UNIT_GAP = 36;
const PAD = 24;
const TOP_PAD = 16;
const BUS_TOP = 22;
const LANE_STEP = 14;
const LANE_CLEAR = 14;
const MIN_ROW_GAP = 52;
const ORDER_SWEEPS = 8;
const PLACE_SWEEPS = 24;

export type PlacedBox = {
  person: PersonDTO;
  x: number;
  y: number;
  current: boolean;
};

export type TreeLine = { d: string; kind: "parent" | "spouse" };

export type TreeLayout = {
  boxes: PlacedBox[];
  lines: TreeLine[];
  width: number;
  height: number;
};

type Unit = {
  index: number;
  members: string[];
  row: number;
  x: number;
};

type Family = {
  parents: string[];
  children: string[];
  unit: Unit;
  lane: number;
};

const STEP = BOX_W + PAIR_GAP;

function r1(value: number): number {
  return Math.round(value * 10) / 10;
}

function unitWidth(unit: Unit): number {
  return unit.members.length * BOX_W + (unit.members.length - 1) * PAIR_GAP;
}

function mean(values: number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/** Изотоническая регрессия: ближайшие к желаемым неубывающие значения. */
function isotonic(targets: number[], weights: number[]): number[] {
  const blocks: Array<{ value: number; weight: number; count: number }> = [];
  targets.forEach((target, index) => {
    blocks.push({ value: target, weight: weights[index], count: 1 });
    while (blocks.length > 1) {
      const last = blocks[blocks.length - 1];
      const prev = blocks[blocks.length - 2];
      if (prev.value <= last.value) break;
      const weight = prev.weight + last.weight;
      blocks.splice(blocks.length - 2, 2, {
        value: (prev.value * prev.weight + last.value * last.weight) / weight,
        weight,
        count: prev.count + last.count,
      });
    }
  });
  return blocks.flatMap((block) => Array<number>(block.count).fill(block.value));
}

export function layoutTree(
  people: PersonDTO[],
  graph: IndexedGraph,
  focusId: string,
): TreeLayout {
  const byId = new Map(people.map((person) => [person.id, person]));
  const ids = [...byId.keys()];
  if (ids.length === 0) {
    return { boxes: [], lines: [], width: BOX_W + PAD * 2, height: BOX_H + PAD * 2 };
  }
  const visible = (id: string) => byId.has(id);
  const parentsOf = (id: string) =>
    [...new Set(graph.parentsOf.get(id) ?? [])].filter(
      (parentId) => parentId !== id && visible(parentId),
    );

  // --- Супруги: запись о браке или общие дети -------------------------------
  const spouses = new Map<string, Set<string>>();
  for (const id of ids) spouses.set(id, new Set());
  const marry = (a: string, b: string) => {
    if (a === b || !visible(a) || !visible(b)) return;
    spouses.get(a)!.add(b);
    spouses.get(b)!.add(a);
  };
  for (const id of ids) {
    for (const spouseId of graph.spousesOf.get(id) ?? []) marry(id, spouseId);
  }
  for (const parentIds of graph.parentsOf.values()) {
    const shown = parentIds.filter(visible);
    for (let i = 0; i < shown.length; i += 1) {
      for (let j = i + 1; j < shown.length; j += 1) marry(shown[i], shown[j]);
    }
  }

  // --- Блоки: связные группы супругов -----------------------------------------
  const root = new Map<string, string>(ids.map((id) => [id, id]));
  const find = (id: string): string => {
    let cursor = id;
    while (root.get(cursor) !== cursor) cursor = root.get(cursor)!;
    root.set(id, cursor);
    return cursor;
  };
  for (const [id, set] of spouses) {
    for (const other of set) {
      const a = find(id);
      const b = find(other);
      if (a !== b) root.set(a, b);
    }
  }
  const groups = new Map<string, string[]>();
  for (const id of ids) {
    const key = find(id);
    groups.set(key, [...(groups.get(key) ?? []), id]);
  }
  const units: Unit[] = [...groups.values()].map((members, index) => ({
    index,
    members: arrangeMembers(members, spouses, byId),
    row: 0,
    x: 0,
  }));
  const unitOf = new Map<string, Unit>();
  for (const unit of units) for (const id of unit.members) unitOf.set(id, unit);

  // --- Поколения ------------------------------------------------------------
  const upUnits = units.map(() => new Set<number>());
  const downUnits = units.map(() => new Set<number>());
  for (const id of ids) {
    const child = unitOf.get(id)!;
    for (const parentId of parentsOf(id)) {
      const parent = unitOf.get(parentId)!;
      if (parent === child) continue;
      upUnits[child.index].add(parent.index);
      downUnits[parent.index].add(child.index);
    }
  }
  const gen = units.map(() => 0);
  for (let pass = 0; pass <= units.length; pass += 1) {
    let changed = false;
    for (const unit of units) {
      for (const up of upUnits[unit.index]) {
        if (gen[unit.index] < gen[up] + 1 && gen[up] + 1 <= units.length) {
          gen[unit.index] = gen[up] + 1;
          changed = true;
        }
      }
    }
    if (!changed) break;
  }
  // Пары без родителей на схеме опускаются к своим детям.
  for (let pass = 0; pass <= units.length; pass += 1) {
    let changed = false;
    for (const unit of units) {
      if (upUnits[unit.index].size > 0 || downUnits[unit.index].size === 0) continue;
      const below = Math.min(...[...downUnits[unit.index]].map((down) => gen[down])) - 1;
      if (below > gen[unit.index]) {
        gen[unit.index] = below;
        changed = true;
      }
    }
    if (!changed) break;
  }
  const minGen = Math.min(...gen);
  for (const unit of units) unit.row = gen[unit.index] - minGen;
  const rowCount = Math.max(...units.map((unit) => unit.row)) + 1;

  // --- Семьи: родители одного ребёнка ------------------------------------------
  const families = new Map<string, Family>();
  const familyOfChild = new Map<string, Family>();
  for (const id of ids) {
    const parents = parentsOf(id).filter((parentId) => unitOf.get(parentId) !== unitOf.get(id));
    if (parents.length === 0) continue;
    const key = [...parents].sort().join("+");
    let family = families.get(key);
    if (!family) {
      family = { parents, children: [], unit: unitOf.get(parents[0])!, lane: 0 };
      families.set(key, family);
    }
    family.children.push(id);
    familyOfChild.set(id, family);
  }
  const familiesOfUnit = new Map<Unit, Family[]>();
  for (const family of families.values()) {
    familiesOfUnit.set(family.unit, [...(familiesOfUnit.get(family.unit) ?? []), family]);
  }

  const birth = (id: string) => byId.get(id)?.birthYear ?? 9999;
  for (const family of families.values()) {
    family.children.sort((a, b) => birth(a) - birth(b));
  }

  // --- Ряды и их порядок --------------------------------------------------------
  const rows: Unit[][] = Array.from({ length: rowCount }, () => []);
  for (const unit of units) rows[unit.row].push(unit);

  const memberIndex = (id: string) => unitOf.get(id)!.members.indexOf(id);
  const centerOf = (id: string) => unitOf.get(id)!.x + memberIndex(id) * STEP + BOX_W / 2;
  const anchorOf = (family: Family) => {
    if (family.parents.length === 2) {
      const [a, b] = family.parents.map(memberIndex);
      if (Math.abs(a - b) === 1) return family.unit.x + Math.max(a, b) * STEP - PAIR_GAP / 2;
    }
    return mean(family.parents.map(centerOf));
  };
  const childCenters = (family: Family) => family.children.map(centerOf);

  const pack = (row: Unit[]) => {
    const total = row.reduce((sum, unit) => sum + unitWidth(unit), 0) + UNIT_GAP * (row.length - 1);
    let cursor = -total / 2;
    for (const unit of row) {
      unit.x = cursor;
      cursor += unitWidth(unit) + UNIT_GAP;
    }
  };

  // Кто из супругов левее: тот, чьи родители левее.
  const orient = (unit: Unit, side: "up" | "down") => {
    if (unit.members.length < 2) return;
    const wish = (id: string): number | null => {
      if (side === "up") {
        const family = familyOfChild.get(id);
        return family ? anchorOf(family) : null;
      }
      const own = (familiesOfUnit.get(unit) ?? []).filter((family) =>
        family.parents.includes(id),
      );
      const kids = own.flatMap(childCenters);
      return kids.length ? mean(kids) : null;
    };
    const cost = (order: string[]) =>
      order.reduce((sum, id, index) => {
        const target = wish(id);
        if (target === null) return sum;
        return sum + Math.abs(unit.x + index * STEP + BOX_W / 2 - target);
      }, 0);
    const reversed = [...unit.members].reverse();
    if (cost(reversed) + 0.5 < cost(unit.members)) unit.members = reversed;
  };

  const sortRow = (row: Unit[], side: "up" | "down") => {
    const keyed = row.map((unit, position) => {
      const targets: number[] = [];
      if (side === "up") {
        for (const id of unit.members) {
          const family = familyOfChild.get(id);
          if (family) targets.push(anchorOf(family));
        }
      } else {
        for (const family of familiesOfUnit.get(unit) ?? []) {
          targets.push(...childCenters(family));
        }
      }
      const key = targets.length ? mean(targets) : unit.x + unitWidth(unit) / 2;
      return { unit, key, position };
    });
    keyed.sort((a, b) => a.key - b.key || a.position - b.position);
    row.splice(0, row.length, ...keyed.map((item) => item.unit));
    pack(row);
    for (const unit of row) orient(unit, side);
  };

  const crossings = () => {
    let total = 0;
    for (let r = 0; r < rowCount - 1; r += 1) {
      const edges: Array<[number, number]> = [];
      for (const unit of rows[r]) {
        for (const family of familiesOfUnit.get(unit) ?? []) {
          const anchor = anchorOf(family);
          for (const center of childCenters(family)) edges.push([anchor, center]);
        }
      }
      for (let i = 0; i < edges.length; i += 1) {
        for (let j = i + 1; j < edges.length; j += 1) {
          const [a1, c1] = edges[i];
          const [a2, c2] = edges[j];
          if ((a1 - a2) * (c1 - c2) < 0) total += 1;
        }
      }
    }
    return total;
  };

  rows[0].sort(
    (a, b) =>
      Math.min(...a.members.map(birth)) - Math.min(...b.members.map(birth)) ||
      a.index - b.index,
  );
  pack(rows[0]);
  for (let r = 1; r < rowCount; r += 1) sortRow(rows[r], "up");

  const snapshot = () => rows.map((row) => row.map((unit) => ({ unit, members: [...unit.members] })));
  let best = snapshot();
  let bestCrossings = crossings();
  for (let sweep = 0; sweep < ORDER_SWEEPS && bestCrossings > 0; sweep += 1) {
    for (let r = rowCount - 2; r >= 0; r -= 1) sortRow(rows[r], "down");
    for (let r = 1; r < rowCount; r += 1) sortRow(rows[r], "up");
    const now = crossings();
    if (now < bestCrossings) {
      bestCrossings = now;
      best = snapshot();
    }
  }
  best.forEach((row, r) => {
    rows[r] = row.map(({ unit, members }) => {
      unit.members = members;
      return unit;
    });
    pack(rows[r]);
  });

  // --- Места в ряду: родители над детьми, без наложений ------------------------
  const place = (row: Unit[], upWeight: number, downWeight: number) => {
    const targets: number[] = [];
    const weights: number[] = [];
    let offset = 0;
    for (const unit of row) {
      const wishes: Array<[number, number]> = [];
      unit.members.forEach((id, index) => {
        const family = familyOfChild.get(id);
        if (family) wishes.push([anchorOf(family) - index * STEP - BOX_W / 2, upWeight]);
      });
      for (const family of familiesOfUnit.get(unit) ?? []) {
        const anchorOffset = anchorOf(family) - unit.x;
        wishes.push([mean(childCenters(family)) - anchorOffset, downWeight]);
      }
      const weight = wishes.reduce((sum, [, w]) => sum + w, 0);
      const desired = weight
        ? wishes.reduce((sum, [value, w]) => sum + value * w, 0) / weight
        : unit.x;
      targets.push(desired - offset);
      weights.push(weight || 0.05);
      offset += unitWidth(unit) + UNIT_GAP;
    }
    const solved = isotonic(targets, weights);
    let shift = 0;
    row.forEach((unit, index) => {
      unit.x = solved[index] + shift;
      shift += unitWidth(unit) + UNIT_GAP;
    });
  };

  for (let sweep = 0; sweep < PLACE_SWEEPS; sweep += 1) {
    for (let r = 1; r < rowCount; r += 1) place(rows[r], 1, 0.5);
    for (let r = rowCount - 2; r >= 0; r -= 1) place(rows[r], 0.5, 1);
  }
  for (let r = 1; r < rowCount; r += 1) place(rows[r], 1, 0.5);

  const minX = Math.min(...units.map((unit) => unit.x));
  for (const unit of units) unit.x = r1(unit.x - minX + PAD);

  // --- Горизонтали семей ----------------------------------------------------------
  const spanOf = (family: Family): [number, number] => {
    const xs = [...topsOf(family).map((top) => top.x), ...childCenters(family)];
    return [Math.min(...xs), Math.max(...xs)];
  };
  const adjacentCouple = (family: Family) => {
    if (family.parents.length !== 2) return false;
    const [a, b] = family.parents.map(memberIndex);
    return Math.abs(a - b) === 1;
  };
  const rowY: number[] = [];
  const topsOf = (family: Family): Array<{ x: number; y: number }> => {
    const y = rowY[family.unit.row] ?? 0;
    if (adjacentCouple(family)) return [{ x: anchorOf(family), y: y + BOX_H / 2 }];
    return family.parents.map((id) => ({ x: centerOf(id), y: y + BOX_H }));
  };

  const lanesInGap: number[] = Array<number>(rowCount).fill(0);
  for (let r = 0; r < rowCount; r += 1) {
    const inGap = [...families.values()]
      .filter((family) => family.unit.row === r)
      .map((family) => ({ family, span: spanOf(family) }))
      .sort((a, b) => a.span[0] - b.span[0] || a.span[1] - b.span[1]);
    const laneEnds: number[] = [];
    for (const { family, span } of inGap) {
      let lane = laneEnds.findIndex((end) => end + LANE_CLEAR < span[0]);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(span[1]);
      } else {
        laneEnds[lane] = span[1];
      }
      family.lane = lane;
    }
    lanesInGap[r] = laneEnds.length;
  }

  let y = TOP_PAD;
  for (let r = 0; r < rowCount; r += 1) {
    rowY[r] = y;
    const lanes = lanesInGap[r];
    const gap = Math.max(MIN_ROW_GAP, BUS_TOP * 2 + Math.max(0, lanes - 1) * LANE_STEP);
    y += BOX_H + gap;
  }

  // --- Итог: карточки и линии -------------------------------------------------------
  const boxes: PlacedBox[] = [];
  const lines: TreeLine[] = [];
  for (const unit of units) {
    unit.members.forEach((id, index) => {
      boxes.push({
        person: byId.get(id)!,
        x: r1(unit.x + index * STEP),
        y: rowY[unit.row],
        current: id === focusId,
      });
      const next = unit.members[index + 1];
      if (next && spouses.get(id)?.has(next)) {
        const left = unit.x + index * STEP + BOX_W;
        const midY = rowY[unit.row] + BOX_H / 2;
        lines.push({ d: `M ${r1(left)} ${r1(midY)} H ${r1(left + PAIR_GAP)}`, kind: "spouse" });
      }
    });
  }

  for (const family of families.values()) {
    const busY = rowY[family.unit.row] + BOX_H + BUS_TOP + family.lane * LANE_STEP;
    const tops = topsOf(family);
    // Один ребёнок почти точно под парой — прямая линия без ступеньки.
    if (family.children.length === 1 && tops.length === 1) {
      const childId = family.children[0];
      const childX = centerOf(childId);
      if (Math.abs(childX - tops[0].x) <= 8) {
        const childTop = rowY[unitOf.get(childId)!.row];
        lines.push({
          d: `M ${r1(childX)} ${r1(tops[0].y)} V ${r1(childTop)}`,
          kind: "parent",
        });
        continue;
      }
    }
    const parts = tops.map((top) => `M ${r1(top.x)} ${r1(top.y)} V ${r1(busY)}`);
    const [left, right] = spanOf(family);
    if (right - left > 1) parts.push(`M ${r1(left)} ${r1(busY)} H ${r1(right)}`);
    for (const childId of family.children) {
      const childTop = rowY[unitOf.get(childId)!.row];
      parts.push(`M ${r1(centerOf(childId))} ${r1(busY)} V ${r1(childTop)}`);
    }
    lines.push({ d: parts.join(" "), kind: "parent" });
  }

  const width = Math.max(...boxes.map((box) => box.x + BOX_W)) + PAD;
  const height = Math.max(...boxes.map((box) => box.y + BOX_H)) + PAD;
  return { boxes, lines, width: r1(width), height: r1(height) };
}

/** Порядок людей внутри пары: цепочка супругов, женщина слева у простой пары. */
function arrangeMembers(
  members: string[],
  spouses: Map<string, Set<string>>,
  byId: Map<string, PersonDTO>,
): string[] {
  if (members.length === 1) return members;
  if (members.length === 2) {
    const [a, b] = members;
    return byId.get(a)?.gender === "male" && byId.get(b)?.gender === "female" ? [b, a] : [a, b];
  }
  const inGroup = new Set(members);
  const degree = (id: string) => [...(spouses.get(id) ?? [])].filter((other) => inGroup.has(other)).length;
  const isPath = members.every((id) => degree(id) <= 2) && members.some((id) => degree(id) === 1);
  if (isPath) {
    const start = members.find((id) => degree(id) === 1)!;
    const order = [start];
    while (order.length < members.length) {
      const last = order[order.length - 1];
      const next = [...(spouses.get(last) ?? [])].find(
        (other) => inGroup.has(other) && !order.includes(other),
      );
      if (!next) break;
      order.push(next);
    }
    for (const id of members) if (!order.includes(id)) order.push(id);
    return order;
  }
  // Человек с несколькими супругами — в середине, супруги по сторонам.
  const center = [...members].sort((a, b) => degree(b) - degree(a))[0];
  const rest = members.filter((id) => id !== center);
  const left = rest.filter((_, index) => index % 2 === 0);
  const right = rest.filter((_, index) => index % 2 === 1);
  return [...left.reverse(), center, ...right];
}
