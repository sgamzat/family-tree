import { jsonError } from "@/lib/http";
import { getFamily } from "@/lib/people";

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
