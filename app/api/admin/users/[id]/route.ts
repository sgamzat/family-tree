import { appendAuthEvent, findAccount, updateAccount } from "@/lib/accounts";
import { assertPassword, hashPassword, parseRole, requireOwner } from "@/lib/auth";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/**
 * Владелец меняет аккаунт: роль, имя, включён ли, новый пароль.
 * Отключение и смена пароля завершают все сессии этого человека.
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const owner = await requireOwner();
    const { id } = await context.params;
    const before = findAccount(id);
    if (!before) throw new Error("Пользователь не найден");
    const body = (await request.json()) as Record<string, unknown>;

    const patch: Parameters<typeof updateAccount>[1] = {};
    if (body.role !== undefined) patch.role = parseRole(body.role);
    if (typeof body.name === "string" && body.name.trim()) patch.name = body.name;
    if (typeof body.active === "boolean") patch.active = body.active;
    if (typeof body.password === "string" && body.password) {
      assertPassword(body.password);
      patch.passwordHash = await hashPassword(body.password);
    }
    const after = updateAccount(id, patch);
    appendAuthEvent({
      type: patch.passwordHash ? "password.reset" : "account.update",
      userId: id,
      login: after.login,
      by: owner.id,
      details: {
        role: before.role !== after.role ? [before.role, after.role] : undefined,
        active: before.active !== after.active ? after.active : undefined,
      },
    });
    return Response.json({
      user: { id: after.id, name: after.name, login: after.login, role: after.role, active: after.active },
    });
  } catch (error) {
    return jsonError(error);
  }
}
