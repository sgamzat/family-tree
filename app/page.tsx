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
          Один общий род села. Если человек уже есть — выберите его, не создавайте
          заново. На карточке видно древо, а в разделе «Родство» можно узнать, кем
          приходятся двое людей.
        </p>
      </div>
      <HomeSearch recent={recent} />
    </div>
  );
}
