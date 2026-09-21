---
name: village-tree-domain
description: >-
  Domain rules for the shared Dagestani village genealogy graph: one person one
  node, tuhum/clan from paternal line, no duplicate people, kinship paths,
  aliases. Use when changing people, relations, clans, duplicates, search,
  kinship, Prisma schema, or when a UX change could split a person across clans.
---

# Домен «Древо села»

Источник правды: `docs/PLAN.md`. Не нарушай правила ради упрощения UI.

## Инварианты

1. Человек в базе один раз. Не копировать его «в другой род».
2. Тухум считается по отцам до родоначальника. `claimedClanId` — подсказка, не побеждает граф.
3. Обязательно только имя. Годы, даты текстом, источник, жив/нет — мягкие.
4. Родство — рёбра `ParentChild` и `Marriage`, не фамилия и не отчество.
5. Один отец и одна мать. Женщина после замужества — тот же узел.
6. Данные живых не светить публично, когда появится вход.

## Когда меняешь UX

- Поиск и «это он?» важнее красивой формы создания.
- Слияние и удаление — разрушающие; пока нет модерации, не прячь подтверждение.
- Новые поля не должны стать обязательными.

## Куда смотреть

- Граф: `lib/graph.ts`, `lib/tree.ts`, `lib/kinship.ts`, `lib/clan.ts`
- Запись: `lib/people.ts`, `lib/duplicates.ts`
- Схема: `prisma/schema.prisma`
