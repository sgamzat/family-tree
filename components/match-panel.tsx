"use client";

import { useEffect, useRef } from "react";
import { CensusStamp } from "@/components/census-stamp";
import { formatFio, searchHitCaption, type Gender, type SearchHit } from "@/lib/names";

type Props = {
  hits: SearchHit[];
  loading: boolean;
  /** Пол того, кого сейчас вводят: от него зависят «он/она». */
  gender: Gender;
  saving: boolean;
  /** «Нет, это другой человек» уже нажато — показываем одну строку. */
  dismissed: boolean;
  /** Подсветить: пытались сохранить, не ответив на вопрос. */
  attention?: boolean;
  onPick: (hit: SearchHit) => void;
  onDismiss: () => void;
  onUndo: () => void;
};

/**
 * Совпадения сразу под именем: «Это он» соединяет семьи в одну карточку и
 * дальше заполнять ничего не нужно; «другой человек» — дописываем тёзку.
 */
export function MatchPanel({
  hits,
  loading,
  gender,
  saving,
  dismissed,
  attention = false,
  onPick,
  onDismiss,
  onUndo,
}: Props) {
  const ref = useRef<HTMLElement>(null);
  const male = gender === "male";
  const namesake = male ? "тёзка или однофамилец" : "тёзка или однофамилица";

  useEffect(() => {
    if (attention) ref.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [attention]);

  if (loading && hits.length === 0) {
    return <p className="match-wait">Проверяем, нет ли {male ? "его" : "её"} уже в древе…</p>;
  }
  if (hits.length === 0) return null;

  if (dismissed) {
    return (
      <p className="match-dismissed">
        Внесём как нового человека — {namesake}.{" "}
        <button type="button" className="quiet-link" onClick={onUndo}>
          Показать похожих
        </button>
      </p>
    );
  }

  return (
    <section
      ref={ref}
      className={`match-panel${attention ? " is-attention" : ""}`}
      aria-labelledby="match-title"
    >
      <div>
        <p className="match-title serif" id="match-title">
          {male ? "Возможно, он уже есть в древе" : "Возможно, она уже есть в древе"}
        </p>
        <p className="match-lead">
          Если это {male ? "он" : "она"}, нажмите «{male ? "Это он" : "Это она"}» — дальше заполнять
          ничего не нужно, семьи сойдутся в одну карточку.
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

      <button type="button" className="match-new" disabled={saving} onClick={onDismiss}>
        Нет, это другой человек — {namesake}
      </button>
    </section>
  );
}
