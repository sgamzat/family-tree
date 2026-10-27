import { DuplicatesBoard } from "@/components/duplicates-board";
import { pageKeeper } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DuplicatesPage() {
  const user = await pageKeeper("/duplicates");

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Вероятные дубли</h1>
        <p className="mt-1 text-[var(--muted)]">
          Совпало имя и имя отца, годы пересекаются. Оставьте одну карточку — связи
          и другие написания имени перейдут на неё.{" "}
          {user.role === "owner"
            ? "Вы владелец — слияние выполнится сразу."
            : "Слияние выполнится после подтверждения владельцем или другим хранителем."}
        </p>
      </div>
      <DuplicatesBoard />
    </div>
  );
}
