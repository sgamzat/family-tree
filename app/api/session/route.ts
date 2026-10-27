import { appendAuthEvent, updateAccount } from "@/lib/accounts";
import { clearSessionCookie, currentUser, signIn } from "@/lib/auth";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Вход. Аккаунты заводит владелец — самостоятельной регистрации нет. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const user = await signIn(body.login, String(body.password ?? ""));
    return Response.json({ user });
  } catch (error) {
    return jsonError(error);
  }
}

/** Выход. С ?all=1 — выйти на всех устройствах (старые сессии гаснут). */
export async function DELETE(request: Request) {
  const user = await currentUser();
  const all = new URL(request.url).searchParams.get("all") === "1";
  if (user && all) {
    updateAccount(user.id, { bumpSessions: true });
    appendAuthEvent({ type: "logout.all", userId: user.id, login: user.login });
  } else if (user) {
    appendAuthEvent({ type: "logout", userId: user.id, login: user.login });
  }
  await clearSessionCookie();
  return Response.json({ ok: true });
}
