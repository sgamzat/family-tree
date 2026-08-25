import { jsonError } from "@/lib/http";
import { createClan, listClans } from "@/lib/clan";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const clans = await listClans();
    return Response.json({ clans });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const clan = await createClan({
      name: String(body.name ?? ""),
      founderId: String(body.founderId ?? "").trim() || null,
      parentClanId: String(body.parentClanId ?? "").trim() || null,
    });
    return Response.json({ clan }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
