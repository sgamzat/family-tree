"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { AddRelativeSheet } from "@/components/add-relative-sheet";
import { EditPersonSheet } from "@/components/edit-person-sheet";
import { ClanTreeView, LineageTree } from "@/components/family-tree";
import { api } from "@/lib/api";
import type { KinGraph } from "@/lib/graph";
import type { DoubledAncestor } from "@/lib/kinship";
import {
  formatFio,
  personYears,
  type FamilyDTO,
  type PersonDTO,
  type RelationRole,
} from "@/lib/names";
import {
  DOWN_DEPTHS,
  UP_DEPTHS,
  buildClanTree,
  buildPersonTree,
  clanCaption,
  maxDown,
  maxUp,
  paternalRootId,
  type TreeMode,
} from "@/lib/tree";
import { useRouter } from "next/navigation";

function DepthChips({
  options,
  value,
  max,
  allLabel,
  onChange,
}: {
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
    <div className="echo-chips">
      {chips.map((option) => (
        <button
          key={option.label}
          type="button"
          className={`echo-chip ${value === option.value ? "is-on" : ""}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function RelationRow({
  person,
  action,
  busy,
  onUnlink,
}: {
  person: PersonDTO;
  action: string;
  busy: boolean;
  onUnlink?: () => void;
}) {
  return (
    <div className="echo-rel">
      <Link href={`/people/${person.id}`}>{formatFio(person) || person.firstName}</Link>
      {onUnlink ? (
        <button type="button" className="unlink" disabled={busy} onClick={onUnlink}>
          {action}
        </button>
      ) : null}
    </div>
  );
}

export function TreeWorkspace({
  family,
  graph,
  doubledById,
  doubledAncestors,
  keeper = false,
}: {
  family: FamilyDTO;
  graph: KinGraph;
  doubledById?: Record<string, number>;
  doubledAncestors: DoubledAncestor[];
  keeper?: boolean;
}) {
  const router = useRouter();
  const personId = family.person.id;
  const upMax = maxUp(graph, personId);
  const downMax = maxDown(graph, personId);
  const rootId = paternalRootId(graph, personId);
  const clanDownMax = maxDown(graph, rootId);

  const [pane, setPane] = useState<"tree" | "card">("tree");
  const [mode, setMode] = useState<TreeMode>("line");
  const [up, setUp] = useState(Math.min(2, upMax));
  const [down, setDown] = useState(Math.min(2, downMax));
  const [clanDown, setClanDown] = useState(Math.min(4, clanDownMax) || clanDownMax);
  const [role, setRole] = useState<RelationRole | null>(null);
  const [sibling, setSibling] = useState(false);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const lineTree = useMemo(
    () => buildPersonTree(graph, personId, { up, down }),
    [graph, personId, up, down],
  );
  const clanTree = useMemo(
    () => buildClanTree(graph, personId, clanDown),
    [graph, personId, clanDown],
  );

  const siblingParent = family.father ?? family.mother;
  const siblingFamily = siblingParent
    ? {
        ...family,
        person: siblingParent,
        spouses: [family.father, family.mother].filter(
          (person): person is PersonDTO =>
            person != null && person.id !== siblingParent.id,
        ),
        children: [family.person, ...family.siblings],
      }
    : family;

  const years = personYears(family.person);
  const clanHint = family.clan.computed
    ? `Тухум: ${family.clan.computed.name}`
    : family.clan.claimed
      ? `Тухум (пока по заявке): ${family.clan.claimed.name}`
      : "";

  async function unlink(nextRole: RelationRole, relative: PersonDTO) {
    const who = formatFio(relative) || relative.firstName;
    const labels: Record<RelationRole, string> = {
      father: "отца",
      mother: "мать",
      spouse: "супруга",
      child: "ребёнка",
    };
    if (!window.confirm(`Отвязать ${labels[nextRole]} ${who}? Сам человек останется в дереве.`)) {
      return;
    }
    setBusyId(relative.id);
    setError("");
    try {
      const params = new URLSearchParams({
        personId,
        role: nextRole,
        relativeId: relative.id,
      });
      await api(`/api/relations?${params.toString()}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось отвязать");
    } finally {
      setBusyId("");
    }
  }

  const panel = (
    <aside className="echo-panel">
      <div className="echo-who">
        <p className="echo-kicker">Выбран</p>
        <h1>{formatFio(family.person) || family.person.firstName}</h1>
        <p>
          {[years, family.person.gender === "male" ? "мужчина" : "женщина", clanHint]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {family.person.inCensus1886 ? (
          <p>
            <Link href="/census">Перепись населения 1886 года</Link>
          </p>
        ) : null}
      </div>

      {family.clan.mismatch && family.clan.claimed && family.clan.computed ? (
        <p className="echo-warn">
          Заявленный род «{family.clan.claimed.name}» не совпадает с вычисленным
          «{family.clan.computed.name}».
        </p>
      ) : null}

      {doubledAncestors.length > 0 ? (
        <p className="echo-note">
          Общий предок. Линии к нему идут отдельно и не сливаются:{" "}
          {doubledAncestors.map((item, index) => (
            <span key={item.person.id}>
              {index > 0 ? ", " : ""}
              <Link href={`/people/${item.person.id}`}>{item.person.firstName}</Link>
              {` ×${item.pathCount}`}
            </span>
          ))}
        </p>
      ) : null}

      {error ? <p className="echo-warn">{error}</p> : null}

      <div className="echo-actions">
        <button type="button" onClick={() => setRole("spouse")}>
          {family.person.gender === "male" ? "Добавить супругу" : "Добавить супруга"}
        </button>
        <button
          type="button"
          disabled={!siblingParent}
          title={siblingParent ? undefined : "Сначала укажите отца или мать"}
          onClick={() => {
            if (!siblingParent) return;
            setSibling(true);
            setRole("child");
          }}
        >
          Добавить брата или сестру
        </button>
        <button
          type="button"
          onClick={() => {
            setSibling(false);
            setRole("child");
          }}
        >
          Добавить ребёнка
        </button>
        {family.father ? null : (
          <button type="button" onClick={() => setRole("father")}>
            Добавить отца
          </button>
        )}
        {family.mother ? null : (
          <button type="button" onClick={() => setRole("mother")}>
            Добавить мать
          </button>
        )}
        <button type="button" className="is-quiet" onClick={() => setEditing(true)}>
          Изменить карточку
        </button>
      </div>

      <div className="echo-links">
        {family.father ? (
          <RelationRow
            person={family.father}
            action="Отвязать отца"
            busy={busyId === family.father.id}
            onUnlink={keeper ? () => unlink("father", family.father!) : undefined}
          />
        ) : null}
        {family.mother ? (
          <RelationRow
            person={family.mother}
            action="Отвязать мать"
            busy={busyId === family.mother.id}
            onUnlink={keeper ? () => unlink("mother", family.mother!) : undefined}
          />
        ) : null}
        {family.spouses.map((spouse) => (
          <RelationRow
            key={spouse.id}
            person={spouse}
            action="Отвязать супруга"
            busy={busyId === spouse.id}
            onUnlink={keeper ? () => unlink("spouse", spouse) : undefined}
          />
        ))}
        {family.children.map((child) => (
          <RelationRow
            key={child.id}
            person={child}
            action="Отвязать ребёнка"
            busy={busyId === child.id}
            onUnlink={keeper ? () => unlink("child", child) : undefined}
          />
        ))}
        {family.siblings.map((person) => (
          <div className="echo-rel" key={person.id}>
            <Link href={`/people/${person.id}`}>{formatFio(person) || person.firstName}</Link>
            <span>брат или сестра</span>
          </div>
        ))}
      </div>

      <div className="echo-more">
        <Link href={`/kinship?from=${personId}`}>Кем приходится</Link>
        {keeper ? <Link href="/duplicates">Вероятные дубли</Link> : null}
      </div>
    </aside>
  );

  return (
    <div className="echo-page">
      <div className="echo-switch" role="tablist" aria-label="Вид">
        <button
          type="button"
          role="tab"
          aria-selected={pane === "tree"}
          className={pane === "tree" ? "is-on" : ""}
          onClick={() => setPane("tree")}
        >
          Древо
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={pane === "card"}
          className={pane === "card" ? "is-on" : ""}
          onClick={() => setPane("card")}
        >
          Карточка
        </button>
      </div>

      <section className={`echo-stage ${pane === "card" ? "is-hidden-mobile" : ""}`}>
        <div className="echo-toolbar">
          <button
            type="button"
            className={`echo-chip ${mode === "line" ? "is-on" : ""}`}
            onClick={() => setMode("line")}
          >
            Семья
          </button>
          <button
            type="button"
            className={`echo-chip ${mode === "clan" ? "is-on" : ""}`}
            onClick={() => setMode("clan")}
          >
            Род
          </button>
          <Link href={`/kinship?from=${personId}`} className="echo-chip echo-chip-link">
            Родство
          </Link>
        </div>

        {mode === "line" ? (
          <div className="echo-depth-scroll">
            <DepthChips
              options={UP_DEPTHS}
              value={up}
              max={upMax}
              allLabel="Все предки"
              onChange={setUp}
            />
            <DepthChips
              options={DOWN_DEPTHS}
              value={down}
              max={downMax}
              allLabel="Все потомки"
              onChange={setDown}
            />
          </div>
        ) : (
          <div className="echo-depths">
            {clanTree ? <p className="echo-caption">{clanCaption(clanTree)}</p> : null}
            <div className="echo-depth-scroll">
              <DepthChips
                options={DOWN_DEPTHS}
                value={clanDown}
                max={clanDownMax}
                allLabel="Весь род"
                onChange={setClanDown}
              />
            </div>
          </div>
        )}

        <div className="echo-canvas">
          {mode === "line" && lineTree ? (
            <LineageTree tree={lineTree} graph={graph} doubledById={doubledById} />
          ) : null}
          {mode === "clan" && clanTree ? (
            <ClanTreeView tree={clanTree} graph={graph} doubledById={doubledById} />
          ) : null}
        </div>
      </section>

      <div className={pane === "tree" ? "is-hidden-mobile" : ""}>{panel}</div>

      {role ? (
        <AddRelativeSheet
          personId={sibling && siblingParent ? siblingParent.id : personId}
          role={role}
          family={sibling && siblingParent ? siblingFamily : family}
          onClose={() => {
            setRole(null);
            setSibling(false);
          }}
          onSaved={() => {
            setRole(null);
            setSibling(false);
            setPane("tree");
          }}
        />
      ) : null}

      {editing ? (
        <EditPersonSheet
          person={family.person}
          foundedClans={family.foundedClans}
          keeper={keeper}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}
