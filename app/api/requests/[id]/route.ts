import { requireKeeper } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { decideRequest } from "@/lib/requests";

export const dynamic = "force-dynamic";

/** Решение по заявке: { decision: "approve" | "reject", note? }. */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireKeeper();
    const { id } = await context.params;
    const body = (await request.json()) as Record<string, unknown>;
    const decision = body.decision === "approve" ? "approve" : body.decision === "reject" ? "reject" : null;
    if (!decision) throw new Error("Укажите решение");
    const result = await decideRequest(user, id, decision, String(body.note ?? ""));
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
