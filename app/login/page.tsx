import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { countAccounts } from "@/lib/accounts";
import { currentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const user = await currentUser();
  const { next } = await searchParams;
  if (user) {
    redirect(next?.startsWith("/") && !next.startsWith("//") ? next : "/");
  }
  const noAccounts = countAccounts() === 0;

  return (
    <div className="login-page">
      <div className="grid gap-2">
        <p className="kicker kicker-census">Перепись 1886 · наши дни</p>
        <h1>Древо села</h1>
        <p className="text-[var(--muted)]">
          Общее древо жителей села — от переписи 1886 года до наших дней. Вход только
          для жителей: логин и пароль выдаёт владелец древа.
        </p>
      </div>
      {noAccounts ? (
        <div className="login-setup">
          <p className="font-semibold">Владелец ещё не создан</p>
          <p>
            Создайте его на сервере одной командой (это делается один раз):
          </p>
          <pre>docker compose exec web node scripts/create-owner.mjs</pre>
        </div>
      ) : (
        <Suspense>
          <LoginForm />
        </Suspense>
      )}
    </div>
  );
}
