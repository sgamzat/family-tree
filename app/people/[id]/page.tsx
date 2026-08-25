import { FamilyBoard } from "@/components/family-board";
import { PersonHeading } from "@/components/person-heading";
import { TreeExplorer } from "@/components/tree-explorer";
import { findDoubledAncestors } from "@/lib/kinship";
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
  const doubledAncestors = findDoubledAncestors(graph, id);
  const doubledById = Object.fromEntries(
    doubledAncestors.map((item) => [item.person.id, item.pathCount]),
  );

  return (
    <div className="grid gap-5">
      <PersonHeading
        person={family.person}
        clan={family.clan}
        foundedClans={family.foundedClans}
        doubledAncestors={doubledAncestors}
      />
      <TreeExplorer graph={graph} personId={id} doubledById={doubledById} />
      <FamilyBoard family={family} />
    </div>
  );
}
