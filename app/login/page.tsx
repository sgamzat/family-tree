import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";
import { currentUser } from "@/lib/auth";
import { prisma } from "@/lib/db";

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
  const setup = (await prisma.user.count()) === 0;

  return (
    <div className="mx-auto grid w-full max-w-sm gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {setup ? "Первый вход" : "Вход"}
        </h1>
        <p className="mt-1 text-[var(--muted)]">
          {setup
            ? "Эту учётную запись заводит хранитель. Потом он откроет вход остальным, кто дописывает древо."
            : "Древо одно на всех. Войдите, чтобы было видно, кто дописал человека."}
        </p>
      </div>
      <Suspense>
        <LoginForm setup={setup} />
      </Suspense>
    </div>
  );
}
