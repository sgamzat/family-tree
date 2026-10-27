import { requireWriter } from "@/lib/auth";
import { writeChangeLog } from "@/lib/changelog";
import { prisma } from "@/lib/db";
import { HttpError, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** «Это я»: связать свой аккаунт с карточкой в древе. */
export async function POST(request: Request) {
  try {
    const user = await requireWriter();
    const body = (await request.json()) as Record<string, unknown>;
    const personId = String(body.personId ?? "").trim();
    if (!personId) throw new Error("Не указан человек");

    const [person, taken, me] = await Promise.all([
      prisma.person.findUnique({ where: { id: personId } }),
      prisma.user.findUnique({ where: { personId } }),
      prisma.user.findUnique({ where: { id: user.id } }),
    ]);
    if (!person) throw new HttpError("Человек не найден", 404);
    if (taken && taken.id !== user.id) {
      throw new HttpError("Эту карточку уже отметил другой житель", 409);
    }
    if (me?.personId && me.personId !== personId) {
      throw new HttpError("Вы уже отметили другую карточку. Сначала нажмите «Это не я» на ней.", 409);
    }

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { personId } });
      // Раз человек сам отметил себя — он жив.
      if (person.isLiving === null) {
        await tx.person.update({ where: { id: personId }, data: { isLiving: true } });
      }
      await writeChangeLog(tx, {
        action: "user.link",
        personId,
        actor: user.name,
        payload: { userId: user.id },
      });
    });
    return Response.json({ ok: true, personId });
  } catch (error) {
    return jsonError(error);
  }
}

/** «Это не я»: снять связь аккаунта с карточкой. */
export async function DELETE() {
  try {
    const user = await requireWriter();
    const me = await prisma.user.findUnique({ where: { id: user.id } });
    if (!me?.personId) return Response.json({ ok: true });
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: user.id }, data: { personId: null } });
      await writeChangeLog(tx, {
        action: "user.unlink",
        personId: me.personId,
        actor: user.name,
        payload: { userId: user.id },
      });
    });
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
