import Link from "next/link";
import { formatYears, type PersonDTO } from "@/lib/names";
import type { AncestorNode, ClanTree, DescentNode, PersonTree } from "@/lib/tree";

function TreeCard({
  person,
  current,
}: {
  person: PersonDTO;
  current?: boolean;
}) {
  const years = formatYears(person.birthYear, person.deathYear);
  return (
    <Link
      href={`/people/${person.id}`}
      className={`tree-card ${current ? "tree-card-current" : ""} ${
        person.gender === "male" ? "tree-card-male" : "tree-card-female"
      }`}
    >
      <span className="block font-medium leading-snug">{person.firstName}</span>
      <span className="block text-xs text-[var(--muted)]">{person.lastName}</span>
      {years ? <span className="block text-xs text-[var(--muted)]">{years}</span> : null}
    </Link>
  );
}

function Couple({
  person,
  spouses,
  current,
}: {
  person: PersonDTO;
  spouses: PersonDTO[];
  current?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center justify-center gap-1">
      <TreeCard person={person} current={current} />
      {spouses.map((spouse) => (
        <span key={spouse.id} className="flex items-center gap-1">
          <span className="text-[var(--muted)]">—</span>
          <TreeCard person={spouse} />
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

function AncestorBranch({ node }: { node: AncestorNode | null }) {
  if (!node) return null;
  const hasParents = node.father || node.mother;
  return (
    <div className="flex flex-col items-center">
      {hasParents ? (
        <div className="flex items-end justify-center gap-4">
          <AncestorBranch node={node.father} />
          <AncestorBranch node={node.mother} />
        </div>
      ) : null}
      {hasParents ? <TreeArrow /> : null}
      <TreeCard person={node.person} />
    </div>
  );
}

function DescentList({
  nodes,
  currentId,
}: {
  nodes: DescentNode[];
  currentId: string;
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
          />
          <DescentList nodes={node.children} currentId={currentId} />
        </li>
      ))}
    </ul>
  );
}

export function LineageTree({ tree }: { tree: PersonTree }) {
  const { father, mother } = tree.ancestors;
  const hasAncestors = Boolean(father || mother);
  const hasDescendants = tree.descendants.children.length > 0;

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2">
      <div className="inline-flex min-w-full flex-col items-center gap-0 py-2">
        {hasAncestors ? (
          <div className="flex items-end justify-center gap-6">
            <AncestorBranch node={father} />
            <AncestorBranch node={mother} />
          </div>
        ) : null}
        {hasAncestors ? <TreeArrow /> : null}

        <div className="flex flex-wrap items-center justify-center gap-2">
          {tree.siblings.map((sibling) => (
            <TreeCard key={sibling.id} person={sibling} />
          ))}
          <Couple
            person={tree.person}
            spouses={tree.descendants.spouses}
            current
          />
        </div>

        {hasDescendants ? (
          <>
            <TreeArrow label="дети" />
            <div className="ftree">
              <DescentList
                nodes={tree.descendants.children}
                currentId={tree.person.id}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export function ClanTreeView({ tree }: { tree: ClanTree }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2">
      <div className="flex flex-col items-center">
        <Couple
          person={tree.root.person}
          spouses={tree.root.spouses}
          current={tree.root.person.id === tree.focus.id}
        />
        {tree.root.children.length > 0 ? (
          <>
            <TreeArrow label="потомки" />
            <div className="ftree">
              <DescentList nodes={tree.root.children} currentId={tree.focus.id} />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
