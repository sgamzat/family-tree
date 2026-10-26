import Link from "next/link";
import { HomeSearch } from "@/components/home-search";
import { censusProgress, clanCounts } from "@/lib/census";
import { listClans } from "@/lib/clan";
import { indexGraph } from "@/lib/graph";
import { loadKinGraph } from "@/lib/people";

export const dynamic = "force-dynamic";

const CLANS_ON_HOME = 6;

function Chevron() {
  return (
    <svg
      className="home-door-chevron"
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export default async function HomePage() {
  const [graph, clans] = await Promise.all([loadKinGraph(), listClans()]);
  const indexed = indexGraph(graph);
  const progress = censusProgress(indexed);
  const clanRows = clanCounts(indexed, clans).slice(0, CLANS_ON_HOME);
  const percent =
    progress.total > 0 ? Math.round((progress.linked / progress.total) * 100) : 0;

  return (
    <div className="home-page">
      <section className="home-hero">
        <p className="kicker kicker-census">Перепись 1886 · наши дни</p>
        <h1>От переписи 1886 года до наших дней</h1>
        <p className="home-lead">
          Найдите себя или предка и соедините свою линию с переписью.
        </p>
        <HomeSearch />
      </section>

      <nav className="home-doors" aria-label="С чего начать">
        <Link href="/people/new" className="home-door">
          <span className="home-door-icon" aria-hidden="true">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
            >
              <circle cx="12" cy="8" r="4" />
              <path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6" />
            </svg>
          </span>
          <span className="home-door-text">
            <span className="home-door-title">Начать с себя</span>
            <span className="home-door-hint">
              Внесите себя, родителей и дедов — и поднимайтесь к переписи
            </span>
          </span>
          <Chevron />
        </Link>
        <Link href="/census" className="home-door home-door-census">
          <span className="home-door-icon home-door-icon-census" aria-hidden="true">
            1886
          </span>
          <span className="home-door-text">
            <span className="home-door-title">Найти предка в переписи</span>
            <span className="home-door-hint">
              Откройте список 1886 года и спускайтесь к детям и внукам
            </span>
          </span>
          <Chevron />
        </Link>
      </nav>

      {progress.total > 0 ? (
        <section className="home-progress" aria-labelledby="home-progress-title">
          <p className="kicker" id="home-progress-title">
            Общее дело села
          </p>
          <p className="home-progress-line">
            <span className="home-progress-number serif">
              {progress.linked} из {progress.total}
            </span>
            <span>людей переписи уже связаны с живущими</span>
          </p>
          <div className="home-bar" aria-hidden="true">
            <div className="home-bar-fill" style={{ width: `${percent}%` }} />
          </div>
          {progress.linked < progress.total ? (
            <Link href="/census?show=unlinked" className="home-link">
              Кто ещё не связан
            </Link>
          ) : null}
        </section>
      ) : null}

      {clanRows.length > 0 ? (
        <section className="home-clans">
          <h2>Тухумы села</h2>
          <ul>
            {clanRows.map(({ clan, count }) => (
              <li key={clan.id}>
                {clan.founderId ? (
                  <Link href={`/people/${clan.founderId}`} className="home-clan-row">
                    <span className="home-clan-name">{clan.name}</span>
                    <span className="home-clan-count">{count} чел.</span>
                  </Link>
                ) : (
                  <span className="home-clan-row">
                    <span className="home-clan-name">{clan.name}</span>
                    <span className="home-clan-count">родоначальник не указан</span>
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="home-steps">
        <h2>Как это работает</h2>
        <ol>
          <li>
            <span className="home-step-number serif" aria-hidden="true">1</span>
            <span>Найдите себя или внесите, если вас ещё нет</span>
          </li>
          <li>
            <span className="home-step-number serif" aria-hidden="true">2</span>
            <span>Добавьте отца, деда и прадеда — кого помните</span>
          </li>
          <li>
            <span className="home-step-number serif" aria-hidden="true">3</span>
            <span>Когда линия дойдёт до 1886 года, она соединится с переписью</span>
          </li>
        </ol>
      </section>

      <section className="home-about">
        <h2>О селе и переписи</h2>
        <p>
          Здесь будет рассказ о селе: как оно называется, где стоит и что жители
          считают важным передать детям. И о том, откуда взялся лист переписи
          1886 года.
        </p>
      </section>
    </div>
  );
}
