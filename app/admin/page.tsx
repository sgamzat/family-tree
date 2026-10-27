import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminUsers } from "@/components/admin-users";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const ACTION_LABEL: Record<string, string> = {
  "person.create": "добавил человека",
  "person.update": "изменил карточку",
  "person.delete": "удалил человека",
  "person.merge": "слил дубли",
  "person.census": "отметил в переписи",
  "relation.add": "добавил родство",
  "relation.unlink": "отвязал родство",
  "user.create": "открыл вход",
  "user.link": "отметил свою карточку",
  "user.unlink": "снял отметку со своей карточки",
};

function when(date: Date) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default async function AdminPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/admin");
  if (user.role !== "admin") redirect("/");

  const [people, census, users, changes] = await Promise.all([
    prisma.person.count(),
    prisma.person.count({ where: { inCensus1886: true } }),
    prisma.user.findMany({ orderBy: { createdAt: "asc" } }),
    prisma.changeLog.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  return (
    <div className="grid gap-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Хранителю</h1>
        <p className="mt-1 text-[var(--muted)]">
          Древо одно. Здесь хранитель видит, кто что дописал, и открывает вход
          тем, кто будет заполнять — обычно это 10–20 человек.
        </p>
        <p className="mt-3 text-sm text-[var(--muted)]">
          В древе {people}. В переписи {census}. Входов {users.length}.
        </p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/duplicates" className="font-medium text-[var(--accent)]">
            Вероятные дубли
          </Link>
          <Link href="/census" className="font-medium text-[var(--accent)]">
            Перепись 1886 года
          </Link>
        </p>
      </div>

      <section className="grid gap-3">
        <h2 className="text-lg font-semibold">Кто дописывает</h2>
        <ul className="grid">
          {users.map((account) => (
            <li key={account.id} className="admin-row">
              <span className="font-medium">{account.name}</span>
              <span className="text-sm text-[var(--muted)]">
                {account.login} · {account.role === "admin" ? "хранитель" : "дописывает"}
              </span>
            </li>
          ))}
        </ul>
        <AdminUsers />
      </section>

      <section className="grid gap-2" id="log">
        <h2 className="text-lg font-semibold">Журнал изменений</h2>
        {changes.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Пока записей нет.</p>
        ) : (
          <ul className="grid">
            {changes.map((change) => {
              let actor = "неизвестно";
              try {
                const payload = JSON.parse(change.payload) as { actor?: string };
                if (payload.actor && payload.actor !== "anonymous") actor = payload.actor;
              } catch {
                actor = "неизвестно";
              }
              return (
                <li key={change.id} className="admin-row">
                  <span>
                    {actor} {ACTION_LABEL[change.action] ?? change.action}
                  </span>
                  <span className="text-sm text-[var(--muted)]">{when(change.createdAt)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
