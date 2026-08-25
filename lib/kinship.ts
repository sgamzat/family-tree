import { formatFio, type PersonDTO } from "@/lib/names";
import {
  indexGraph,
  neighbors,
  type IndexedGraph,
  type KinGraph,
  type KinStepType,
} from "@/lib/graph";

export type KinshipStep = {
  person: PersonDTO;
  via: KinStepType | null;
};

export type KinshipResult = {
  from: PersonDTO;
  to: PersonDTO;
  relation: string;
  sentence: string;
  steps: KinshipStep[];
};

type PathNode = {
  id: string;
  via: KinStepType | null;
  prev: PathNode | null;
};

function shortestPath(
  graph: IndexedGraph,
  fromId: string,
  toId: string,
): PathNode | null {
  const visited = new Set<string>([fromId]);
  const queue: PathNode[] = [{ id: fromId, via: null, prev: null }];

  for (let i = 0; i < queue.length; i += 1) {
    const node = queue[i];
    if (node.id === toId) return node;
    for (const next of neighbors(graph, node.id)) {
      if (visited.has(next.id)) continue;
      visited.add(next.id);
      queue.push({ id: next.id, via: next.type, prev: node });
    }
  }
  return null;
}

function unwind(end: PathNode): Array<{ id: string; via: KinStepType | null }> {
  const items: Array<{ id: string; via: KinStepType | null }> = [];
  let current: PathNode | null = end;
  while (current) {
    items.push({ id: current.id, via: current.via });
    current = current.prev;
  }
  return items.reverse();
}

function byGender(gender: PersonDTO["gender"], male: string, female: string) {
  return gender === "male" ? male : female;
}

function ancestorWord(up: number, gender: PersonDTO["gender"]): string {
  if (up === 1) return byGender(gender, "отец", "мать");
  if (up === 2) return byGender(gender, "дед", "бабушка");
  if (up === 3) return byGender(gender, "прадед", "прабабушка");
  if (up === 4) return byGender(gender, "прапрадед", "прапрабабушка");
  return `предок (${up} покол.)`;
}

function descendantWord(down: number, gender: PersonDTO["gender"]): string {
  if (down === 1) return byGender(gender, "сын", "дочь");
  if (down === 2) return byGender(gender, "внук", "внучка");
  if (down === 3) return byGender(gender, "правнук", "правнучка");
  if (down === 4) return byGender(gender, "праправнук", "праправнучка");
  return `потомок (${down} покол.)`;
}

function cousinPrefix(degree: number): { male: string; female: string } {
  if (degree === 1) return { male: "двоюродный", female: "двоюродная" };
  if (degree === 2) return { male: "троюродный", female: "троюродная" };
  return { male: `${degree + 1}-юродный`, female: `${degree + 1}-юродная` };
}

function bloodRelation(
  up: number,
  down: number,
  gender: PersonDTO["gender"],
): string {
  if (up === 0 && down === 0) return "этот же человек";
  if (up === 0) return descendantWord(down, gender);
  if (down === 0) return ancestorWord(up, gender);
  if (up === 1 && down === 1) return byGender(gender, "брат", "сестра");
  if (down === 1 && up >= 2) {
    if (up === 2) return byGender(gender, "дядя", "тётя");
    if (up === 3) return byGender(gender, "двоюродный дед", "двоюродная бабушка");
    return byGender(gender, "дядя", "тётя");
  }
  if (up === 1 && down >= 2) {
    if (down === 2) return byGender(gender, "племянник", "племянница");
    return byGender(gender, "внучатый племянник", "внучатая племянница");
  }

  const degree = Math.min(up, down) - 1;
  const removed = Math.abs(up - down);
  const prefix = cousinPrefix(Math.max(degree, 1));
  const cousin = byGender(
    gender,
    `${prefix.male} брат`,
    `${prefix.female} сестра`,
  );
  if (removed === 0) return cousin;
  return `${cousin} (${removed} покол. разницы)`;
}

function describeBlood(types: KinStepType[], to: PersonDTO): string | null {
  if (types.some((type) => type === "spouse")) return null;
  const up = types.filter((type) => type === "parent").length;
  const down = types.filter((type) => type === "child").length;
  if (up + down !== types.length) return null;
  const firstChild = types.findIndex((type) => type === "child");
  if (firstChild === -1) return bloodRelation(up, 0, to.gender);
  const onlyParentsThenChildren = types
    .slice(0, firstChild)
    .every((type) => type === "parent");
  if (!onlyParentsThenChildren) return null;
  return bloodRelation(up, down, to.gender);
}

function inLawRelation(
  types: KinStepType[],
  from: PersonDTO,
  to: PersonDTO,
  people: PersonDTO[],
): string | null {
  const spouseAt = types.indexOf("spouse");
  if (spouseAt === -1) return null;
  if (types.filter((type) => type === "spouse").length !== 1) return null;

  const before = types.slice(0, spouseAt);
  const after = types.slice(spouseAt + 1);

  if (before.length === 0 && after.length === 0) {
    return byGender(to.gender, "муж", "жена");
  }

  if (before.length === 0) {
    const ofSpouse = describeBlood(after, to);
    if (!ofSpouse) return null;
    if (after.length === 1 && after[0] === "parent") {
      return from.gender === "male"
        ? byGender(to.gender, "тесть", "тёща")
        : byGender(to.gender, "свекор", "свекровь");
    }
    if (after.join("-") === "parent-child") {
      return from.gender === "male"
        ? byGender(to.gender, "шурин", "свояченица")
        : byGender(to.gender, "деверь", "золовка");
    }
    if (after[0] === "child" && after.length === 1) {
      return byGender(to.gender, "пасынок", "падчерица");
    }
    return `${ofSpouse} супруга`;
  }

  if (after.length === 0) {
    if (before.join("-") === "parent") {
      return byGender(to.gender, "отчим", "мачеха");
    }
    if (before.join("-") === "child") {
      return byGender(to.gender, "зять", "невестка");
    }
    if (before.join("-") === "parent-child") {
      return byGender(to.gender, "зять", "невестка");
    }
    const ofBlood = describeBlood(before, people[people.length - 2] ?? to);
    return ofBlood ? `супруг(а) (${ofBlood})` : null;
  }

  return null;
}

function viaWord(type: KinStepType, person: PersonDTO): string {
  if (type === "parent") return byGender(person.gender, "отец", "мать");
  if (type === "child") return byGender(person.gender, "сын", "дочь");
  return byGender(person.gender, "муж", "жена");
}

export function findKinship(
  graph: KinGraph,
  fromId: string,
  toId: string,
): KinshipResult | { error: string } {
  const indexed = indexGraph(graph);
  const from = indexed.byId.get(fromId);
  const to = indexed.byId.get(toId);
  if (!from || !to) return { error: "Человек не найден" };
  if (fromId === toId) {
    return {
      from,
      to,
      relation: "этот же человек",
      sentence: "Вы указали одного и того же человека.",
      steps: [{ person: from, via: null }],
    };
  }

  const end = shortestPath(indexed, fromId, toId);
  if (!end) {
    return {
      error:
        "В древе нет цепочки между ними. Часто не хватает общих родителей или брака.",
    };
  }

  const raw = unwind(end);
  const steps: KinshipStep[] = raw.map((item) => ({
    person: indexed.byId.get(item.id)!,
    via: item.via,
  }));
  const types = raw.slice(1).map((item) => item.via!) ;
  const blood = describeBlood(types, to);
  const inLaw = inLawRelation(
    types,
    from,
    to,
    steps.map((step) => step.person),
  );
  const relation = blood ?? inLaw ?? `родственник через ${types.length} связей`;
  const dativeName = formatFio(from);

  return {
    from,
    to,
    relation,
    sentence: `${formatFio(to)} — ${relation} для ${dativeName}.`,
    steps,
  };
}

export function stepCaption(step: KinshipStep): string | null {
  if (!step.via) return null;
  return viaWord(step.via, step.person);
}
