import { appendAuthEvent, createAccount, normalizeLogin } from "@/lib/accounts";
import { assertAccount, hashPassword, parseRole, requireOwner } from "@/lib/auth";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Новый аккаунт. Заводит только владелец. */
export async function POST(request: Request) {
  try {
    const owner = await requireOwner();
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const login = normalizeLogin(body.login);
    const password = String(body.password ?? "");
    const role = parseRole(body.role ?? "editor");
    assertAccount({ name, login, password });

    const account = createAccount({
      name,
      login,
      passwordHash: await hashPassword(password),
      role,
      createdBy: owner.id,
    });
    appendAuthEvent({ type: "account.create", userId: account.id, login, by: owner.id, details: { role } });
    return Response.json(
      { user: { id: account.id, name: account.name, login: account.login, role: account.role } },
      { status: 201 },
    );
  } catch (error) {
    return jsonError(error);
  }
}
