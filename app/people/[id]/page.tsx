import { FamilyBoard } from "@/components/family-board";
import { PersonHeading } from "@/components/person-heading";
import { TreeExplorer } from "@/components/tree-explorer";
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

  return (
    <div className="grid gap-5">
      <PersonHeading person={family.person} clan={family.clan} />
      <TreeExplorer graph={graph} personId={id} />
      <FamilyBoard family={family} />
    </div>
  );
}
