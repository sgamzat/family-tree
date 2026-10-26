import Link from "next/link";
import { CensusList } from "@/components/census-list";
import { listCensusPeople } from "@/lib/people";

export const dynamic = "force-dynamic";

export default async function CensusPage() {
  const people = await listCensusPeople();

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Перепись населения 1886 года
        </h1>
        <p className="mt-1 text-[var(--muted)]">
          Люди из листа переписи. Это те же карточки, что и в древе: добавьте
          человека, затем с его страницы — отца, мать и детей.
        </p>
      </div>
      <Link href="/people/new?census=1886" className="btn-primary text-center">
        Добавить человека
      </Link>
      <CensusList people={people} />
    </div>
  );
}
