import { TreeWorkspace } from "@/components/tree-workspace";
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
    <TreeWorkspace
      key={id}
      family={family}
      graph={graph}
      doubledById={doubledById}
      doubledAncestors={doubledAncestors}
    />
  );
}
