import { CreatePersonForm } from "@/components/create-person-form";
import { Suspense } from "react";

export default function NewPersonPage() {
  return (
    <div className="grid gap-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Новый человек</h1>
        <p className="mt-1 text-[var(--muted)]">
          Если такое ФИО уже вводили, выберите карточку — так деревья жителей
          срастутся в одно.
        </p>
      </div>
      <Suspense>
        <CreatePersonForm />
      </Suspense>
    </div>
  );
}
