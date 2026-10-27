import Link from "next/link";
import { HomeSearch } from "@/components/home-search";
import { currentUser, type CurrentUser } from "@/lib/auth";
import { censusProgress, clanCounts, type CensusProgress, type ClanCount } from "@/lib/census";
import { listClans } from "@/lib/clan";
import { prisma } from "@/lib/db";
import { indexGraph, type IndexedGraph } from "@/lib/graph";
import { buildFeed, gaps, myLine, relativeDay } from "@/lib/home";
import { loadKinGraph } from "@/lib/people";

export const dynamic = "force-dynamic";

const CLANS_ON_HOME = 6;
const FEED_ENTRIES = 80;

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

function Progress({ progress, compact = false }: { progress: CensusProgress; compact?: boolean }) {
  if (progress.total === 0) return null;
  const percent = Math.round((progress.linked / progress.total) * 100);
  return (
    <section
      className={compact ? "home-progress home-progress-card" : "home-progress"}
      aria-labelledby="home-progress-title"
    >
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
  );
}

function Clans({ rows }: { rows: ClanCount[] }) {
  if (rows.length === 0) return null;
  return (
    <section className="home-clans">
      <h2>Тухумы села</h2>
      <ul>
        {rows.map(({ clan, count }) => (
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
  );
}

function GuestHome({ progress, clans }: { progress: CensusProgress; clans: ClanCount[] }) {
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
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

      <Progress progress={progress} />
      <Clans rows={clans} />

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

async function MemberHome({
  user,
  graph,
  progress,
  clans,
}: {
  user: CurrentUser;
  graph: IndexedGraph;
  progress: CensusProgress;
  clans: ClanCount[];
}) {
  const personId = user.personId && graph.byId.has(user.personId) ? user.personId : null;
  const line = personId ? myLine(graph, personId) : null;
  const todo = personId ? gaps(graph, personId, line) : [];
  const entries = await prisma.changeLog.findMany({
    orderBy: { createdAt: "desc" },
    take: FEED_ENTRIES,
    select: { action: true, personId: true, payload: true, createdAt: true },
  });
  const feed = buildFeed(entries, graph, user.name);
  const firstName = (personId ? graph.byId.get(personId)?.firstName : null) ?? user.name;

  return (
    <div className="home-member">
      <header className="home-greeting">
        <p>Добро пожаловать</p>
        <h1>{firstName}</h1>
      </header>

      <div className="home-columns">
        <div className="home-main">
          {line ? (
            <section className="home-line" aria-labelledby="home-line-title">
              <div className="home-line-head">
                <h2 id="home-line-title">Ваша линия</h2>
                <Link href={`/people/${personId}`} className="home-link">
                  Открыть древо
                </Link>
              </div>
              <p className="home-line-note">
                {line.reachedCensus
                  ? `Линия дошла до переписи 1886 года — через ${line.steps.length - 1} ${line.steps.length - 1 === 1 ? "поколение" : line.steps.length - 1 < 5 ? "поколения" : "поколений"}.`
                  : `Известно поколений: ${line.steps.length}. До переписи 1886 линия пока не дошла.`}
              </p>
              <ol className="home-line-steps">
                {line.steps.map((step, index) => (
                  <li
                    key={`${step.person.id}-${index}`}
                    className={step.person.gender === "male" ? "is-male" : "is-female"}
                  >
                    <Link href={`/people/${step.person.id}`}>{step.person.firstName}</Link>
                    <span>
                      {step.word}
                      {step.person.birthYear ? ` · ${step.person.birthYear}` : ""}
                      {step.person.inCensus1886 ? " · 1886" : ""}
                    </span>
                  </li>
                ))}
                {line.reachedCensus ? null : (
                  <li className="is-gap">
                    <span className="census-stamp">
                      <span className="census-stamp-year">1886</span>
                    </span>
                    <span>перепись — ещё не дошли</span>
                  </li>
                )}
              </ol>
              <div className="home-line-actions">
                <Link href={line.next.href} className="btn-primary text-center">
                  {line.next.label}
                </Link>
                {line.secondary ? (
                  <Link href={line.secondary.href} className="home-line-more">
                    {line.secondary.label}
                  </Link>
                ) : null}
              </div>
            </section>
          ) : (
            <section className="home-line home-find-me" aria-labelledby="home-find-title">
              <h2 id="home-find-title">Найдите себя в древе</h2>
              <p className="home-line-note">
                Откройте свою карточку и нажмите «Это я». Тогда здесь появится ваша
                линия до переписи и подсказки, кого дописать. Если вас ещё нет —{" "}
                <Link href="/people/new">добавьте себя</Link>.
              </p>
              <HomeSearch />
            </section>
          )}

          {todo.length > 0 ? (
            <section className="home-todo" aria-labelledby="home-todo-title">
              <h2 id="home-todo-title">Что дописать</h2>
              <ul>
                {todo.map((gap) => (
                  <li key={gap.key}>
                    <Link href={gap.href} className="home-todo-item">
                      <span className="home-todo-text">
                        <span className="home-todo-title">{gap.title}</span>
                        <span className="home-todo-hint">{gap.hint}</span>
                      </span>
                      <Chevron />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>

        <aside className="home-side">
          <Progress progress={progress} compact />
          {feed.length > 0 ? (
            <section className="home-feed" aria-labelledby="home-feed-title">
              <h2 id="home-feed-title">Новое в селе</h2>
              <ul>
                {feed.map((item) => (
                  <li key={item.key}>
                    <span>
                      <b>{item.isYou ? "Вы" : item.actor}</b>: {item.text}
                    </span>
                    <span className="home-feed-when">{relativeDay(item.date)}</span>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          <Clans rows={clans} />
        </aside>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const [kin, clanList, user] = await Promise.all([loadKinGraph(), listClans(), currentUser()]);
  const graph = indexGraph(kin);
  const progress = censusProgress(graph);
  const clans = clanCounts(graph, clanList).slice(0, CLANS_ON_HOME);

  if (!user) return <GuestHome progress={progress} clans={clans} />;
  return <MemberHome user={user} graph={graph} progress={progress} clans={clans} />;
}
