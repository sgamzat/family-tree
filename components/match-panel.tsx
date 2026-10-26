"use client";

import { useEffect, useRef } from "react";
import { CensusStamp } from "@/components/census-stamp";
import { formatFio, searchHitCaption, type Gender, type SearchHit } from "@/lib/names";

type Props = {
  hits: SearchHit[];
  loading: boolean;
  /** Пол того, кого сейчас вводят: от него зависят «он/она» и «Это он/Это она». */
  gender: Gender;
  /** ФИО из формы — показываем в подтверждении «создать нового». */
  typedName: string;
  saving: boolean;
  confirmingNew: boolean;
  onPick: (hit: SearchHit) => void;
  onAskNew: () => void;
  onCancelNew: () => void;
  onCreateNew: () => void;
};

/**
 * Совпадения при вводе человека: «Это он» соединяет семьи в одну карточку,
 * «другой человек» создаёт тёзку или однофамильца — после явного подтверждения.
 */
export function MatchPanel({
  hits,
  loading,
  gender,
  typedName,
  saving,
  confirmingNew,
  onPick,
  onAskNew,
  onCancelNew,
  onCreateNew,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const hadHits = useRef(false);
  const male = gender === "male";

  // Когда совпадения появились впервые — прокручиваем к ним, чтобы их не пропустили.
  useEffect(() => {
    if (hits.length > 0 && !hadHits.current) {
      ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
    hadHits.current = hits.length > 0;
  }, [hits.length]);

  if (loading && hits.length === 0) {
    return <p className="match-wait">Проверяем, нет ли {male ? "его" : "её"} уже в древе…</p>;
  }
  if (hits.length === 0) return null;

  return (
    <section ref={ref} className="match-panel" aria-labelledby="match-title">
      <div>
        <p className="match-title serif" id="match-title">
          {male ? "Возможно, он уже есть в древе" : "Возможно, она уже есть в древе"}
        </p>
        <p className="match-lead">
          Если это тот же человек, выберите {male ? "его" : "её"}: семьи сойдутся в одну
          карточку, и никто не будет вносить предков заново.
        </p>
      </div>

      <ul className="match-list">
        {hits.map((hit) => {
          const details = searchHitCaption(hit, { census: false });
          return (
            <li key={hit.id} className={`match-card ${hit.sameClan ? "is-near" : ""}`}>
              <div className="match-who">
                <p className="match-name">
                  <span>{formatFio(hit) || hit.firstName}</span>
                  {hit.inCensus1886 ? <CensusStamp /> : null}
                  {hit.sameClan ? <span className="match-badge">ваш тухум</span> : null}
                </p>
                {details ? <p className="match-details">{details}</p> : null}
              </div>
              <button
                type="button"
                className="match-pick"
                disabled={saving}
                onClick={() => onPick(hit)}
              >
                {hit.gender === "male" ? "Это он" : "Это она"}
              </button>
            </li>
          );
        })}
      </ul>

      {confirmingNew ? (
        <div className="match-confirm" role="alert">
          <p>
            Создадим нового человека{typedName ? <> «{typedName}»</> : null}. С теми, кто выше, {male ? "он" : "она"}{" "}
            связан{male ? "" : "а"} не будет — это {male ? "тёзка или однофамилец" : "тёзка или однофамилица"}.
          </p>
          <div className="match-confirm-actions">
            <button type="button" className="btn-primary" disabled={saving} onClick={onCreateNew}>
              {saving ? "Сохраняем…" : "Да, создать нового"}
            </button>
            <button type="button" className="match-back" disabled={saving} onClick={onCancelNew}>
              Назад
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="match-new" disabled={saving} onClick={onAskNew}>
          Нет, это другой человек — {male ? "тёзка или однофамилец" : "тёзка или однофамилица"}
        </button>
      )}
    </section>
  );
}
