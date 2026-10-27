import { TreeWorkspace } from "@/components/tree-workspace";
import { findAccountByPerson } from "@/lib/accounts";
import { canEdit, isKeeper, pageUser } from "@/lib/auth";
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
  const user = await pageUser(`/people/${id}`);
  const { kin, add, edit } = await searchParams;
  const family = await getFamily(id);
  if (!family) notFound();
  const kinWith = kin && kin !== id ? ((await getFamily(kin))?.person ?? null) : null;
  const [graph, pendingRequest] = await Promise.all([
    loadKinGraph(),
    prisma.changeRequest.findFirst({
      where: { personId: id, status: "pending" },
      orderBy: { createdAt: "desc" },
      select: { kind: true, requestedByName: true, reason: true },
    }),
  ]);
  const doubledAncestors = findDoubledAncestors(graph, id);
  const doubledById = Object.fromEntries(
    doubledAncestors.map((item) => [item.person.id, item.pathCount]),
  );
  const account = findAccountByPerson(id);
  const editor = canEdit(user.role);
  const me = {
    loggedIn: true,
    isMe: user.personId === id,
    canClaim: !user.personId && !account,
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
      keeper={isKeeper(user.role)}
      owner={user.role === "owner"}
      canEdit={editor}
      pendingRequest={pendingRequest}
      kinWith={kinWith}
      me={me}
      openRole={editor ? openRole : null}
      openEdit={editor && edit === "1"}
    />
  );
}
