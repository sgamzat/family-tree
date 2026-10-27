import { requireKeeper } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { restorePerson } from "@/lib/people";

export const dynamic = "force-dynamic";

/** Вернуть удалённого человека по записи журнала. */
export async function POST(request: Request) {
  try {
    await requireKeeper();
    const body = (await request.json()) as Record<string, unknown>;
    const person = await restorePerson(String(body.logId ?? ""));
    return Response.json({ person });
  } catch (error) {
    return jsonError(error);
  }
}
