import { HomeSearch } from "@/components/home-search";
import { listRecentPeople } from "@/lib/people";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const recent = await listRecentPeople();

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Семейное древо</h1>
        <p className="mt-1 text-[var(--muted)]">
          Начните со себя и допишите родителей, дедов и прадедов. Если этот человек
          уже есть в семье односельчанина, выберите его: древа сойдутся в одну
          карточку, и будет видно, кем вы приходитесь.
        </p>
      </div>
      <HomeSearch recent={recent} />
    </div>
  );
}
