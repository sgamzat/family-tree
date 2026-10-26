/** Печать «1886»: человек записан в переписи населения 1886 года. */
export function CensusStamp({
  label,
  large = false,
}: {
  label?: string;
  large?: boolean;
}) {
  return (
    <span
      className={`census-stamp ${large ? "census-stamp-lg" : ""}`}
      title="Записан в переписи 1886 года"
    >
      <span className="census-stamp-year">1886</span>
      {label ? <span>{label}</span> : null}
    </span>
  );
}
