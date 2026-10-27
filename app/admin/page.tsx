import Link from "next/link";
import fs from "fs";
import path from "path";
import { AdminAccountRow } from "@/components/admin-account-row";
import { AdminUsers } from "@/components/admin-users";
import { listAccounts, readAuthEvents } from "@/lib/accounts";
import { pageOwner } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { formatFio } from "@/lib/names";

export const dynamic = "force-dynamic";

const EVENT_LABEL: Record<string, string> = {
  "login.ok": "вошёл(а)",
  "login.fail": "неверный пароль",
  "login.locked": "вход временно заблокирован",
  logout: "вышел(а)",
  "logout.all": "вышел(а) на всех устройствах",
  "account.create": "аккаунт создан",
  "account.update": "аккаунт изменён",
  "password.reset": "пароль сменён",
};

function when(value: string | Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

type BackupStatus = {
  at?: string;
  tree?: { file: string; bytes: number; ok: boolean };
  accounts?: { file: string; bytes: number };
  offsite?: { ok: boolean; at?: string; error?: string };
};

function readBackupStatus(): BackupStatus | null {
  const dir = process.env.BACKUP_DIR || path.join(process.cwd(), "backups");
  try {
    return JSON.parse(fs.readFileSync(path.join(dir, "status.json"), "utf8")) as BackupStatus;
  } catch {
    return null;
  }
}

/** Жители и доступ — только для владельца. */
export default async function AdminPage() {
  await pageOwner("/admin");
  const accounts = listAccounts();
  const linked = accounts.map((account) => account.personId).filter((id): id is string => Boolean(id));
  const [people, census, peopleNames] = await Promise.all([
    prisma.person.count(),
    prisma.person.count({ where: { inCensus1886: true } }),
    prisma.person.findMany({
      where: { id: { in: linked } },
      select: { id: true, lastName: true, firstName: true, patronymic: true },
    }),
  ]);
  const nameById = new Map<string, string>(
    peopleNames.map((row) => [row.id, formatFio(row) || row.firstName]),
  );
  const loginById = new Map(accounts.map((account) => [account.id, account.name]));
  const events = readAuthEvents(40);
  const backup = readBackupStatus();

  return (
    <div className="admin-page">
      <div>
        <h1>Жители и доступ</h1>
        <p className="admin-lead">
          Древо видно только тем, кому вы открыли вход. Роли: «только смотрит»,
          «дописывает», «хранитель» — хранитель видит журнал и подтверждает удаления.
        </p>
        <p className="admin-meta">
          В древе {people} чел., в переписи {census}. Аккаунтов {accounts.length}.{" "}
          <Link href="/admin/log" className="text-[var(--accent)]">
            Журнал изменений
          </Link>{" "}
          ·{" "}
          <Link href="/admin/requests" className="text-[var(--accent)]">
            Подтверждения
          </Link>
        </p>
      </div>

      <section className="grid gap-3">
        <h2>Жители</h2>
        <ul className="grid gap-2">
          {accounts.map((account) => (
            <AdminAccountRow
              key={account.id}
              account={{
                id: account.id,
                name: account.name,
                login: account.login,
                role: account.role,
                active: account.active,
                personName: account.personId ? (nameById.get(account.personId) ?? null) : null,
                createdAt: account.createdAt,
              }}
            />
          ))}
        </ul>
      </section>

      <section className="grid gap-3">
        <h2>Открыть вход новому жителю</h2>
        <p className="admin-meta">
          Передайте человеку логин и пароль лично. Пароль он может попросить сменить у вас.
        </p>
        <AdminUsers />
      </section>

      <section className="grid gap-3" id="backups">
        <h2>Резервные копии</h2>
        {backup?.at ? (
          <div className="admin-card">
            <p>
              Последняя копия: <b>{when(backup.at)}</b>
              {backup.tree ? ` · древо ${Math.round(backup.tree.bytes / 1024)} КБ` : ""}
              {backup.tree && !backup.tree.ok ? (
                <span className="admin-tag is-danger"> проверка не прошла</span>
              ) : null}
            </p>
            <p className="admin-meta">
              {backup.offsite
                ? backup.offsite.ok
                  ? `Копия в облаке: ${backup.offsite.at ? when(backup.offsite.at) : "отправлена"}`
                  : `Копия в облаке не отправилась: ${backup.offsite.error ?? "ошибка"}`
                : "Отправка в облако не настроена (OFFSITE_REMOTE)."}
            </p>
          </div>
        ) : (
          <p className="admin-meta">
            Автоматических копий пока нет — проверьте, что запущен сервис backup.
          </p>
        )}
        <div className="admin-actions">
          <a href="/api/admin/backup?what=tree" className="btn-secondary">
            Скачать копию древа
          </a>
          <a href="/api/admin/backup?what=accounts" className="btn-secondary">
            Скачать копию аккаунтов
          </a>
        </div>
        <p className="admin-meta">
          Копия аккаунтов содержит хеши паролей — храните её так же бережно, как ключи.
        </p>
      </section>

      <section className="grid gap-2">
        <h2>Входы</h2>
        {events.length === 0 ? <p className="admin-meta">Пока записей нет.</p> : null}
        <ul className="log-list">
          {events.map((event, index) => (
            <li key={`${event.at}-${index}`} className="log-row">
              <span>
                <b>{(event.userId && loginById.get(event.userId)) || event.login || "—"}</b> ·{" "}
                {EVENT_LABEL[event.type] ?? event.type}
                {event.by && event.by !== event.userId ? ` (сделал ${loginById.get(event.by) ?? "владелец"})` : ""}
              </span>
              <span className="admin-meta">
                {when(event.at)}
                {event.ip && event.ip !== "unknown" ? ` · ${event.ip}` : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
