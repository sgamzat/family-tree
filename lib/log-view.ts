/** Записи журнала → понятные строки для страницы «Журнал изменений». */

export type LogEntry = {
  id: string;
  action: string;
  personId: string | null;
  actorId: string | null;
  payload: string;
  createdAt: Date;
};

export type LogView = {
  id: string;
  actor: string;
  title: string;
  /** Чья карточка — ссылка, если человек есть в древе. */
  personId: string | null;
  personName: string;
  lines: string[];
  diff: Array<{ field: string; before: string; after: string }>;
  /** Удалённого можно вернуть. */
  restorable: boolean;
  createdAt: Date;
  group: "people" | "relations" | "requests" | "accounts";
};

const GROUP: Record<string, LogView["group"]> = {
  "person.create": "people",
  "person.update": "people",
  "person.delete": "people",
  "person.restore": "people",
  "person.merge": "people",
  "person.census": "people",
  "relation.add": "relations",
  "relation.unlink": "relations",
  "request.create": "requests",
  "request.approve": "requests",
  "request.reject": "requests",
  "user.link": "accounts",
  "user.unlink": "accounts",
  "user.create": "accounts",
};

const TITLE: Record<string, string> = {
  "person.create": "Добавлен человек",
  "person.update": "Изменена карточка",
  "person.delete": "Удалён человек",
  "person.restore": "Человек возвращён в древо",
  "person.merge": "Слиты карточки-двойники",
  "person.census": "Отмечен в переписи 1886",
  "relation.add": "Добавлена связь",
  "relation.unlink": "Отвязана связь",
  "request.create": "Подана заявка",
  "request.approve": "Заявка подтверждена",
  "request.reject": "Заявка отклонена",
  "user.link": "Житель отметил свою карточку",
  "user.unlink": "Житель снял отметку со своей карточки",
  "user.create": "Открыт вход",
};

const ROLE_WORD: Record<string, string> = {
  father: "отец",
  mother: "мать",
  spouse: "супруг(а)",
  child: "ребёнок",
};

const FIELD: Record<string, string> = {
  lastName: "Фамилия",
  firstName: "Имя",
  patronymic: "Отчество",
  gender: "Пол",
  birthYear: "Год рождения",
  deathYear: "Год смерти",
  birthDateText: "Рождение (текстом)",
  deathDateText: "Смерть (текстом)",
  isLiving: "Жив",
  sourceNote: "Источник",
  description: "О человеке",
  nickname: "Прозвище",
  occupation: "Занятие",
  burialPlace: "Похоронен",
  residence: "Где жил",
  warService: "Война",
  censusFamily: "Семья в переписи 1886",
  censusAge: "Возраст в 1886",
  aliases: "Другие имена",
  claimedClanId: "Род (заявлен)",
  inCensus1886: "В переписи 1886",
};

function show(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (value === true) return "да";
  if (value === false) return "нет";
  if (value === "male") return "мужской";
  if (value === "female") return "женский";
  if (Array.isArray(value)) return value.length ? value.join(", ") : "—";
  return String(value);
}

type Payload = Record<string, unknown> & { actor?: string };

function nameOf(person: unknown): string {
  if (!person || typeof person !== "object") return "";
  const p = person as { lastName?: string; firstName?: string; patronymic?: string };
  return [p.lastName, p.firstName, p.patronymic].filter(Boolean).join(" ");
}

export function describeLog(
  entry: LogEntry,
  names: Map<string, string>,
  actors: Map<string, string>,
): LogView {
  let payload: Payload = {};
  try {
    payload = JSON.parse(entry.payload) as Payload;
  } catch {
    payload = {};
  }
  const actor =
    (entry.actorId && actors.get(entry.actorId)) ||
    (payload.actor && payload.actor !== "anonymous" ? payload.actor : "") ||
    "неизвестно";
  const known = (id: unknown) => (typeof id === "string" ? names.get(id) : undefined);
  const personName =
    known(entry.personId) ||
    nameOf(payload.person) ||
    nameOf(payload.drop) ||
    (entry.personId ? "человек удалён" : "");
  const lines: string[] = [];
  const diff: LogView["diff"] = [];

  switch (entry.action) {
    case "person.update": {
      const before = (payload.before ?? {}) as Record<string, unknown>;
      const after = (payload.after ?? {}) as Record<string, unknown>;
      for (const key of Object.keys(FIELD)) {
        if (!(key in after)) continue;
        const a = show(before[key]);
        const b = show(after[key]);
        if (a !== b) diff.push({ field: FIELD[key], before: a, after: b });
      }
      break;
    }
    case "relation.add":
    case "relation.unlink": {
      const relative = known(payload.relativeId) ?? "человек не найден";
      const role = ROLE_WORD[String(payload.role)] ?? String(payload.role ?? "");
      lines.push(`${relative} — ${role}`);
      if (payload.created === true) lines.push("новый человек — внесён вместе со связью");
      break;
    }
    case "person.delete": {
      const counts = [
        ["родителей", (payload.parentIds as unknown[] | undefined)?.length ?? 0],
        ["детей", (payload.childIds as unknown[] | undefined)?.length ?? 0],
        ["супругов", (payload.spouseIds as unknown[] | undefined)?.length ?? 0],
      ].filter(([, count]) => Number(count) > 0);
      if (counts.length) lines.push(`связи: ${counts.map(([w, c]) => `${w} ${c}`).join(", ")}`);
      if (payload.reason) lines.push(`причина: ${String(payload.reason)}`);
      if (payload.requestId) lines.push("по подтверждённой заявке");
      break;
    }
    case "person.merge": {
      const drop = nameOf(payload.drop);
      if (drop) lines.push(`исчезла карточка: ${drop}`);
      const aliases = payload.aliasesAdded as string[] | undefined;
      if (aliases?.length) lines.push(`добавлены другие имена: ${aliases.join(", ")}`);
      break;
    }
    case "person.restore": {
      const missing = (payload.missing as unknown[] | undefined)?.length ?? 0;
      if (missing) lines.push(`не вернулись связи с удалёнными людьми: ${missing}`);
      break;
    }
    case "request.create":
    case "request.approve":
    case "request.reject": {
      const kind = payload.kind === "person.merge" ? "слияние" : "удаление";
      lines.push(`что: ${kind}`);
      if (payload.reason) lines.push(`причина: ${String(payload.reason)}`);
      if (payload.note) lines.push(`комментарий: ${String(payload.note)}`);
      break;
    }
    default:
      break;
  }

  return {
    id: entry.id,
    actor,
    title: TITLE[entry.action] ?? entry.action,
    personId: entry.personId && names.has(entry.personId) ? entry.personId : null,
    personName,
    lines,
    diff,
    restorable: entry.action === "person.delete" && !!entry.personId && !names.has(entry.personId),
    createdAt: entry.createdAt,
    group: GROUP[entry.action] ?? "people",
  };
}

export const LOG_GROUPS: ReadonlyArray<{ value: LogView["group"] | "all"; label: string; actions: string[] }> = [
  { value: "all", label: "Всё", actions: [] },
  {
    value: "people",
    label: "Люди",
    actions: ["person.create", "person.update", "person.delete", "person.restore", "person.merge", "person.census"],
  },
  { value: "relations", label: "Связи", actions: ["relation.add", "relation.unlink"] },
  { value: "requests", label: "Заявки", actions: ["request.create", "request.approve", "request.reject"] },
  { value: "accounts", label: "Отметки «Это я»", actions: ["user.link", "user.unlink", "user.create"] },
];
