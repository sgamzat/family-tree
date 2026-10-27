import { requireViewer } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** Уже внесённые занятия — подсказки в форме, чтобы не было «кузнец» и «Кузнец» вразнобой. */
export async function GET() {
  try {
    await requireViewer();
    const rows = await prisma.person.findMany({
      where: { occupation: { not: "" } },
      select: { occupation: true },
    });
    const counts = new Map<string, number>();
    for (const { occupation } of rows) {
      const value = occupation.trim();
      if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
    }
    const occupations = [...counts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"))
      .map(([name]) => name)
      .slice(0, 200);
    return Response.json({ occupations });
  } catch (error) {
    return jsonError(error);
  }
}
