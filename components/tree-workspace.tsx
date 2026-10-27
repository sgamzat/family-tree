"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { AddRelativeSheet } from "@/components/add-relative-sheet";
import { CensusStamp } from "@/components/census-stamp";
import { EditPersonSheet } from "@/components/edit-person-sheet";
import { TreeMap } from "@/components/family-tree";
import { KinshipBar } from "@/components/kinship-bar";
import { api } from "@/lib/api";
import {
  censusPathUp,
  generationWord,
  livingDescendantCount,
} from "@/lib/census";
import { indexGraph, type KinGraph } from "@/lib/graph";
import type { DoubledAncestor, KinshipLookup, KinshipPath } from "@/lib/kinship";
import {
  formatFio,
  personYears,
  type FamilyDTO,
  type PersonDTO,
  type RelationRole,
} from "@/lib/names";
import {
  TREE_VIEWS,
  allRelatives,
  closePeople,
  tukhumPeople,
  type TreeView,
} from "@/lib/tree-views";
import { useRouter } from "next/navigation";

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
  owner = false,
  canEdit = true,
  pendingRequest = null,
  kinWith = null,
  me = { loggedIn: false, isMe: false, canClaim: false },
  openRole = null,
  openEdit = false,
}: {
  family: FamilyDTO;
  graph: KinGraph;
  doubledById?: Record<string, number>;
  doubledAncestors: DoubledAncestor[];
  keeper?: boolean;
  /** Владелец удаляет сразу, остальные — заявкой на подтверждение. */
  owner?: boolean;
  /** false — только просмотр: кнопок правки нет. */
  canEdit?: boolean;
  /** Заявка на удаление или слияние этого человека, ждущая подтверждения. */
  pendingRequest?: { kind: string; requestedByName: string; reason: string } | null;
  /** Открыть сразу родство с этим человеком (ссылка «Показать на карте»). */
  kinWith?: PersonDTO | null;
  /** Связан ли этот человек с аккаунтом того, кто смотрит. */
  me?: { loggedIn: boolean; isMe: boolean; canClaim: boolean };
  /** Открыть сразу форму добавления родственника (ссылка с главной). */
  openRole?: RelationRole | null;
  openEdit?: boolean;
}) {
  const router = useRouter();
  const personId = family.person.id;

  const [pane, setPane] = useState<"tree" | "card">("tree");
  const [view, setView] = useState<TreeView>(kinWith ? "all" : "close");
  const [role, setRole] = useState<RelationRole | null>(openRole);
  const [sibling, setSibling] = useState(false);
  const [editing, setEditing] = useState(openEdit);
  const [claimBusy, setClaimBusy] = useState(false);

  async function setItsMe(value: boolean) {
    setClaimBusy(true);
    setError("");
    try {
      await api("/api/me/person", {
        method: value ? "POST" : "DELETE",
        body: value ? JSON.stringify({ personId }) : undefined,
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить");
    } finally {
      setClaimBusy(false);
    }
  }
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState("");

  const indexed = useMemo(() => indexGraph(graph), [graph]);
  const inCensus = family.person.inCensus1886;
  const pathUp = useMemo(
    () => (inCensus ? null : censusPathUp(indexed, personId)),
    [indexed, personId, inCensus],
  );
  const livingDown = useMemo(
    () => (inCensus ? livingDescendantCount(indexed, personId) : 0),
    [indexed, personId, inCensus],
  );
  const censusAncestor = pathUp ? pathUp[pathUp.length - 1] : null;

  const tukhum = useMemo(() => tukhumPeople(indexed, personId), [indexed, personId]);
  const viewPeople = useMemo(() => {
    if (view === "all") return allRelatives(indexed, personId);
    if (view === "tukhum") return tukhum.people;
    return closePeople(indexed, personId);
  }, [view, indexed, personId, tukhum]);
  const tukhumRoot = indexed.byId.get(tukhum.rootId) ?? null;

  // --- Родство на карте -------------------------------------------------------
  const [kinOpen, setKinOpen] = useState(Boolean(kinWith));
  const [kinA, setKinA] = useState<PersonDTO | null>(kinWith ? family.person : null);
  const [kinB, setKinB] = useState<PersonDTO | null>(kinWith ?? null);
  const pairKey = kinOpen && kinA && kinB ? `${kinA.id}|${kinB.id}` : "";
  const [kinData, setKinData] = useState<{
    key: string;
    lines: KinshipPath[];
    error: string;
  }>({ key: "", lines: [], error: "" });
  const [lineChoice, setLineChoice] = useState({ key: "", index: 0 });

  useEffect(() => {
    if (!pairKey) return;
    let cancelled = false;
    const [fromId, toId] = pairKey.split("|");
    api<KinshipLookup | { error: string }>(`/api/kinship?from=${fromId}&to=${toId}`)
      .then((result) => {
        if (cancelled) return;
        if ("error" in result) {
          setKinData({ key: pairKey, lines: [], error: result.error });
          return;
        }
        const lines = [
          { relation: result.relation, steps: result.steps },
          ...result.alternates,
        ];
        setKinData({ key: pairKey, lines, error: "" });
        // Если путь выходит за текущую вкладку — показываем всех родных.
        setView((current) => {
          if (current === "all") return current;
          const shown = new Set(
            (current === "tukhum"
              ? tukhumPeople(indexed, personId).people
              : closePeople(indexed, personId)
            ).map((person) => person.id),
          );
          return lines[0].steps.every((step) => shown.has(step.person.id)) ? current : "all";
        });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setKinData({
          key: pairKey,
          lines: [],
          error: err instanceof Error ? err.message : "Не удалось найти связь",
        });
      });
    return () => {
      cancelled = true;
    };
  }, [pairKey, indexed, personId]);

  const kinReady = kinData.key === pairKey;
  const kinLines = kinReady ? kinData.lines : [];
  const lineIndex = lineChoice.key === pairKey ? lineChoice.index % Math.max(1, kinLines.length) : 0;
  const kinLine = kinLines[lineIndex] ?? null;
  const kinRoute = useMemo(
    () => kinLine?.steps.map((step) => ({ id: step.person.id, via: step.via })) ?? null,
    [kinLine],
  );
  const shownIds = useMemo(() => new Set(viewPeople.map((person) => person.id)), [viewPeople]);
  const kinOffMap = Boolean(kinRoute && kinRoute.some((step) => !shownIds.has(step.id)));

  function pickForKinship(person: PersonDTO) {
    if (!kinA) {
      setKinA(person);
    } else if (person.id === kinA.id) {
      return;
    } else {
      setKinB(person);
    }
  }

  function openKinship(other: PersonDTO | null = null) {
    setKinOpen(true);
    if (other) {
      setKinA(family.person);
      setKinB(other.id === family.person.id ? null : other);
    }
  }

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
  const parentLine = family.father
    ? `${family.person.gender === "male" ? "сын" : "дочь"} ${family.father.firstName}`
    : family.mother
      ? `${family.person.gender === "male" ? "сын" : "дочь"} ${family.mother.firstName}`
      : "";
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
        {inCensus ? (
          <Link href="/census" className="echo-stamp-link">
            <CensusStamp label="Перепись" />
          </Link>
        ) : (
          <p className="echo-kicker">Выбран</p>
        )}
        <h1>{formatFio(family.person) || family.person.firstName}</h1>
        {parentLine ? <p className="echo-parent">{parentLine}</p> : null}
        {me.isMe ? (
          <p className="echo-me">
            <span className="echo-me-badge">Это вы</span>
            <button
              type="button"
              className="echo-me-undo"
              disabled={claimBusy}
              onClick={() => void setItsMe(false)}
            >
              Это не я
            </button>
          </p>
        ) : me.canClaim ? (
          <button
            type="button"
            className="echo-claim"
            disabled={claimBusy}
            onClick={() => void setItsMe(true)}
          >
            Это я
          </button>
        ) : null}
        <p>
          {[years, family.person.gender === "male" ? "мужчина" : "женщина", clanHint]
            .filter(Boolean)
            .join(" · ")}
        </p>
        {family.person.aliases.length > 0 ? (
          <p>Также: {family.person.aliases.join(", ")}</p>
        ) : null}
        {family.person.sourceNote ? <p>Источник: {family.person.sourceNote}</p> : null}
      </div>

      {inCensus ? (
        livingDown > 0 ? (
          <div className="echo-line is-linked">
            <p className="echo-line-title">Линия до наших дней</p>
            <p>
              Доведена до живущих: среди потомков{" "}
              {livingDown === 1 ? "один живущий" : `живущих — ${livingDown}`}.
            </p>
          </div>
        ) : (
          <div className="echo-line is-open">
            <p className="echo-line-title">Линия до наших дней</p>
            <p>
              Пока не доведена до живущих. Знаете детей или внуков? Добавьте их, и
              линия соединится с сегодняшним днём.
            </p>
            {canEdit ? (
              <button
                type="button"
                className="echo-line-action"
                onClick={() => {
                  setSibling(false);
                  setRole("child");
                }}
              >
                Добавить ребёнка
              </button>
            ) : null}
          </div>
        )
      ) : pathUp ? (
        <div className="echo-line is-linked">
          <p className="echo-line-title">Линия дошла до переписи 1886</p>
          <ol className="echo-path">
            {pathUp.map((step) => (
              <li key={step.person.id}>
                {step.up === 0 ? (
                  <span>{step.person.firstName}</span>
                ) : (
                  <Link href={`/people/${step.person.id}`}>{step.person.firstName}</Link>
                )}
                <span>
                  {generationWord(step.up, step.person.gender)}
                  {step.person.inCensus1886 ? " · 1886" : ""}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ) : (
        <div className="echo-line is-open">
          <p className="echo-line-title">До переписи 1886</p>
          <p>
            Линия пока не дошла до переписи. Добавьте отца, деда, прадеда — кого
            помните. Когда цепочка дойдёт до человека из переписи, она соединится.
          </p>
          {!canEdit ? null : !family.father ? (
            <button type="button" className="echo-line-action" onClick={() => setRole("father")}>
              Добавить отца
            </button>
          ) : !family.mother ? (
            <button type="button" className="echo-line-action" onClick={() => setRole("mother")}>
              Добавить мать
            </button>
          ) : (
            <Link href={`/people/${family.father.id}`} className="echo-line-action">
              Продолжить у отца
            </Link>
          )}
        </div>
      )}

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

      {pendingRequest ? (
        <p className="echo-warn">
          Ждёт подтверждения хранителя:{" "}
          {pendingRequest.kind === "person.merge" ? "слияние с другой карточкой" : "удаление"}.
          Заявку подал(а) {pendingRequest.requestedByName}
          {pendingRequest.reason ? ` — «${pendingRequest.reason}»` : ""}.
        </p>
      ) : null}

      {canEdit ? (
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
      ) : (
        <p className="echo-note">У вас доступ только для просмотра.</p>
      )}

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
        {keeper ? <Link href={`/admin/log?person=${personId}`}>История изменений</Link> : null}
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
          <div className="echo-mode echo-mode-3" role="tablist" aria-label="Вид древа">
            {TREE_VIEWS.map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={view === item.value}
                className={view === item.value ? "is-on" : ""}
                onClick={() => setView(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className={`echo-kin-toggle ${kinOpen ? "is-on" : ""}`}
            aria-pressed={kinOpen}
            onClick={() => (kinOpen ? setKinOpen(false) : openKinship())}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="6" cy="6" r="2.5" />
              <circle cx="18" cy="18" r="2.5" />
              <path d="M6 8.5V13a3 3 0 0 0 3 3h6.5" />
            </svg>
            Родство
          </button>
        </div>

        {view === "tukhum" && tukhumRoot ? (
          <p className="echo-caption">
            {tukhum.people.length > 1
              ? `Род от ${formatFio(tukhumRoot) || tukhumRoot.firstName} по мужской линии. Дочери показаны, их дети — уже в роду мужа.`
              : "Отцовская линия пока не внесена — добавьте отца, деда, прадеда."}
          </p>
        ) : null}

        {kinOpen ? (
          <KinshipBar
            focus={family.person}
            first={kinA}
            second={kinB}
            onFirst={setKinA}
            onSecond={setKinB}
            loading={Boolean(pairKey) && !kinReady}
            error={kinReady ? kinData.error : ""}
            lines={kinLines}
            lineIndex={lineIndex}
            onNextLine={() => setLineChoice({ key: pairKey, index: lineIndex + 1 })}
            offMap={kinOffMap}
            onClose={() => setKinOpen(false)}
          />
        ) : null}

        {censusAncestor ? (
          <p className="echo-plaque">
            Линия дошла до переписи 1886 года: {censusAncestor.person.firstName},{" "}
            {generationWord(censusAncestor.up, censusAncestor.person.gender)}.
          </p>
        ) : null}

        <div className="echo-canvas">
          <TreeMap
            people={viewPeople}
            graph={indexed}
            focusId={personId}
            doubledById={doubledById}
            path={kinOpen && !kinOffMap ? kinRoute : null}
            picking={kinOpen}
            marks={kinOpen ? [kinA?.id, kinB?.id].filter((id): id is string => Boolean(id)) : []}
            onPick={pickForKinship}
            onAskKinship={(person) => openKinship(person)}
          />
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
          deleteMode={owner ? "now" : canEdit ? "request" : null}
          hasPendingDelete={Boolean(pendingRequest)}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </div>
  );
}
