# Задача: переделать отрисовку древа на единый SVG-слой + линии ко второму родителю

Действуй по этому брифу. Меняем **обрисовку** генеалогического древа: вместо нынешних
CSS-псевдоэлементов у потомков и стрелок-треугольников у предков — один общий SVG-слой
с плавными кривыми (одинаковыми для предков и потомков). Плюс: когда у ребёнка оба родителя
присутствуют в видимом дереве (близкородственный брак), к ребёнку ведут **две линии
происхождения** — к отцу и к матери. Никаких подписей и никакого спец-выделения брака.

Работай маленькими шагами, после каждого проверяй `npm run dev` и что страница человека
открывается. Ничего не удаляй из данных.

## Файлы, которые трогаем
- `lib/tree.ts` — тип `DescentNode` и функция `buildDescent` (данные).
- `components/family-tree.tsx` — вся отрисовка (`LineageTree`, `ClanTreeView` и вспомогательные).
- `app/globals.css` — убрать старые соединители, добавить стили SVG-слоя.

## Что НЕЛЬЗЯ ломать
- Публичные сигнатуры `LineageTree({ tree, doubledById })` и `ClanTreeView({ tree, doubledById })`
  — их вызывает `components/tree-explorer.tsx`, не меняй его.
- Экспорты и поведение `buildPersonTree`, `buildClanTree`, `maxUp`, `maxDown`,
  `paternalRootId`, `treeHasRelatives`, `clanHasRelatives`, `clanCaption`.
- Не трогай `lib/kinship.ts`. Вторые линии считаются из `parentsOf`, а не из родства.
- Сохрани: выделение текущего человека (`tree-card-current`), значок `×N`
  (`doubledById`), карточки-супруги через тире, горизонтальный скролл на широком дереве,
  ссылки-карточки (`<Link>` должны оставаться кликабельными).

---

## Шаг 1. Данные: каждый человек — один раз + список родителей у узла

В `lib/tree.ts`.

### 1.1 Добавь поле `parentIds` в тип `DescentNode`
```ts
export type DescentNode = {
  person: PersonDTO;
  spouses: PersonDTO[];
  children: DescentNode[];
  parentIds: string[]; // id всех родителей этого человека (из графа)
};
```

### 1.2 В `buildDescent` разворачивай каждого потомка только один раз и заполняй `parentIds`
Сейчас `buildDescent` при близкородственных браках может показать ребёнка дважды (под отцом
и под матерью). Нам нужно строго один раз — второе появление заменит линия ко второму родителю.
Добавь общий на весь обход набор `seen`:

```ts
function buildDescent(
  graph: IndexedGraph,
  id: string,
  depth: number,
  visiting: Set<string>,
  seen: Set<string>,
): DescentNode | null {
  const person = graph.byId.get(id);
  if (!person || visiting.has(id) || depth < 0) return null;
  visiting.add(id);
  seen.add(id);

  const spouses = (graph.spousesOf.get(id) ?? [])
    .map((spouseId) => graph.byId.get(spouseId))
    .filter((spouse): spouse is PersonDTO => Boolean(spouse));

  const children = (graph.childrenOf.get(id) ?? [])
    .filter((childId) => !seen.has(childId)) // каждый ребёнок разворачивается один раз
    .map((childId) => buildDescent(graph, childId, depth - 1, visiting, seen))
    .filter((child): child is DescentNode => Boolean(child));

  visiting.delete(id);
  return {
    person,
    spouses,
    children,
    parentIds: [...(graph.parentsOf.get(id) ?? [])],
  };
}
```

Обнови оба вызова `buildDescent` — передавай свежий `seen`:
- в `buildPersonTree`: `buildDescent(indexed, personId, down, new Set(), new Set())`
- в `buildClanTree`: `buildDescent(indexed, rootId, down, new Set(), new Set())`

`buildAncestors` **не трогай** — предки строятся как раньше.

---

## Шаг 2. Отрисовка: один SVG-слой на всё дерево

В `components/family-tree.tsx`. Файл теперь использует хуки — добавь **первой строкой**:
```tsx
"use client";
```

Идея: обернуть содержимое `LineageTree`/`ClanTreeView` в контейнер `position: relative`
с абсолютным `<svg>` под карточками. Каждая карточка-человек регистрирует свой DOM-узел
по `person.id`. После раскладки замеряем позиции карточек и рисуем кривые между парами
«родитель — ребёнок» (и предок — потомок). Линия ко второму родителю — та же самая кривая,
просто к другому родителю.

### 2.1 Контекст регистрации карточек
```tsx
import {
  createContext, useCallback, useContext, useEffect,
  useLayoutEffect, useMemo, useRef, useState,
} from "react";

const RegisterCtx = createContext<
  ((id: string, el: HTMLElement | null) => void) | null
>(null);
```

### 2.2 Регистрируем только карточку основного человека
В `TreeCard` добавь необязательный проп `registerId`. Регистрируй узел только когда он передан
(супругов-карточки не регистрируем — они не бывают концами линий):
```tsx
function TreeCard({ person, current, doubledById, registerId }: {
  person: PersonDTO; current?: boolean;
  doubledById?: Record<string, number>; registerId?: string;
}) {
  const register = useContext(RegisterCtx);
  const years = personYears(person);
  const pathCount = doubledById?.[person.id];
  return (
    <Link
      ref={(node) => { if (registerId) register?.(registerId, node); }}
      href={`/people/${person.id}`}
      className={`tree-card ${current ? "tree-card-current" : ""} ${
        person.gender === "male" ? "tree-card-male" : "tree-card-female"
      }`}
    >
      {/* содержимое карточки без изменений */}
    </Link>
  );
}
```
В `Couple` передай `registerId={person.id}` только основному человеку (у супругов — нет).
В `AncestorBranch` и в списке потомков основной человек каждого узла тоже рендерится через
`Couple`/`TreeCard` — там регистрация появится автоматически.

### 2.3 Список рёбер строим из данных (чистая функция, без DOM)
Ребро — пара id. Дедуплицируем. Ancestor-рёбра идут вверх, descent-рёбра — вниз,
рисуются одинаково.
```tsx
type Edge = [string, string];

function collectEdges(opts: {
  ancestors?: AncestorNode | null;
  descentRoot?: DescentNode | null;
}): Edge[] {
  const edges: Edge[] = [];
  const seen = new Set<string>();
  const add = (a: string, b: string) => {
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (!seen.has(k)) { seen.add(k); edges.push([a, b]); }
  };
  const up = (n: AncestorNode | null) => {
    if (!n) return;
    if (n.father) { add(n.person.id, n.father.person.id); up(n.father); }
    if (n.mother) { add(n.person.id, n.mother.person.id); up(n.mother); }
  };
  const down = (n: DescentNode) => {
    for (const c of n.children) {
      add(n.person.id, c.person.id);                 // структурный родитель → ребёнок
      for (const pid of c.parentIds) {                // второй родитель, если он в кадре
        if (pid !== n.person.id) add(pid, c.person.id);
      }
      down(c);
    }
  };
  if (opts.ancestors) up(opts.ancestors);
  if (opts.descentRoot) down(opts.descentRoot);
  return edges;
}
```

### 2.4 Компонент-обёртка с SVG и замером
```tsx
function verticalLink(a: DOMRect, b: DOMRect, o: DOMRect): string {
  const ax = a.left + a.width / 2 - o.left;
  const bx = b.left + b.width / 2 - o.left;
  const aAbove = a.bottom <= b.top; // кто выше — от того тянем снизу к верху нижнего
  const ay = (aAbove ? a.bottom : a.top) - o.top;
  const by = (aAbove ? b.top : b.bottom) - o.top;
  const m = (ay + by) / 2;
  return `M ${ax} ${ay} C ${ax} ${m}, ${bx} ${m}, ${bx} ${by}`;
}

function TreeCanvas({ edges, children }: { edges: Edge[]; children: React.ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const registry = useRef<Map<string, HTMLElement>>(new Map());
  const [paths, setPaths] = useState<string[]>([]);

  const register = useCallback((id: string, el: HTMLElement | null) => {
    if (el) registry.current.set(id, el);
    else registry.current.delete(id);
  }, []);

  const compute = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const o = el.getBoundingClientRect();
    const out: string[] = [];
    for (const [a, b] of edges) {
      const ea = registry.current.get(a);
      const eb = registry.current.get(b);
      if (ea && eb) out.push(verticalLink(ea.getBoundingClientRect(), eb.getBoundingClientRect(), o));
    }
    setPaths(out);
  }, [edges]);

  useLayoutEffect(() => { compute(); }, [compute]);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => compute());
    ro.observe(el);
    window.addEventListener("resize", compute);
    // шрифты сдвигают метрики — пересчёт после их загрузки
    document.fonts?.ready.then(() => compute());
    return () => { ro.disconnect(); window.removeEventListener("resize", compute); };
  }, [compute]);

  return (
    <RegisterCtx.Provider value={register}>
      <div ref={containerRef} className="tree-canvas">
        <svg className="tree-lines" aria-hidden="true">
          {paths.map((d, i) => <path key={i} d={d} className="tree-line" />)}
        </svg>
        <div className="tree-flow">{children}</div>
      </div>
    </RegisterCtx.Provider>
  );
}
```

### 2.5 Перепиши разметку потомков без CSS-соединителей
`DescentList` оставь по структуре (`<ul>/<li>`), но соединители теперь рисует SVG —
класс-обёртку `.ftree` замени на `.tree-flow` (см. CSS ниже). `TreeArrow` в потомках
больше не нужен — его роль выполняет линия. `AncestorBranch` тоже больше не рисует
`TreeArrow` между уровнями (линии рисует SVG); оставь только карточки и вложенность.

### 2.6 Собери всё в `LineageTree`
Оберни ВЕСЬ внутренний блок (предки + строка фокуса/сиблингов + потомки) в один `TreeCanvas`,
чтобы линии были едиными сверху донизу:
```tsx
export function LineageTree({ tree, doubledById }: {
  tree: PersonTree; doubledById?: Record<string, number>;
}) {
  const edges = useMemo(
    () => collectEdges({ ancestors: tree.ancestors, descentRoot: tree.descendants }),
    [tree],
  );
  const hasAncestors = Boolean(tree.ancestors.father || tree.ancestors.mother);
  const hasDescendants = tree.descendants.children.length > 0;

  return (
    <div className="-mx-4 overflow-x-auto px-4 pb-2">
      <TreeCanvas edges={edges}>
        <div className="inline-flex min-w-full flex-col items-center py-2">
          {hasAncestors ? (
            <div className="flex items-end justify-center gap-6">
              <AncestorBranch node={tree.ancestors.father} doubledById={doubledById} />
              <AncestorBranch node={tree.ancestors.mother} doubledById={doubledById} />
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-center gap-2">
            {tree.siblings.map((s) => (
              <TreeCard key={s.id} person={s} doubledById={doubledById} registerId={s.id} />
            ))}
            <Couple person={tree.person} spouses={tree.descendants.spouses}
                    current doubledById={doubledById} />
          </div>

          {hasDescendants ? (
            <div className="tree-flow-descent">
              <DescentList nodes={tree.descendants.children}
                           currentId={tree.person.id} doubledById={doubledById} />
            </div>
          ) : null}
        </div>
      </TreeCanvas>
    </div>
  );
}
```
Аналогично перепиши `ClanTreeView`: `edges = collectEdges({ descentRoot: tree.root })`,
корневая пара + `DescentList` его детей внутри одного `TreeCanvas`, без `TreeArrow`.

> Замечание про сиблингов: они регистрируются, но рёбер к ним нет — линий не будет, и это
> нормально (сейчас тоже так). Если захочешь соединять их с общими родителями — добавь
> в `collectEdges` рёбра `(sibling.id, father.id)`/`(sibling.id, mother.id)`, но это опционально.

---

## Шаг 3. CSS: убрать старые соединители, добавить SVG-слой

В `app/globals.css`.

### 3.1 Удали блок `.ftree` целиком
Удали все правила `.ftree ...`, включая `.ftree li::before`, `.ftree li::after`,
`.ftree li:only-child*`, `.ftree ul ul::before`, `.ftree ul ul::after`. Правила `.tree-arrow*`
можно оставить (если предки/потомки больше их не используют — просто станут неиспользуемыми;
удали, если хочешь чистоты).

### 3.2 Добавь стили слоя
```css
.tree-canvas { position: relative; }

.tree-lines {
  position: absolute; inset: 0;
  width: 100%; height: 100%;
  overflow: visible; pointer-events: none; /* важно: карточки-ссылки остаются кликабельными */
  z-index: 0;
}
.tree-line {
  fill: none;
  stroke: var(--line-strong);
  stroke-width: 2;
  stroke-linecap: round;
}

.tree-flow { position: relative; z-index: 1; }

/* раскладка потомков: центрируем поддеревья флексом, зазоры дают место линиям */
.tree-flow-descent ul,
.tree-flow-descent { display: flex; justify-content: center; }
.tree-flow-descent ul { list-style: none; margin: 0; padding: 0; }
.tree-flow-descent li {
  display: flex; flex-direction: column; align-items: center;
  list-style: none; position: relative;
  padding: 2.4rem 0.5rem 0;   /* вертикальный зазор между поколениями + горизонтальный между сиблингами */
}
```
Карточки уже `position: static`; SVG под ними (`z-index:0`), поток над (`z-index:1`) —
клики по `<Link>` работают, линии видны позади.

---

## Шаг 4 (рекомендуется). Предки в том же стиле — уже сделано
Так как рёбра предков попадают в общий `collectEdges` и рисуются тем же `TreeCanvas`,
отдельной работы не нужно — просто убедись, что в `AncestorBranch` убран `TreeArrow`
и что карточки предков регистрируются (они идут через `TreeCard`). Тогда и предки, и потомки,
и вторые родители — одной и той же кривой. Это и есть исходная цель: единый вид.

---

## Критерии приёмки
1. `npm run dev` компилируется, страница человека открывается, дерево рисуется.
2. У предков и потомков — одинаковые плавные кривые (нет старых уголков и стрелок-треугольников).
3. Текущий человек выделен, значок `×N` на месте, супруги через тире, широкий род скроллится вбок.
4. Карточки кликабельны (ведут на `/people/[id]`).
5. Для человека с близкородственным браком в предках у ребёнка видно **две** линии —
   к обоим родителям; при этом ни один человек не показан дважды.
6. При ресайзе окна и после загрузки шрифтов линии остаются на местах (пересчитываются).

## Как проверить пункт 5 (тестовые данные)
Возьми/заведи в БД цепочку: два брата (напр. Магомед и Гасан) — общие родители; у Магомеда сын
Али, у Гасана дочь Патимат; Али и Патимат женаты (двоюродные) и имеют ребёнка Ахмеда. Открой
страницу Ахмеда с включёнными предками на 2 уровня вверх — к Ахмеду должны идти две линии:
к Али и к Патимат, а сами Али и Патимат стоят каждый в своей ветке по одному разу.

## Возможная доработка (не сейчас)
Если при дальнем родстве (напр. двоюродные из разных краёв дерева) длинная дуга ко второму
родителю мешает — можно для таких случаев вместо линии показывать дубликат-карточку со значком
`×2` (механизм `doubledById` уже есть). Порог — по горизонтальному расстоянию между родителями.
По умолчанию оставляем линию.