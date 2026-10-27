import { requireKeeper } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { findDuplicatePairs, mergePeople } from "@/lib/duplicates";
import { createRequest } from "@/lib/requests";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await requireKeeper();
    const pairs = await findDuplicatePairs();
    return Response.json({ pairs });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireKeeper();
    const body = (await request.json()) as Record<string, unknown>;
    const keepId = String(body.keepId ?? "").trim();
    const dropId = String(body.dropId ?? "").trim();
    if (!keepId || !dropId || keepId === dropId) throw new Error("Укажите две разные карточки");
    // Владелец сливает сразу, хранитель — заявкой на подтверждение.
    if (user.role === "owner") {
      const person = await mergePeople(keepId, dropId);
      return Response.json({ person });
    }
    const pending = await createRequest(user, {
      kind: "person.merge",
      personId: dropId,
      keepId,
      reason: String(body.reason ?? ""),
    });
    return Response.json({ pending: true, requestId: pending.id }, { status: 202 });
  } catch (error) {
    return jsonError(error);
  }
}
