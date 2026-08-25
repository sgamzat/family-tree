import Link from "next/link";
import { personYears, type PersonDTO } from "@/lib/names";
import type { AncestorNode, ClanTree, DescentNode, PersonTree } from "@/lib/tree";

function TreeCard({
  person,
  current,
  doubledById,
}: {
  person: PersonDTO;
  current?: boolean;
  doubledById?: Record<string, number>;
}) {
  const years = personYears(person);
  const pathCount = doubledById?.[person.id];
  return (
    <Link
      href={`/people/${person.id}`}
      className={`tree-card ${current ? "tree-card-current" : ""} ${
        person.gender === "male" ? "tree-card-male" : "tree-card-female"
      }`}
    >
      <span className="block font-medium leading-snug">{person.firstName}</span>
      {person.lastName ? (
        <span className="block text-xs text-[var(--muted)]">{person.lastName}</span>
      ) : null}
      {years ? <span className="block text-xs text-[var(--muted)]">{years}</span> : null}
      {pathCount && pathCount > 1 ? (
        <span className="mt-1 inline-block rounded-full bg-[var(--accent-soft)] px-1.5 py-0.5 text-[0.65rem] font-semibold text-[var(--accent)]">
          ×{pathCount}
        </span>
      ) : null}
    </Link>
  );
}

function Couple({
  person,
  spouses,
  current,
  doubledById,
}: {
  person: PersonDTO;
  spouses: PersonDTO[];
  current?: boolean;
  doubledById?: Record<string, number>;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      <TreeCard person={person} current={current} doubledById={doubledById} />
      {spouses.map((spouse) => (
        <span key={spouse.id} className="flex items-center gap-1">
          <span className="text-[var(--muted)]">—</span>
          <TreeCard person={spouse} doubledById={doubledById} />
        </span>
      ))}
    </div>
  );
}

function TreeArrow({ label }: { label?: string }) {
  return (
    <div className="tree-arrow">
      <span className="tree-arrow-shaft" />
      <span className="tree-arrow-head" />
      {label ? <span className="tree-arrow-label">{label}</span> : null}
    </div>
  );
}

function AncestorBranch({
  node,
  doubledById,
}: {
  node: AncestorNode | null;
  doubledById?: Record<string, number>;
}) {
  if (!node) return null;
  const hasParents = node.father || node.mother;
  return (
    <div className="flex flex-col items-center">
      {hasParents ? (
        <div className="flex items-end justify-center gap-4">
          <AncestorBranch node={node.father} doubledById={doubledById} />
          <AncestorBranch node={node.mother} doubledById={doubledById} />
        </div>
      ) : null}
      {hasParents ? <TreeArrow /> : null}
      <TreeCard person={node.person} doubledById={doubledById} />
    </div>
  );
}

function DescentList({
  nodes,
  currentId,
  doubledById,
}: {
  nodes: DescentNode[];
  currentId: string;
  doubledById?: Record<string, number>;
}) {
  if (nodes.length === 0) return null;
  return (
    <ul>
      {nodes.map((node) => (
        <li key={node.person.id}>
          <Couple
            person={node.person}
            spouses={node.spouses}
            current={node.person.id === currentId}
            doubledById={doubledById}
          />
          <DescentList
            nodes={node.children}
            currentId={currentId}
            doubledById={doubledById}
          />
        </li>
      ))}
    </ul>
  );
}

export function LineageTree({
  tree,
  doubledById,
}: {
  tree: PersonTree;
  doubledById?: Record<string, number>;
}) {
  const { father, mother } = tree.ancestors;
  const hasAncestors = Boolean(father || mother);
  const hasDescendants = tree.descendants.children.length > 0;

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2">
      <div className="inline-flex min-w-full flex-col items-center gap-0 py-2">
        {hasAncestors ? (
          <div className="flex items-end justify-center gap-6">
            <AncestorBranch node={father} doubledById={doubledById} />
            <AncestorBranch node={mother} doubledById={doubledById} />
          </div>
        ) : null}
        {hasAncestors ? <TreeArrow /> : null}

        <div className="flex flex-wrap items-center justify-center gap-2">
          {tree.siblings.map((sibling) => (
            <TreeCard key={sibling.id} person={sibling} doubledById={doubledById} />
          ))}
          <Couple
            person={tree.person}
            spouses={tree.descendants.spouses}
            current
            doubledById={doubledById}
          />
        </div>

        {hasDescendants ? (
          <>
            <TreeArrow label="дети" />
            <div className="ftree">
              <DescentList
                nodes={tree.descendants.children}
                currentId={tree.person.id}
                doubledById={doubledById}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function ClanTreeView({
  tree,
  doubledById,
}: {
  tree: ClanTree;
  doubledById?: Record<string, number>;
}) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2">
      <div className="flex flex-col items-center">
        <Couple
          person={tree.root.person}
          spouses={tree.root.spouses}
          current={tree.root.person.id === tree.focus.id}
          doubledById={doubledById}
        />
        {tree.root.children.length > 0 ? (
          <>
            <TreeArrow label="потомки" />
            <div className="ftree">
              <DescentList
                nodes={tree.root.children}
                currentId={tree.focus.id}
                doubledById={doubledById}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
