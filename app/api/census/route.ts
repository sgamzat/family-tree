import { requireWriter } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { markPersonInCensus1886 } from "@/lib/people";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireWriter();
    const body = (await request.json()) as { personId?: unknown };
    const personId = String(body.personId ?? "").trim();
    if (!personId) return jsonError(new Error("Не указан человек"));
    const person = await markPersonInCensus1886(personId);
    return Response.json({ person });
  } catch (error) {
    return jsonError(error);
  }
}
