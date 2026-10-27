import Link from "next/link";
import { HomeSearch } from "@/components/home-search";
import { pageUser, type CurrentUser } from "@/lib/auth";
import { censusProgress, clanCounts, type CensusProgress, type ClanCount } from "@/lib/census";
import { listClans } from "@/lib/clan";
import { prisma } from "@/lib/db";
import { indexGraph, type IndexedGraph } from "@/lib/graph";
import {
  buildFeed,
  gaps,
  myLine,
  plural,
  relativeDay,
  villageStats,
  type MyLine,
  type VillageStats,
} from "@/lib/home";
import { loadKinGraph } from "@/lib/people";
import { villageName } from "@/lib/site";

export const dynamic = "force-dynamic";

const CLANS_ON_HOME = 6;
const FEED_ENTRIES = 80;
const FEED_ITEMS = 5;

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

function generationsWord(n: number) {
  return plural(n, "поколение", "поколения", "поколений");
}

/** Полоса наверху: что это за место и насколько оно большое. */
function Village({
  village,
  stats,
  clans,
  progress,
  search,
}: {
  village: string | null;
  stats: VillageStats;
  clans: number;
  progress: CensusProgress;
  search: boolean;
}) {
  const percent = progress.total ? Math.round((progress.linked / progress.total) * 100) : 0;
  return (
    <section className="home-village" aria-labelledby="home-village-title">
      <div className="home-village-about">
        <h1 id="home-village-title">{village ? `Общее древо села ${village}` : "Общее древо села"}</h1>
        <p>Все семьи села — от переписи 1886 года до наших дней. Каждый дописывает свою ветку.</p>
      </div>
      <dl className="home-stats">
        <div>
          <dt>{plural(stats.people, "человек", "человека", "человек")}</dt>
          <dd className="serif">{stats.people}</dd>
        </div>
        {clans > 0 ? (
          <div>
            <dt>{plural(clans, "тухум", "тухума", "тухумов")}</dt>
            <dd className="serif">{clans}</dd>
          </div>
        ) : null}
        {stats.generations > 1 ? (
          <div>
            <dt>{generationsWord(stats.generations)}</dt>
            <dd className="serif">{stats.generations}</dd>
          </div>
        ) : null}
        {progress.total > 0 ? (
          <div className="home-stat-census">
            <dt>
              <Link href="/census?show=unlinked">из переписи 1886 — с потомками до наших дней</Link>
            </dt>
            <dd className="serif">
              {progress.linked}
              <span> из {progress.total}</span>
            </dd>
            <div className="home-bar" aria-hidden="true">
              <div className="home-bar-fill" style={{ width: `${percent}%` }} />
            </div>
          </div>
        ) : null}
      </dl>
      {search ? (
        <div className="home-village-search">
          <HomeSearch />
        </div>
      ) : null}
    </section>
  );
}

function Clans({ rows, total }: { rows: ClanCount[]; total: number }) {
  if (rows.length === 0) return null;
  return (
    <section className="home-clans" aria-labelledby="home-clans-title">
      <h2 id="home-clans-title">Тухумы села</h2>
      <ul className="home-clan-chips">
        {rows.map(({ clan, count }) => (
          <li key={clan.id}>
            {clan.founderId ? (
              <Link href={`/people/${clan.founderId}?view=tukhum`} className="home-clan-chip">
                {clan.name}
                <span>{count}</span>
              </Link>
            ) : (
              <span className="home-clan-chip is-plain">{clan.name}</span>
            )}
          </li>
        ))}
      </ul>
      {total > rows.length ? (
        <p className="home-clans-more">и ещё {total - rows.length} — найдите родоначальника через поиск</p>
      ) : null}
    </section>
  );
}

function LineCard({ line, personId }: { line: MyLine; personId: string }) {
  const generations = line.steps.length - 1;
  const openTree = line.next.href !== `/people/${personId}`;
  return (
    <section className="home-line" aria-labelledby="home-line-title">
      <h2 id="home-line-title">Ваша линия</h2>
      <p className="home-line-note">
        {line.reachedCensus
          ? `Дошла до переписи 1886 года — ${generations} ${generationsWord(generations)} назад.`
          : `Известно ${line.steps.length} ${generationsWord(line.steps.length)}. До переписи 1886 года пока не дошла.`}
      </p>
      <ol className="home-chain">
        {line.steps.map((step, index) => (
          <li
            key={`${step.person.id}-${index}`}
            className={`${step.person.gender === "male" ? "is-male" : "is-female"}${
              step.person.inCensus1886 ? " is-census" : ""
            }`}
          >
            <Link href={`/people/${step.person.id}`}>
              <b>{step.person.firstName}</b>
              <span>
                {step.word}
                {step.person.birthYear ? ` · ${step.person.birthYear}` : ""}
                {step.person.inCensus1886 ? " · 1886" : ""}
              </span>
            </Link>
          </li>
        ))}
        {line.reachedCensus ? null : (
          <li className="is-gap">
            <span>
              <b>1886</b>
              <span>ещё не дошли</span>
            </span>
          </li>
        )}
      </ol>
      <div className="home-line-actions">
        <Link href={line.next.href} className="btn-primary text-center">
          {line.next.label}
        </Link>
        {openTree ? (
          <Link href={`/people/${personId}`} className="home-line-more">
            Открыть древо
          </Link>
        ) : null}
        {line.secondary ? (
          <Link href={line.secondary.href} className="home-line-more">
            {line.secondary.label}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

function FindMe() {
  return (
    <section className="home-line home-find-me" aria-labelledby="home-find-title">
      <h2 id="home-find-title">Найдите себя в древе</h2>
      <ol className="home-find-steps">
        <li>Найдите себя или родителя в поиске ниже.</li>
        <li>На своей карточке нажмите «Это я».</li>
        <li>Здесь появится ваша линия до переписи 1886 года и подсказки, кого дописать.</li>
      </ol>
      <HomeSearch />
      <p className="home-line-note">
        Вас ещё нет в древе? <Link href="/people/new">Добавьте себя</Link>.
      </p>
    </section>
  );
}

async function MemberHome({
  user,
  graph,
  progress,
  clans,
  village,
}: {
  user: CurrentUser;
  graph: IndexedGraph;
  progress: CensusProgress;
  clans: ClanCount[];
  village: string | null;
}) {
  const personId = user.personId && graph.byId.has(user.personId) ? user.personId : null;
  const line = personId ? myLine(graph, personId) : null;
  const todo = personId ? gaps(graph, personId, line) : [];
  const entries = await prisma.changeLog.findMany({
    orderBy: { createdAt: "desc" },
    take: FEED_ENTRIES,
    select: { action: true, personId: true, payload: true, createdAt: true },
  });
  const feed = buildFeed(entries, graph, user.name, FEED_ITEMS);
  const stats = villageStats(graph);
  const clansWithPeople = clans.filter((row) => row.count > 0);

  return (
    <div className={`home-member${line ? "" : " is-unlinked"}`}>
      <Village
        village={village}
        stats={stats}
        clans={clansWithPeople.length}
        progress={progress}
        search={Boolean(line)}
      />

      <div className="home-columns">
        <div className="home-main">
          {line && personId ? <LineCard line={line} personId={personId} /> : <FindMe />}

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
          <Clans rows={clansWithPeople.slice(0, CLANS_ON_HOME)} total={clansWithPeople.length} />
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
        </aside>
      </div>
    </div>
  );
}

export default async function HomePage() {
  const user = await pageUser("/");
  const [kin, clanList] = await Promise.all([loadKinGraph(), listClans()]);
  const graph = indexGraph(kin);
  const progress = censusProgress(graph);
  const clans = clanCounts(graph, clanList);

  return (
    <MemberHome user={user} graph={graph} progress={progress} clans={clans} village={villageName()} />
  );
}
