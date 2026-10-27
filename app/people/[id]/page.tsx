import { TreeWorkspace } from "@/components/tree-workspace";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { findDoubledAncestors } from "@/lib/kinship";
import { getFamily, loadKinGraph } from "@/lib/people";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kin?: string; add?: string; edit?: string }>;
}) {
  const { id } = await params;
  const { kin, add, edit } = await searchParams;
  const family = await getFamily(id);
  if (!family) notFound();
  const kinWith = kin && kin !== id ? ((await getFamily(kin))?.person ?? null) : null;
  const graph = await loadKinGraph();
  const doubledAncestors = findDoubledAncestors(graph, id);
  const doubledById = Object.fromEntries(
    doubledAncestors.map((item) => [item.person.id, item.pathCount]),
  );
  const user = await currentUser();
  const account = await prisma.user.findUnique({ where: { personId: id } });
  const me = {
    loggedIn: Boolean(user),
    isMe: Boolean(user && user.personId === id),
    canClaim: Boolean(user && !user.personId && !account),
  };
  const openRole =
    add === "father" || add === "mother" || add === "spouse" || add === "child" ? add : null;

  return (
    <TreeWorkspace
      key={`${id}|${kinWith?.id ?? ""}`}
      family={family}
      graph={graph}
      doubledById={doubledById}
      doubledAncestors={doubledAncestors}
      keeper={user?.role === "admin"}
      kinWith={kinWith}
      me={me}
      openRole={user ? openRole : null}
      openEdit={Boolean(user) && edit === "1"}
    />
  );
}
