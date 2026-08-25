import Link from "next/link";
import { formatFio, formatYears, type PersonDTO, type SearchHit } from "@/lib/names";

type Props = {
  person: PersonDTO | SearchHit;
  href?: string;
  caption?: string | null;
  current?: boolean;
  onClick?: () => void;
};

export function PersonTile({ person, href, caption, current, onClick }: Props) {
  const years = formatYears(person.birthYear, person.deathYear);
  const extra = "fatherLabel" in person ? person.fatherLabel : caption;
  const details = [years, extra].filter(Boolean).join(" · ");

  const content = (
    <>
      <span
        className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
          person.gender === "male" ? "bg-[var(--male)]" : "bg-[var(--female)]"
        }`}
      />
      <span className="min-w-0">
        <span className="block font-medium leading-snug">{formatFio(person)}</span>
        {details ? (
          <span className="mt-0.5 block text-sm text-[var(--muted)]">{details}</span>
        ) : null}
      </span>
    </>
  );

  const className = `flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition ${
    current
      ? "border-[var(--accent)] bg-[var(--accent-soft)]"
      : "border-[var(--line)] bg-white hover:border-[var(--accent)]"
  }`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={className}>
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
      className="flex min-h-[72px] w-full items-center justify-center rounded-xl border border-dashed border-[var(--line-strong)] bg-[var(--slot)] px-3 py-3 text-sm font-medium text-[var(--accent)]"
    >
      {label}
    </button>
  );
}
