import { jsonError } from "@/lib/http";
import { parseGender, parsePersonInput } from "@/lib/names";
import {
  createPerson,
  listRecentPeople,
  searchPeople,
} from "@/lib/people";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get("q") ?? "";
    const lastName = searchParams.get("lastName") ?? "";
    const firstName = searchParams.get("firstName") ?? "";
    const patronymic = searchParams.get("patronymic") ?? "";
    const genderParam = searchParams.get("gender");
    const exclude = searchParams.getAll("exclude");
    const recent = searchParams.get("recent") === "1";

    if (recent && !query && !lastName && !firstName && !patronymic) {
      const people = await listRecentPeople();
      return Response.json({ people });
    }

    const gender = genderParam ? parseGender(genderParam) : undefined;
    const people = await searchPeople({
      query,
      lastName,
      firstName,
      patronymic,
      gender,
      excludeIds: exclude.filter(Boolean),
    });
    return Response.json({ people });
  } catch (error) {
    return jsonError(error);
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const person = await createPerson(parsePersonInput(body));
    return Response.json({ person }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
