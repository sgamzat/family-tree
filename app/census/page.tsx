import Link from "next/link";
import { CensusList } from "@/components/census-list";
import { CensusStamp } from "@/components/census-stamp";
import { censusProgress } from "@/lib/census";
import { indexGraph } from "@/lib/graph";
import { listCensusPeople, loadKinGraph } from "@/lib/people";

export const dynamic = "force-dynamic";

export default async function CensusPage({
  searchParams,
}: {
  searchParams: Promise<{ show?: string }>;
}) {
  const { show } = await searchParams;
  const onlyUnlinked = show === "unlinked";
  const [people, graph] = await Promise.all([listCensusPeople(), loadKinGraph()]);
  const progress = censusProgress(indexGraph(graph));
  const linkedIds = [...progress.linkedIds];
  const shown = onlyUnlinked
    ? people.filter((person) => !progress.linkedIds.has(person.id))
    : people;

  return (
    <div className="grid gap-5">
      <div className="grid gap-2">
        <CensusStamp label="Перепись населения" large />
        <h1 className="text-3xl font-semibold leading-tight">
          {onlyUnlinked ? "Кто ещё не связан с живущими" : "Перепись 1886 года"}
        </h1>
        <p className="text-[var(--muted)]">
          {onlyUnlinked
            ? "От этих людей пока нельзя дойти по детям и внукам до живущих. Знаете их потомков — добавьте их."
            : "Люди из листа переписи. Это те же карточки, что и в древе: найдите своего предка и спускайтесь от него к детям и внукам."}
        </p>
        {progress.total > 0 ? (
          <p className="text-[var(--muted)]">
            Связаны с живущими: {progress.linked} из {progress.total}.{" "}
            {onlyUnlinked ? (
              <Link href="/census" className="font-semibold text-[var(--accent)]">
                Показать всех
              </Link>
            ) : progress.linked < progress.total ? (
              <Link
                href="/census?show=unlinked"
                className="font-semibold text-[var(--accent)]"
              >
                Кто ещё не связан
              </Link>
            ) : null}
          </p>
        ) : null}
      </div>
      <Link href="/people/new?census=1886" className="btn-primary text-center">
        Добавить человека из переписи
      </Link>
      <CensusList people={shown} linkedIds={linkedIds} />
    </div>
  );
}
