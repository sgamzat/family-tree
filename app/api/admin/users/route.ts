import { Prisma } from "@prisma/client";
import {
  assertAccount,
  hashPassword,
  normalizeLogin,
  parseRole,
  requireKeeper,
} from "@/lib/auth";
import { writeChangeLog } from "@/lib/changelog";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const keeper = await requireKeeper();
    const body = (await request.json()) as Record<string, unknown>;
    const name = String(body.name ?? "").trim();
    const login = normalizeLogin(body.login);
    const password = String(body.password ?? "");
    const role = parseRole(body.role);
    assertAccount({ name, login, password });

    const user = await prisma.user.create({
      data: {
        name,
        login,
        passwordHash: hashPassword(password),
        role,
      },
    });
    await writeChangeLog(prisma, {
      action: "user.create",
      actor: keeper.name,
      payload: { login, role, name },
    });
    return Response.json(
      { user: { id: user.id, name: user.name, login: user.login, role: user.role } },
      { status: 201 },
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return jsonError(new Error("Такой логин уже есть"));
    }
    return jsonError(error);
  }
}
