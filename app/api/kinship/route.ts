import { jsonError } from "@/lib/http";
import { getKinship } from "@/lib/people";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from") ?? "";
    const to = searchParams.get("to") ?? "";
    if (!from || !to) throw new Error("Укажите двух людей");
    const result = await getKinship(from, to);
    if ("error" in result) {
      return Response.json(result, { status: 200 });
    }
    return Response.json(result);
  } catch (error) {
    return jsonError(error);
  }
}
