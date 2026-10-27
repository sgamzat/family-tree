import { TreeWorkspace } from "@/components/tree-workspace";
import { currentUser } from "@/lib/auth";
import { findDoubledAncestors } from "@/lib/kinship";
import { getFamily, loadKinGraph } from "@/lib/people";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kin?: string }>;
}) {
  const { id } = await params;
  const { kin } = await searchParams;
  const family = await getFamily(id);
  if (!family) notFound();
  const kinWith = kin && kin !== id ? ((await getFamily(kin))?.person ?? null) : null;
  const graph = await loadKinGraph();
  const doubledAncestors = findDoubledAncestors(graph, id);
  const doubledById = Object.fromEntries(
    doubledAncestors.map((item) => [item.person.id, item.pathCount]),
  );
  const user = await currentUser();

  return (
    <TreeWorkspace
      key={`${id}|${kinWith?.id ?? ""}`}
      family={family}
      graph={graph}
      doubledById={doubledById}
      doubledAncestors={doubledAncestors}
      keeper={user?.role === "admin"}
      kinWith={kinWith}
    />
  );
}
