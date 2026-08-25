import { jsonError } from "@/lib/http";
import { getFamily, updatePerson, deletePerson } from "@/lib/people";
import { parsePersonInput } from "@/lib/names";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
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
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const family = await updatePerson(id, parsePersonInput(body));
    return Response.json(family);
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await context.params;
    await deletePerson(id);
    return Response.json({ ok: true });
  } catch (error) {
    return jsonError(error);
  }
}
