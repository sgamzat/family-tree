import "server-only";

import { Prisma, type Person } from "@prisma/client";
import { writeChangeLog } from "@/lib/changelog";
import { resolvePersonClan } from "@/lib/clan";
import { prisma } from "@/lib/db";
import { findKinship } from "@/lib/kinship";
import { buildPersonTree } from "@/lib/tree";
import type { KinGraph } from "@/lib/graph";
import {
  fatherLabel,
  formatFio,
  nameTokens,
  normalizeName,
  type FamilyDTO,
  type Gender,
  type PersonDTO,
  type PersonInput,
  type RelationRole,
  type SearchHit,
} from "@/lib/names";

type PersonRecord = Person & { aliases?: { name: string }[] };

function toDto(person: PersonRecord): PersonDTO {
  return {
    id: person.id,
    lastName: person.lastName,
    firstName: person.firstName,
    patronymic: person.patronymic,
    gender: person.gender as Gender,
    birthYear: person.birthYear,
    deathYear: person.deathYear,
    birthDateText: person.birthDateText,
    deathDateText: person.deathDateText,
    isLiving: person.isLiving,
    sourceNote: person.sourceNote,
    aliases: (person.aliases ?? []).map((alias) => alias.name),
    claimedClanId: person.claimedClanId,
  };
}

function norms(input: PersonInput) {
  return {
    lastNameNorm: normalizeName(input.lastName),
    firstNameNorm: normalizeName(input.firstName),
    patronymicNorm: normalizeName(input.patronymic),
  };
}

function personScalarData(input: PersonInput) {
  return {
    lastName: input.lastName,
    firstName: input.firstName,
    patronymic: input.patronymic,
    gender: input.gender,
    birthYear: input.birthYear,
    deathYear: input.deathYear,
    birthDateText: input.birthDateText,
    deathDateText: input.deathDateText,
    isLiving: input.isLiving,
    sourceNote: input.sourceNote,
    claimedClanId: input.claimedClanId,
    ...norms(input),
  };
}

function aliasCreates(input: PersonInput) {
  return input.aliases.map((name) => ({
    name,
    nameNorm: normalizeName(name),
  }));
}

async function assertClaimedClan(claimedClanId: string | null) {
  if (!claimedClanId) return;
  const clan = await prisma.clan.findUnique({ where: { id: claimedClanId } });
  if (!clan) throw new Error("Род не найден");
}

export async function createPerson(input: PersonInput): Promise<PersonDTO> {
  await assertClaimedClan(input.claimedClanId);
  const person = await prisma.$transaction(async (tx) => {
    const created = await tx.person.create({
      data: {
        ...personScalarData(input),
        aliases: { create: aliasCreates(input) },
      },
      include: { aliases: true },
    });
    await writeChangeLog(tx, {
      action: "person.create",
      personId: created.id,
      payload: { person: toDto(created) },
    });
    return created;
  });
  return toDto(person);
}

export async function updatePerson(
  id: string,
  input: PersonInput,
): Promise<FamilyDTO> {
  const existing = await prisma.person.findUnique({
    where: { id },
    include: { aliases: true },
  });
  if (!existing) throw new Error("Человек не найден");
  await assertClaimedClan(input.claimedClanId);

  await prisma.$transaction(async (tx) => {
    await tx.personAlias.deleteMany({ where: { personId: id } });
    await tx.person.update({
      where: { id },
      data: {
        ...personScalarData(input),
        aliases: { create: aliasCreates(input) },
      },
    });
    await writeChangeLog(tx, {
      action: "person.update",
      personId: id,
      payload: { before: toDto(existing), after: input },
    });
  });

  const family = await getFamily(id);
  if (!family) throw new Error("Не удалось загрузить семью");
  return family;
}

export async function deletePerson(id: string): Promise<void> {
  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      aliases: true,
      asChild: true,
      asParent: true,
      marriagesA: true,
      marriagesB: true,
    },
  });
  if (!person) throw new Error("Человек не найден");

  await prisma.$transaction(async (tx) => {
    await writeChangeLog(tx, {
      action: "person.delete",
      personId: id,
      payload: {
        person: toDto(person),
        parentIds: person.asChild.map((link) => link.parentId),
        childIds: person.asParent.map((link) => link.childId),
        spouseIds: [
          ...person.marriagesA.map((marriage) => marriage.personBId),
          ...person.marriagesB.map((marriage) => marriage.personAId),
        ],
      },
    });
    await tx.person.delete({ where: { id } });
  });
}

export async function searchPeople(options: {
  query?: string;
  lastName?: string;
  firstName?: string;
  patronymic?: string;
  gender?: Gender;
  excludeIds?: string[];
  limit?: number;
}): Promise<SearchHit[]> {
  const tokens = nameTokens(
    options.query,
    options.lastName,
    options.firstName,
    options.patronymic,
  );
  if (tokens.length === 0) return [];

  const people = await prisma.person.findMany({
    where: {
      AND: [
        ...tokens.map((token) => ({
          OR: [
            { lastNameNorm: { startsWith: token } },
            { firstNameNorm: { startsWith: token } },
            { patronymicNorm: { startsWith: token } },
            { aliases: { some: { nameNorm: { startsWith: token } } } },
          ],
        })),
        options.gender ? { gender: options.gender } : {},
        options.excludeIds?.length
          ? { id: { notIn: options.excludeIds } }
          : {},
      ],
    },
    include: {
      aliases: true,
      asChild: { include: { parent: true } },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    take: options.limit ?? 8,
  });

  return people.map((person) => {
    const father =
      person.asChild.map((link) => link.parent).find((parent) => parent.gender === "male") ??
      null;
    return {
      ...toDto(person),
      fatherLabel: fatherLabel(person.gender as Gender, father),
    };
  });
}

export async function listRecentPeople(limit = 20): Promise<PersonDTO[]> {
  const people = await prisma.person.findMany({
    include: { aliases: true },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
  return people.map(toDto);
}

export async function getFamily(id: string): Promise<FamilyDTO | null> {
  const person = await prisma.person.findUnique({
    where: { id },
    include: {
      aliases: true,
      asChild: { include: { parent: { include: { aliases: true } } } },
      asParent: { include: { child: { include: { aliases: true } } } },
      marriagesA: { include: { personB: { include: { aliases: true } } } },
      marriagesB: { include: { personA: { include: { aliases: true } } } },
    },
  });
  if (!person) return null;

  const parents = person.asChild.map((link) => link.parent);
  const father = parents.find((parent) => parent.gender === "male") ?? null;
  const mother = parents.find((parent) => parent.gender === "female") ?? null;
  const spouses = [
    ...person.marriagesA.map((marriage) => marriage.personB),
    ...person.marriagesB.map((marriage) => marriage.personA),
  ];
  const children = person.asParent.map((link) => link.child);

  const parentIds = parents.map((parent) => parent.id);
  const siblingLinks =
    parentIds.length === 0
      ? []
      : await prisma.parentChild.findMany({
          where: {
            parentId: { in: parentIds },
            childId: { not: person.id },
          },
          include: { child: { include: { aliases: true } } },
        });

  const siblings: PersonRecord[] = [];
  const seen = new Set<string>();
  for (const link of siblingLinks) {
    if (seen.has(link.child.id)) continue;
    seen.add(link.child.id);
    siblings.push(link.child);
  }

  return {
    person: toDto(person),
    father: father ? toDto(father) : null,
    mother: mother ? toDto(mother) : null,
    spouses: spouses.map(toDto),
    children: children.map(toDto),
    siblings: siblings.map(toDto),
    clan: await resolvePersonClan(person.id, person.claimedClanId),
  };
}

function orderedPair(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

export async function addRelation(options: {
  personId: string;
  role: RelationRole;
  existingPersonId?: string;
  newPerson?: PersonInput;
  sourceNote?: string;
}): Promise<FamilyDTO> {
  const person = await prisma.person.findUnique({
    where: { id: options.personId },
    include: {
      asChild: { include: { parent: true } },
    },
  });
  if (!person) throw new Error("Человек не найден");

  if (options.newPerson) {
    await assertClaimedClan(options.newPerson.claimedClanId);
  }

  const existingRelative = options.existingPersonId
    ? await prisma.person.findUnique({ where: { id: options.existingPersonId } })
    : null;
  if (options.existingPersonId && !existingRelative) {
    throw new Error("Человек не найден");
  }
  if (!existingRelative && !options.newPerson) {
    throw new Error("Укажите родственника");
  }

  const relativeGender = (existingRelative?.gender ?? options.newPerson?.gender) as
    | Gender
    | undefined;
  if (existingRelative?.id === person.id) {
    throw new Error("Нельзя связать человека с самим собой");
  }

  if (options.role === "father" || options.role === "mother") {
    const expected: Gender = options.role === "father" ? "male" : "female";
    if (relativeGender !== expected) {
      throw new Error(
        options.role === "father"
          ? "Отец должен быть мужчиной"
          : "Мать должна быть женщиной",
      );
    }
    const parents = person.asChild.map((link) => link.parent);
    if (parents.some((parent) => parent.gender === expected)) {
      throw new Error(
        options.role === "father" ? "Отец уже указан" : "Мать уже указана",
      );
    }
  } else if (options.role === "child" && existingRelative) {
    const childParents = await prisma.parentChild.findMany({
      where: { childId: existingRelative.id },
      include: { parent: true },
    });
    if (childParents.some((link) => link.parentId === person.id)) {
      throw new Error("Этот ребёнок уже указан");
    }
    if (childParents.some((link) => link.parent.gender === person.gender)) {
      throw new Error(
        person.gender === "male"
          ? `У ${formatFio(existingRelative)} уже указан отец`
          : `У ${formatFio(existingRelative)} уже указана мать`,
      );
    }
    if (childParents.length >= 2) {
      throw new Error("У человека уже указаны оба родителя");
    }
  } else if (options.role === "spouse" && existingRelative) {
    const [personAId, personBId] = orderedPair(person.id, existingRelative.id);
    const marriage = await prisma.marriage.findUnique({
      where: { personAId_personBId: { personAId, personBId } },
    });
    if (marriage) throw new Error("Супруги уже связаны");
  }

  const sourceNote = options.sourceNote ?? "";

  try {
    await prisma.$transaction(async (tx) => {
      const relative =
        existingRelative ??
        (await tx.person.create({
          data: {
            ...personScalarData(options.newPerson!),
            aliases: { create: aliasCreates(options.newPerson!) },
          },
        }));

      if (options.role === "father" || options.role === "mother") {
        await tx.parentChild.create({
          data: { parentId: relative.id, childId: person.id, sourceNote },
        });
      } else if (options.role === "child") {
        await tx.parentChild.create({
          data: { parentId: person.id, childId: relative.id, sourceNote },
        });
      } else {
        const [personAId, personBId] = orderedPair(person.id, relative.id);
        await tx.marriage.create({ data: { personAId, personBId, sourceNote } });
      }

      await writeChangeLog(tx, {
        action: "relation.add",
        personId: person.id,
        payload: {
          role: options.role,
          relativeId: relative.id,
          created: !existingRelative,
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("Такая родственная связь уже есть");
    }
    throw error;
  }

  const family = await getFamily(person.id);
  if (!family) throw new Error("Не удалось загрузить семью");
  return family;
}

export async function unlinkRelation(options: {
  personId: string;
  role: RelationRole;
  relativeId: string;
}): Promise<FamilyDTO> {
  const person = await prisma.person.findUnique({ where: { id: options.personId } });
  if (!person) throw new Error("Человек не найден");
  if (!options.relativeId) throw new Error("Не указан родственник");
  if (options.relativeId === options.personId) {
    throw new Error("Нельзя отвязать человека от самого себя");
  }

  await prisma.$transaction(async (tx) => {
    let removed = 0;
    if (options.role === "father" || options.role === "mother") {
      const result = await tx.parentChild.deleteMany({
        where: { parentId: options.relativeId, childId: options.personId },
      });
      removed = result.count;
    } else if (options.role === "child") {
      const result = await tx.parentChild.deleteMany({
        where: { parentId: options.personId, childId: options.relativeId },
      });
      removed = result.count;
    } else {
      const [personAId, personBId] = orderedPair(
        options.personId,
        options.relativeId,
      );
      const result = await tx.marriage.deleteMany({
        where: { personAId, personBId },
      });
      removed = result.count;
    }
    if (removed === 0) {
      throw new Error("Такой связи нет");
    }
    await writeChangeLog(tx, {
      action: "relation.unlink",
      personId: options.personId,
      payload: { role: options.role, relativeId: options.relativeId },
    });
  });

  const family = await getFamily(options.personId);
  if (!family) throw new Error("Не удалось загрузить семью");
  return family;
}

export async function loadKinGraph(): Promise<KinGraph> {
  const [people, parentLinks, marriages] = await Promise.all([
    prisma.person.findMany({ include: { aliases: true } }),
    prisma.parentChild.findMany({
      select: { parentId: true, childId: true },
    }),
    prisma.marriage.findMany({
      select: { personAId: true, personBId: true },
    }),
  ]);
  return {
    people: people.map(toDto),
    parentLinks,
    marriages,
  };
}

export async function getKinship(fromId: string, toId: string) {
  return findKinship(await loadKinGraph(), fromId, toId);
}

export async function getPersonTree(id: string) {
  return buildPersonTree(await loadKinGraph(), id);
}

export function parseRelationRole(value: unknown): RelationRole {
  if (
    value === "father" ||
    value === "mother" ||
    value === "spouse" ||
    value === "child"
  ) {
    return value;
  }
  throw new Error("Неизвестный тип родства");
}
