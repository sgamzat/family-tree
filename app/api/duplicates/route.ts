import { requireKeeper } from "@/lib/auth";
import { jsonError } from "@/lib/http";
import { findDuplicatePairs, mergePeople } from "@/lib/duplicates";

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
    await requireKeeper();
    const body = (await request.json()) as Record<string, unknown>;
    const keepId = String(body.keepId ?? "").trim();
    const dropId = String(body.dropId ?? "").trim();
    const person = await mergePeople(keepId, dropId);
    return Response.json({ person });
  } catch (error) {
    return jsonError(error);
  }
}
