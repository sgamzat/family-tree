import { HomeSearch } from "@/components/home-search";

export default function HomePage() {
  return (
    <div className="home-page">
      <h1>Древо села</h1>
      <p className="home-lead">Найдите себя или предка и допишите родных.</p>
      <HomeSearch />
      <section className="home-about">
        <h2>О селе</h2>
        <p>
          Здесь будет рассказ о селе: как оно называется, где стоит и что жители
          считают важным передать детям.
        </p>
      </section>
    </div>
  );
}
