import {
  assertAccount,
  clearSessionCookie,
  hashPassword,
  normalizeLogin,
  setSessionCookie,
  verifyPassword,
  type SessionUser,
} from "@/lib/auth";
import { writeChangeLog } from "@/lib/changelog";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

function publicUser(user: {
  id: string;
  name: string;
  login: string;
  role: string;
}): SessionUser {
  return {
    id: user.id,
    name: user.name,
    login: user.login,
    role: user.role === "admin" ? "admin" : "editor",
  };
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const login = normalizeLogin(body.login);
    const password = String(body.password ?? "");
    const count = await prisma.user.count();

    if (count === 0) {
      const name = String(body.name ?? "").trim();
      assertAccount({ name, login, password });
      const user = await prisma.user.create({
        data: {
          name,
          login,
          passwordHash: hashPassword(password),
          role: "admin",
        },
      });
      await writeChangeLog(prisma, {
        action: "user.create",
        actor: name,
        payload: { login, role: "admin" },
      });
      const session = publicUser(user);
      await setSessionCookie(session);
      return Response.json({ user: session }, { status: 201 });
    }

    const user = await prisma.user.findUnique({ where: { login } });
    if (!user || !verifyPassword(password, user.passwordHash)) {
      return jsonError(new Error("Неверный логин или пароль"), 401);
    }
    const session = publicUser(user);
    await setSessionCookie(session);
    return Response.json({ user: session });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE() {
  await clearSessionCookie();
  return Response.json({ ok: true });
}
