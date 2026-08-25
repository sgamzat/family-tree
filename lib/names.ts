export type Gender = "male" | "female";

export type PersonDTO = {
  id: string;
  lastName: string;
  firstName: string;
  patronymic: string;
  gender: Gender;
  birthYear: number | null;
  deathYear: number | null;
};

export type SearchHit = PersonDTO & {
  fatherLabel: string | null;
};

export type FamilyDTO = {
  person: PersonDTO;
  father: PersonDTO | null;
  mother: PersonDTO | null;
  spouses: PersonDTO[];
  children: PersonDTO[];
  siblings: PersonDTO[];
};

export type PersonInput = {
  lastName: string;
  firstName: string;
  patronymic: string;
  gender: Gender;
  birthYear: number | null;
  deathYear: number | null;
};

export type RelationRole = "father" | "mother" | "spouse" | "child";

export function normalizeName(value: string): string {
  return value.trim().toLowerCase().replaceAll("ё", "е").replace(/\s+/g, " ");
}

export function nameTokens(...parts: Array<string | undefined>): string[] {
  const tokens: string[] = [];
  for (const part of parts) {
    if (!part) continue;
    for (const token of normalizeName(part).split(" ")) {
      if (token.length >= 2) tokens.push(token);
    }
  }
  return tokens;
}

export function formatFio(person: {
  lastName: string;
  firstName: string;
  patronymic: string;
}): string {
  return [person.lastName, person.firstName, person.patronymic]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" ");
}

export function formatYears(
  birthYear: number | null,
  deathYear: number | null,
): string {
  if (birthYear && deathYear) return `${birthYear}–${deathYear}`;
  if (birthYear) return `род. ${birthYear}`;
  if (deathYear) return `ум. ${deathYear}`;
  return "";
}

export function fatherLabel(
  gender: Gender,
  father: { firstName: string } | null,
): string | null {
  if (!father?.firstName) return null;
  return `${gender === "male" ? "сын" : "дочь"} ${father.firstName}`;
}

export function genderLabel(gender: Gender): string {
  return gender === "male" ? "мужчина" : "женщина";
}

export function relationTitle(role: RelationRole): string {
  switch (role) {
    case "father":
      return "Добавить отца";
    case "mother":
      return "Добавить мать";
    case "spouse":
      return "Добавить супруга";
    case "child":
      return "Добавить ребёнка";
  }
}

export function parseYear(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n =
    typeof value === "number" ? value : Number.parseInt(String(value).trim(), 10);
  if (!Number.isInteger(n) || n < 1700 || n > 2100) {
    throw new Error("Год должен быть числом от 1700 до 2100");
  }
  return n;
}

export function parseGender(value: unknown): Gender {
  if (value === "male" || value === "female") return value;
  throw new Error("Укажите пол");
}

export function givenNameFromPatronymic(patronymic: string): string {
  const raw = patronymic.trim();
  if (!raw) return "";
  const lower = normalizeName(raw);
  const suffixes = [
    "оглы",
    "кызы",
    "улы",
    "ович",
    "евич",
    "ивич",
    "овна",
    "евна",
    "инична",
    "ична",
  ];
  let stem = raw;
  for (const suffix of suffixes) {
    if (lower.endsWith(suffix) && raw.length > suffix.length + 1) {
      stem = raw.slice(0, raw.length - suffix.length);
      if (
        (suffix === "евич" || suffix === "евна") &&
        /е$/i.test(stem)
      ) {
        stem += "й";
      }
      return stem;
    }
  }
  return raw;
}

export function maleLastName(lastName: string): string {
  const value = lastName.trim();
  if (/ская$/i.test(value) && value.length > 5) {
    return `${value.slice(0, -4)}ский`;
  }
  if (/[ое]ва$/i.test(value) && value.length > 4) {
    return value.slice(0, -1);
  }
  if (/ина$/i.test(value) && value.length > 4) {
    return value.slice(0, -1);
  }
  return value;
}

export function lastNameForGender(lastName: string, gender: Gender): string {
  const male = maleLastName(lastName);
  if (gender === "male") return male;
  if (/ский$/i.test(male)) return `${male.slice(0, -2)}ая`;
  if (/[ое]в$/i.test(male) || /ин$/i.test(male) || /ын$/i.test(male)) {
    return `${male}а`;
  }
  return lastName.trim();
}

export function patronymicFromName(firstName: string, gender: Gender): string {
  const name = firstName.trim();
  if (!name) return "";
  if (/ий$/i.test(name)) {
    const stem = name.slice(0, -2);
    return gender === "male" ? `${stem}ьевич` : `${stem}ьевна`;
  }
  if (/й$/i.test(name)) {
    const stem = name.slice(0, -1);
    return gender === "male" ? `${stem}евич` : `${stem}евна`;
  }
  if (/[ья]$/i.test(name) && !/лла$/i.test(name)) {
    const stem = name.slice(0, -1);
    return gender === "male" ? `${stem}ич` : `${stem}инична`;
  }
  if (/а$/i.test(name)) {
    return gender === "male" ? `${name}евич` : `${name}евна`;
  }
  return gender === "male" ? `${name}ович` : `${name}овна`;
}

export function suggestRelativeNames(
  role: RelationRole,
  person: PersonDTO,
  options?: { childGender?: Gender; spouse?: PersonDTO | null },
): { lastName: string; firstName: string; patronymic: string; hint: string } {
  const empty = { lastName: "", firstName: "", patronymic: "", hint: "" };

  if (role === "father") {
    const lastName = maleLastName(person.lastName);
    const firstName = givenNameFromPatronymic(person.patronymic);
    if (!lastName && !firstName) return empty;
    return {
      lastName,
      firstName,
      patronymic: "",
      hint: firstName
        ? `Имя отца взяли из отчества «${person.patronymic}», фамилию — вашу. Можно поправить.`
        : "Фамилию отца подставили по вашей. Имя можно вписать сами.",
    };
  }

  if (role === "child") {
    const childGender = options?.childGender ?? "male";
    const father =
      person.gender === "male"
        ? person
        : options?.spouse?.gender === "male"
          ? options.spouse
          : null;
    const lastName = lastNameForGender(
      (father ?? person).lastName,
      childGender,
    );
    const patronymic = father
      ? patronymicFromName(father.firstName, childGender)
      : "";
    return {
      lastName,
      firstName: "",
      patronymic,
      hint: patronymic
        ? `Фамилию и отчество подставили по отцу ${father!.firstName}. Имя ребёнка впишите сами.`
        : "Фамилию подставили. Отчество появится, если известен отец.",
    };
  }

  if (role === "mother") {
    return {
      lastName: lastNameForGender(person.lastName, "female"),
      firstName: "",
      patronymic: "",
      hint: "Фамилию матери подставили по вашей — часто это фамилия мужа, можно поправить.",
    };
  }

  return empty;
}

export function parsePersonInput(body: Record<string, unknown>): PersonInput {
  const lastName = String(body.lastName ?? "").trim();
  const firstName = String(body.firstName ?? "").trim();
  const patronymic = String(body.patronymic ?? "").trim();
  if (!lastName) throw new Error("Укажите фамилию");
  if (!firstName) throw new Error("Укажите имя");

  const gender = parseGender(body.gender);
  const birthYear = parseYear(body.birthYear);
  const deathYear = parseYear(body.deathYear);
  if (birthYear && deathYear && deathYear < birthYear) {
    throw new Error("Год смерти не может быть раньше года рождения");
  }

  return { lastName, firstName, patronymic, gender, birthYear, deathYear };
}
