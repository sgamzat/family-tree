import { jsonError } from "@/lib/http";
import { parsePersonInput } from "@/lib/names";
import { addRelation, parseRelationRole, unlinkRelation } from "@/lib/people";

export const dynamic = "force-dynamic";

function relationArgs(source: Record<string, unknown> | URLSearchParams) {
  const read = (key: string) => {
    if (source instanceof URLSearchParams) return source.get(key) ?? "";
    return String(source[key] ?? "").trim();
  };
  const personId = read("personId").trim();
  const relativeId = read("relativeId").trim();
  if (!personId) throw new Error("Не указан человек");
  return {
    personId,
    relativeId,
    role: parseRelationRole(read("role")),
  };
}

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
      sourceNote: String(body.sourceNote ?? "").trim(),
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

export async function DELETE(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const { personId, role, relativeId } = relationArgs(searchParams);
    if (!relativeId) throw new Error("Не указан родственник");
    const family = await unlinkRelation({ personId, role, relativeId });
    return Response.json(family);
  } catch (error) {
    return jsonError(error);
  }
}
