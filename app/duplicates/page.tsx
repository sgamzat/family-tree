import { redirect } from "next/navigation";
import { DuplicatesBoard } from "@/components/duplicates-board";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function DuplicatesPage() {
  const user = await currentUser();
  if (!user) redirect("/login?next=/duplicates");
  if (user.role !== "admin") redirect("/");

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Вероятные дубли</h1>
        <p className="mt-1 text-[var(--muted)]">
          Совпало имя и имя отца, годы пересекаются. Оставьте одну карточку — связи
          и другие написания имени перейдут на неё. Сливать может только хранитель.
        </p>
      </div>
      <DuplicatesBoard />
    </div>
  );
}
