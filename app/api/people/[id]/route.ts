import { requireEditor, requireViewer } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { getFamily, updatePerson, deletePerson } from "@/lib/people";
import { parsePersonInput } from "@/lib/names";
import { createRequest } from "@/lib/requests";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireViewer();
    const { id } = await context.params;
    const family = await getFamily(id);
    if (!family) return jsonError(new Error("Человек не найден"), 404);
    return Response.json(family);
  } catch (error) {
    return jsonError(error, 500);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireEditor();
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const family = await updatePerson(id, parsePersonInput(body));
    return Response.json(family);
  } catch (error) {
    return jsonError(error);
  }
}

/**
 * Удаление: владелец удаляет сразу, остальные (кто может дописывать)
 * подают заявку — её подтверждает хранитель или владелец.
 */
export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireEditor();
    const { id } = await context.params;
    const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
    const reason = String(body.reason ?? "").trim();
    if (user.role === "owner") {
      await deletePerson(id, { reason });
      return Response.json({ ok: true });
    }
    const pending = await createRequest(user, { kind: "person.delete", personId: id, reason });
    return Response.json({ pending: true, requestId: pending.id }, { status: 202 });
  } catch (error) {
    return jsonError(error);
  }
}
