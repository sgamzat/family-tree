import { FamilyBoard } from "@/components/family-board";
import { TreeExplorer } from "@/components/tree-explorer";
import { formatFio, formatYears } from "@/lib/names";
import { getFamily, loadKinGraph } from "@/lib/people";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PersonPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const family = await getFamily(id);
  if (!family) notFound();
  const graph = await loadKinGraph();

  const years = formatYears(family.person.birthYear, family.person.deathYear);

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {formatFio(family.person)}
        </h1>
        <p className="mt-1 text-[var(--muted)]">
          {[years, family.person.gender === "male" ? "мужчина" : "женщина"]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </div>
      <TreeExplorer graph={graph} personId={id} />
      <FamilyBoard family={family} />
    </div>
  );
}
