import { Suspense } from "react";
import { CreatePersonForm } from "@/components/create-person-form";
import { redirect } from "next/navigation";
import { canEdit, pageUser } from "@/lib/auth";

export default async function NewPersonPage({
  searchParams,
}: {
  searchParams: Promise<{ census?: string }>;
}) {
  const { census } = await searchParams;
  const fromCensus = census === "1886";
  const user = await pageUser(fromCensus ? "/people/new?census=1886" : "/people/new");
  if (!canEdit(user.role)) redirect("/");

  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {fromCensus ? "Человек из переписи 1886 года" : "Новый человек"}
        </h1>
        <p className="mt-1 text-[var(--muted)]">
          {fromCensus
            ? "Если такое имя уже есть в древе, выберите карточку. Новый человек не создаётся."
            : "Если такое ФИО уже вводили, выберите карточку — так деревья жителей срастутся в одно."}
        </p>
      </div>
      <Suspense>
        <CreatePersonForm census={fromCensus} />
      </Suspense>
    </div>
  );
}
