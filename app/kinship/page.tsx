import { KinshipFinder } from "@/components/kinship-finder";
import { pageUser } from "@/lib/auth";
import { getFamily } from "@/lib/people";

export const dynamic = "force-dynamic";

export default async function KinshipPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  await pageUser("/kinship");
  const { from, to } = await searchParams;
  const [family, target] = await Promise.all([
    from ? getFamily(from) : null,
    to ? getFamily(to) : null,
  ]);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Родство</h1>
        <p className="mt-1 text-[var(--muted)]">
          Выберите двух людей — сразу видно, кем они приходятся. Если связаны и
          кровью, и через брак, покажем обе линии.
        </p>
      </div>
      <KinshipFinder
        initialFrom={family?.person ?? null}
        initialTo={target?.person ?? null}
      />
    </div>
  );
}
