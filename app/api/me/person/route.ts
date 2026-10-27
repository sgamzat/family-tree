import { findAccount, findAccountByPerson, updateAccount } from "@/lib/accounts";
import { requireViewer } from "@/lib/auth";
import { writeChangeLog } from "@/lib/changelog";
import { prisma } from "@/lib/db";
import { HttpError, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** «Это я»: связать свой аккаунт с карточкой в древе. */
export async function POST(request: Request) {
  try {
    const user = await requireViewer();
    const body = (await request.json()) as Record<string, unknown>;
    const personId = String(body.personId ?? "").trim();
    if (!personId) throw new Error("Не указан человек");

    const person = await prisma.person.findUnique({ where: { id: personId } });
    if (!person) throw new HttpError("Человек не найден", 404);
    const taken = findAccountByPerson(personId);
    if (taken && taken.id !== user.id) {
      throw new HttpError("Эту карточку уже отметил другой житель", 409);
    }
    const me = findAccount(user.id);
    if (me?.personId && me.personId !== personId) {
      throw new HttpError("Вы уже отметили другую карточку. Сначала нажмите «Это не я» на ней.", 409);
    }

    updateAccount(user.id, { personId });
    await prisma.$transaction(async (tx) => {
      // Раз человек сам отметил себя — он жив.
      if (person.isLiving === null) {
        await tx.person.update({ where: { id: personId }, data: { isLiving: true } });
      }
      await writeChangeLog(tx, { action: "user.link", personId, actor: user });
    });
    return Response.json({ ok: true, personId });
  } catch (error) {
    return jsonError(error);
  }
}

/** «Это не я»: снять связь аккаунта с карточкой. */
export async function DELETE() {
  try {
    const user = await requireViewer();
    const me = findAccount(user.id);
    if (!me?.personId) return Response.json({ ok: true });
    const personId = me.personId;
    updateAccount(user.id, { personId: null });
    await writeChangeLog(prisma, { action: "user.unlink", personId, actor: user });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
