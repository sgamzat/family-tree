import Link from "next/link";
import { CensusStamp } from "@/components/census-stamp";
import { formatFio, personYears, searchHitCaption, type PersonDTO, type SearchHit } from "@/lib/names";

type Props = {
  person: PersonDTO | SearchHit;
  href?: string;
  caption?: string | null;
  current?: boolean;
  onClick?: () => void;
};

export function PersonTile({ person, href, caption, current, onClick }: Props) {
  const extra = "fatherLabel" in person ? person.fatherLabel : caption;
  const details =
    "clanName" in person
      ? searchHitCaption(person, { census: false })
      : [personYears(person), extra].filter(Boolean).join(" · ");

  const content = (
    <>
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold leading-snug">{formatFio(person)}</span>
          {person.inCensus1886 ? <CensusStamp /> : null}
        </span>
        {details ? (
          <span className="mt-0.5 block text-sm text-[var(--muted)]">{details}</span>
        ) : null}
      </span>
    </>
  );

  const className = `flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
    current
      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
      : "border-[var(--line)] bg-[var(--card)] hover:border-[var(--accent)]"
  }`;

  if (onClick) {
    return (
      <button
        type="button"
        onPointerDown={(event) => {
          event.preventDefault();
          onClick();
        }}
        className={className}
      >
        {content}
      </button>
    );
  }

  if (href) {
    return (
      <Link href={href} className={className}>
        {content}
      </Link>
    );
  }

  return <div className={className}>{content}</div>;
}

export function AddSlot({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[72px] w-full items-center justify-center rounded-xl border border-dashed border-[var(--line-strong)] bg-transparent px-3 py-3 text-base font-semibold text-[var(--accent)]"
    >
      {label}
    </button>
  );
}
