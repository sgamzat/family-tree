import { DuplicatesBoard } from "@/components/duplicates-board";

export const dynamic = "force-dynamic";

export default function DuplicatesPage() {
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Вероятные дубли</h1>
        <p className="mt-1 text-[var(--muted)]">
          Совпало имя и имя отца, годы пересекаются. Оставьте одну карточку — связи
          и другие написания имени перейдут на неё. Слияния потом закроем
          модераторам.
        </p>
      </div>
      <DuplicatesBoard />
    </div>
  );
}
