import Link from "next/link";
import { RequestActions } from "@/components/request-actions";
import { pageKeeper } from "@/lib/auth";
import { listRequests } from "@/lib/requests";

export const dynamic = "force-dynamic";

function when(date: Date | null) {
  if (!date) return "";
  return new Intl.DateTimeFormat("ru-RU", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

const STATUS: Record<string, { label: string; tone: string }> = {
  approved: { label: "подтверждена", tone: "is-ok" },
  rejected: { label: "отклонена", tone: "" },
  failed: { label: "не выполнилась", tone: "is-danger" },
};

/** Очередь: удаления и слияния ждут подтверждения владельца или хранителя. */
export default async function RequestsPage() {
  const user = await pageKeeper("/admin/requests");
  const [pending, decided] = await Promise.all([listRequests("pending"), listRequests("decided")]);

  return (
    <div className="admin-page">
      <div>
        <h1>Подтверждения</h1>
        <p className="admin-lead">
          Удаление человека и слияние дублей выполняются только после подтверждения.
          Подтвердить может владелец или хранитель, но не тот, кто подал заявку. После
          удаления в журнале остаётся снимок — человека можно вернуть.
        </p>
      </div>

      <section className="grid gap-3">
        <h2>Ждут решения{pending.length ? ` · ${pending.length}` : ""}</h2>
        {pending.length === 0 ? <p className="admin-meta">Заявок нет.</p> : null}
        <ul className="grid gap-3">
          {pending.map((request) => {
            const s = request.snapshotData;
            const merge = request.kind === "person.merge";
            return (
              <li key={request.id} className="admin-card">
                <div>
                  <span className={`admin-tag ${merge ? "" : "is-danger"}`}>
                    {merge ? "слияние" : "удаление"}
                  </span>
                  <p className="mt-1 font-semibold">
                    <Link href={`/people/${request.personId}`} className="text-[var(--accent)]">
                      {s.name}
                    </Link>
                    {s.years ? `, ${s.years}` : ""}
                    {merge && request.keepId ? (
                      <>
                        {" → влить в "}
                        <Link href={`/people/${request.keepId}`} className="text-[var(--accent)]">
                          {s.keepName ?? "карточку"}
                        </Link>
                      </>
                    ) : null}
                  </p>
                  <p className="admin-meta">
                    {[
                      s.parents.length ? `родители: ${s.parents.join(", ")}` : "",
                      s.spouses.length ? `супруги: ${s.spouses.join(", ")}` : "",
                      s.children.length ? `дети: ${s.children.join(", ")}` : "",
                    ]
                      .filter(Boolean)
                      .join(" · ") || "связей нет"}
                  </p>
                  <p className="admin-meta">
                    Подал(а) {request.requestedByName}, {when(request.createdAt)}
                    {request.reason ? ` — «${request.reason}»` : ""}
                  </p>
                </div>
                <RequestActions
                  requestId={request.id}
                  kind={request.kind}
                  ownRequest={request.requestedById === user.id && user.role !== "owner"}
                />
              </li>
            );
          })}
        </ul>
      </section>

      {decided.length > 0 ? (
        <section className="grid gap-3">
          <h2>Недавно решённые</h2>
          <ul className="grid gap-2">
            {decided.map((request) => (
              <li key={request.id} className="admin-card is-done">
                <p>
                  <span className={`admin-tag ${STATUS[request.status]?.tone ?? ""}`}>
                    {STATUS[request.status]?.label ?? request.status}
                  </span>{" "}
                  {request.kind === "person.merge" ? "Слияние" : "Удаление"}:{" "}
                  {request.snapshotData.name}
                </p>
                <p className="admin-meta">
                  Подал(а) {request.requestedByName} · решил(а) {request.decidedByName},{" "}
                  {when(request.decidedAt)}
                  {request.decisionNote ? ` — «${request.decisionNote}»` : ""}
                </p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
