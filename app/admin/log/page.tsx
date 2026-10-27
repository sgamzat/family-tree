import Link from "next/link";
import { RestoreButton } from "@/components/restore-button";
import { listAccounts } from "@/lib/accounts";
import { pageKeeper } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { describeLog, LOG_GROUPS } from "@/lib/log-view";
import { formatFio } from "@/lib/names";

export const dynamic = "force-dynamic";

const PAGE = 50;

function when(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** Журнал изменений: кто, что и когда. Фильтры — по человеку, автору и виду действия. */
export default async function LogPage({
  searchParams,
}: {
  searchParams: Promise<{ person?: string; actor?: string; group?: string; before?: string }>;
}) {
  await pageKeeper("/admin/log");
  const { person, actor, group = "all", before } = await searchParams;
  const actions = LOG_GROUPS.find((item) => item.value === group)?.actions ?? [];
  const beforeDate = before ? new Date(before) : null;

  const [entries, people] = await Promise.all([
    prisma.changeLog.findMany({
      where: {
        ...(person ? { personId: person } : {}),
        ...(actor ? { actorId: actor } : {}),
        ...(actions.length ? { action: { in: actions } } : {}),
        ...(beforeDate && !Number.isNaN(beforeDate.getTime()) ? { createdAt: { lt: beforeDate } } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: PAGE + 1,
    }),
    prisma.person.findMany({ select: { id: true, lastName: true, firstName: true, patronymic: true } }),
  ]);
  const names = new Map<string, string>(
    people.map((row) => [row.id, formatFio(row) || row.firstName]),
  );
  const accounts = listAccounts();
  const actors = new Map(accounts.map((account) => [account.id, account.name]));
  const views = entries.slice(0, PAGE).map((entry) => describeLog(entry, names, actors));
  const more = entries.length > PAGE ? entries[PAGE - 1].createdAt.toISOString() : null;

  const link = (patch: Record<string, string | undefined>) => {
    const params = new URLSearchParams();
    const next = { person, actor, group, ...patch };
    for (const [key, value] of Object.entries(next)) {
      if (value && !(key === "group" && value === "all")) params.set(key, value);
    }
    const qs = params.toString();
    return qs ? `/admin/log?${qs}` : "/admin/log";
  };

  return (
    <div className="admin-page">
      <div>
        <h1>Журнал изменений</h1>
        <p className="admin-lead">
          Каждое изменение древа: кто, что и когда. Записи не удаляются. Удалённого
          человека можно вернуть кнопкой «Восстановить».
        </p>
        {person ? (
          <p className="admin-meta">
            Только по человеку: {names.get(person) ?? "удалён"} ·{" "}
            <Link href={link({ person: undefined, before: undefined })} className="text-[var(--accent)]">
              показать всех
            </Link>
          </p>
        ) : null}
        {actor ? (
          <p className="admin-meta">
            Только изменения: {actors.get(actor) ?? "неизвестно"} ·{" "}
            <Link href={link({ actor: undefined, before: undefined })} className="text-[var(--accent)]">
              все авторы
            </Link>
          </p>
        ) : null}
      </div>

      <nav className="admin-filters" aria-label="Вид изменений">
        {LOG_GROUPS.map((item) => (
          <Link
            key={item.value}
            href={link({ group: item.value, before: undefined })}
            className={group === item.value ? "is-on" : ""}
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <nav className="admin-filters" aria-label="Автор">
        {accounts.map((account) => (
          <Link
            key={account.id}
            href={link({ actor: actor === account.id ? undefined : account.id, before: undefined })}
            className={actor === account.id ? "is-on" : ""}
          >
            {account.name}
          </Link>
        ))}
      </nav>

      {views.length === 0 ? (
        <p className="admin-meta">Записей нет.</p>
      ) : (
        <ul className="log-list">
          {views.map((view) => (
            <li key={view.id} className="log-row">
              <span>
                <b>{view.actor}</b> · {view.title}
                {view.personName ? ": " : ""}
                {view.personId ? (
                  <Link href={`/people/${view.personId}`} className="text-[var(--accent)]">
                    {view.personName}
                  </Link>
                ) : (
                  view.personName
                )}
              </span>
              {view.lines.length ? <span className="admin-meta">{view.lines.join(" · ")}</span> : null}
              {view.diff.length ? (
                <details>
                  <summary>Что изменилось ({view.diff.length})</summary>
                  <div className="log-diff">
                    {view.diff.map((item) => (
                      <span key={item.field}>
                        {item.field}: <del>{item.before}</del> → <ins>{item.after}</ins>
                      </span>
                    ))}
                  </div>
                </details>
              ) : null}
              <span className="admin-meta">
                {when(view.createdAt)}
                {view.personId ? (
                  <>
                    {" · "}
                    <Link href={link({ person: view.personId, before: undefined })}>
                      вся история человека
                    </Link>
                  </>
                ) : null}
              </span>
              {view.restorable ? <RestoreButton logId={view.id} name={view.personName} /> : null}
            </li>
          ))}
        </ul>
      )}

      {more ? (
        <Link href={link({ before: more })} className="btn-secondary text-center">
          Показать раньше
        </Link>
      ) : null}
    </div>
  );
}
