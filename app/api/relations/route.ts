import { jsonError } from "@/lib/http";
import { parsePersonInput } from "@/lib/names";
import { addRelation, parseRelationRole } from "@/lib/people";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const personId = String(body.personId ?? "").trim();
    if (!personId) throw new Error("Не указан человек");

    const existingPersonId = body.existingPersonId
      ? String(body.existingPersonId)
      : undefined;
    const newPerson = body.newPerson
      ? parsePersonInput(body.newPerson as Record<string, unknown>)
      : undefined;

    const family = await addRelation({
      personId,
      role: parseRelationRole(body.role),
      existingPersonId,
      newPerson,
    });
    return Response.json(family);
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (message.includes("Unique constraint")) {
      return jsonError(new Error("Такая родственная связь уже есть"));
    }
    return jsonError(error);
  }
}
