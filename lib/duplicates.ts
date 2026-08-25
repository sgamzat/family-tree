import "server-only";

import { writeChangeLog } from "@/lib/changelog";
import { toClanDto } from "@/lib/clan";
import { prisma } from "@/lib/db";
import {
  nameFamily,
  normalizeName,
  type PersonDTO,
  type SearchHit,
} from "@/lib/names";

export type DuplicatePair = {
  a: SearchHit;
  b: SearchHit;
  reasons: string[];
};

function yearsOverlap(
  a: { birthYear: number | null; deathYear: number | null },
  b: { birthYear: number | null; deathYear: number | null },
): boolean {
  if (!a.birthYear || !b.birthYear) return true;
  const aFrom = a.birthYear;
  const aTo = a.deathYear ?? a.birthYear + 90;
  const bFrom = b.birthYear;
  const bTo = b.deathYear ?? b.birthYear + 90;
  return aFrom <= bTo && bFrom <= aTo;
}

function asHit(
  person: PersonDTO & {
    fatherName?: string | null;
    childNames?: string[];
    clanName?: string | null;
  },
): SearchHit {
  return {
    ...person,
    fatherLabel: person.fatherName
      ? `${person.gender === "male" ? "сын" : "дочь"} ${person.fatherName}`
      : null,
    clanName: person.clanName ?? null,
    childrenLabel: person.childNames?.length
      ? person.childNames.slice(0, 3).join(", ")
      : null,
    sameClan: false,
  };
}

export async function findDuplicatePairs(limit = 40): Promise<DuplicatePair[]> {
  const people = await prisma.person.findMany({
    include: {
      aliases: true,
      asChild: { include: { parent: true } },
      asParent: { include: { child: true } },
    },
  });

  type Row = {
    dto: PersonDTO;
    fatherName: string;
    fatherFamily: string;
    nameFamily: string;
    childNames: string[];
  };

  const rows: Row[] = people.map((person) => {
    const father =
      person.asChild.map((link) => link.parent).find((parent) => parent.gender === "male") ??
      null;
    return {
      dto: {
        id: person.id,
        lastName: person.lastName,
        firstName: person.firstName,
        patronymic: person.patronymic,
        gender: person.gender as PersonDTO["gender"],
        birthYear: person.birthYear,
        deathYear: person.deathYear,
        birthDateText: person.birthDateText,
        deathDateText: person.deathDateText,
        isLiving: person.isLiving,
        sourceNote: person.sourceNote,
        aliases: person.aliases.map((alias) => alias.name),
        claimedClanId: person.claimedClanId,
      },
      fatherName: father?.firstName ?? "",
      fatherFamily: father ? nameFamily(father.firstName) : "",
      nameFamily: nameFamily(person.firstName),
      childNames: person.asParent.map((link) => link.child.firstName).filter(Boolean),
    };
  });

  const groups = new Map<string, Row[]>();
  for (const row of rows) {
    if (!row.fatherFamily) continue;
    const key = `${row.nameFamily}|${row.fatherFamily}|${row.dto.gender}`;
    const list = groups.get(key) ?? [];
    list.push(row);
    groups.set(key, list);
  }

  const pairs: DuplicatePair[] = [];
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i];
        const b = list[j];
        if (!yearsOverlap(a.dto, b.dto)) continue;
        const reasons = [
          `имя ${a.dto.firstName} / ${b.dto.firstName}`,
          `отец ${a.fatherName}`,
        ];
        if (a.dto.birthYear && b.dto.birthYear) {
          reasons.push(`годы ${a.dto.birthYear} и ${b.dto.birthYear}`);
        }
        pairs.push({
          a: asHit({
            ...a.dto,
            fatherName: a.fatherName,
            childNames: a.childNames,
          }),
          b: asHit({
            ...b.dto,
            fatherName: b.fatherName,
            childNames: b.childNames,
          }),
          reasons,
        });
      }
    }
  }

  return pairs.slice(0, limit);
}

export async function mergePeople(keepId: string, dropId: string): Promise<PersonDTO> {
  if (!keepId || !dropId) throw new Error("Укажите двух людей");
  if (keepId === dropId) throw new Error("Нельзя слить человека с самим собой");

  const [keep, drop] = await Promise.all([
    prisma.person.findUnique({
      where: { id: keepId },
      include: {
        aliases: true,
        asChild: { include: { parent: true } },
        asParent: true,
        marriagesA: true,
        marriagesB: true,
        foundedClans: true,
      },
    }),
    prisma.person.findUnique({
      where: { id: dropId },
      include: {
        aliases: true,
        asChild: { include: { parent: true } },
        asParent: true,
        marriagesA: true,
        marriagesB: true,
        foundedClans: true,
      },
    }),
  ]);
  if (!keep || !drop) throw new Error("Человек не найден");

  const aliasNames = new Set(
    keep.aliases.map((alias) => alias.nameNorm),
  );
  const extraAliases: string[] = [];
  for (const name of [
    drop.firstName,
    drop.lastName,
    drop.patronymic,
    ...drop.aliases.map((alias) => alias.name),
  ]) {
    const trimmed = name.trim();
    if (!trimmed) continue;
    const key = normalizeName(trimmed);
    if (aliasNames.has(key)) continue;
    if (normalizeName(keep.firstName) === key) continue;
    if (normalizeName(keep.lastName) === key) continue;
    aliasNames.add(key);
    extraAliases.push(trimmed);
  }

  await prisma.$transaction(async (tx) => {
    for (const link of drop.asChild) {
      const keepHasSameGender = keep.asChild.some(
        (item) => item.parent.gender === link.parent.gender,
      );
      if (keepHasSameGender || link.parentId === keepId) {
        await tx.parentChild.delete({ where: { id: link.id } });
        continue;
      }
      const already = await tx.parentChild.findUnique({
        where: {
          parentId_childId: { parentId: link.parentId, childId: keepId },
        },
      });
      if (already) {
        await tx.parentChild.delete({ where: { id: link.id } });
        continue;
      }
      await tx.parentChild.update({
        where: { id: link.id },
        data: { childId: keepId },
      });
    }

    for (const link of drop.asParent) {
      if (link.childId === keepId) {
        await tx.parentChild.delete({ where: { id: link.id } });
        continue;
      }
      const already = await tx.parentChild.findUnique({
        where: {
          parentId_childId: { parentId: keepId, childId: link.childId },
        },
      });
      if (already) {
        await tx.parentChild.delete({ where: { id: link.id } });
        continue;
      }
      await tx.parentChild.update({
        where: { id: link.id },
        data: { parentId: keepId },
      });
    }

    const dropSpouseIds = [
      ...drop.marriagesA.map((marriage) => marriage.personBId),
      ...drop.marriagesB.map((marriage) => marriage.personAId),
    ];
    const keepSpouseIds = new Set([
      ...keep.marriagesA.map((marriage) => marriage.personBId),
      ...keep.marriagesB.map((marriage) => marriage.personAId),
    ]);
    for (const spouseId of dropSpouseIds) {
      await tx.marriage.deleteMany({
        where: {
          OR: [
            { personAId: dropId, personBId: spouseId },
            { personAId: spouseId, personBId: dropId },
          ],
        },
      });
      if (spouseId === keepId || keepSpouseIds.has(spouseId)) continue;
      const [personAId, personBId] =
        keepId < spouseId ? [keepId, spouseId] : [spouseId, keepId];
      await tx.marriage.create({ data: { personAId, personBId } });
      keepSpouseIds.add(spouseId);
    }

    if (drop.foundedClans.length > 0) {
      await tx.clan.updateMany({
        where: { founderId: dropId },
        data: { founderId: keepId },
      });
    }

    if (extraAliases.length > 0) {
      await tx.personAlias.createMany({
        data: extraAliases.map((name) => ({
          personId: keepId,
          name,
          nameNorm: normalizeName(name),
        })),
      });
    }

    await tx.person.update({
      where: { id: keepId },
      data: {
        lastName: keep.lastName || drop.lastName,
        patronymic: keep.patronymic || drop.patronymic,
        birthYear: keep.birthYear ?? drop.birthYear,
        deathYear: keep.deathYear ?? drop.deathYear,
        birthDateText: keep.birthDateText || drop.birthDateText,
        deathDateText: keep.deathDateText || drop.deathDateText,
        isLiving: keep.isLiving ?? drop.isLiving,
        sourceNote: keep.sourceNote || drop.sourceNote,
        claimedClanId: keep.claimedClanId ?? drop.claimedClanId,
        lastNameNorm: normalizeName(keep.lastName || drop.lastName),
        patronymicNorm: normalizeName(keep.patronymic || drop.patronymic),
      },
    });

    await writeChangeLog(tx, {
      action: "person.merge",
      personId: keepId,
      payload: {
        keepId,
        dropId,
        drop: {
          lastName: drop.lastName,
          firstName: drop.firstName,
          patronymic: drop.patronymic,
        },
        aliasesAdded: extraAliases,
        foundedClans: drop.foundedClans.map(toClanDto),
      },
    });

    await tx.person.delete({ where: { id: dropId } });
  });

  const merged = await prisma.person.findUnique({
    where: { id: keepId },
    include: { aliases: true },
  });
  if (!merged) throw new Error("Не удалось слить карточки");
  return {
    id: merged.id,
    lastName: merged.lastName,
    firstName: merged.firstName,
    patronymic: merged.patronymic,
    gender: merged.gender as PersonDTO["gender"],
    birthYear: merged.birthYear,
    deathYear: merged.deathYear,
    birthDateText: merged.birthDateText,
    deathDateText: merged.deathDateText,
    isLiving: merged.isLiving,
    sourceNote: merged.sourceNote,
    aliases: merged.aliases.map((alias) => alias.name),
    claimedClanId: merged.claimedClanId,
  };
}
