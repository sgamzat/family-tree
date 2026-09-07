# Аддендум #2 для Cursor: тёплая линия-супруг с обходом карточек

Финальный патч поверх `tree-render-brief.md` и `tree-render-spouses-addendum.md`.
Фиксируем принятые решения:

- **Вариант А остаётся:** у ребёнка обе линии происхождения — к отцу и к матери.
  Ничего из второго родителя НЕ убираем (опциональный «Вариант Б» из прошлого аддендума
  НЕ применяем).
- **Линия-супруг:** одна сплошная тёплая линия (не пунктир, не светлая). Когда между
  супругами есть чьи-то карточки, линия уходит в промежуток под рядом и **огибает** их
  снизу, а не пересекает. Обход считается по реально замеренным габаритам карточек.
- Небольшой нейтральный кружок в точке, где к ребёнку сходятся обе родительские линии
  (по желанию — легко убрать).

Файлы: `components/family-tree.tsx` и `app/globals.css`. `lib/tree.ts` уже готов
(`parentIds` есть).

---

## 1. Виды рёбер: добавь `parent2`

В `collectEdges` (введён в аддендуме #1) сделай три вида связи и **сохрани второго родителя**
(Вариант А):

```tsx
type Edge = { a: string; b: string; kind: "parent" | "parent2" | "spouse" };
//  parent  — структурный родитель → ребёнок
//  parent2 — второй родитель → тот же ребёнок (a = родитель, b = ребёнок)
//  spouse  — супруги (a, b)

function collectEdges(opts: {
  ancestors?: AncestorNode | null;
  descentRoot?: DescentNode | null;
  structuralIds: Set<string>;
}): Edge[] {
  const edges: Edge[] = [];
  const seen = new Set<string>();
  const add = (a: string, b: string, kind: Edge["kind"]) => {
    const k = a < b ? `${a}|${b}` : `${b}|${a}`;
    if (seen.has(k)) return;
    seen.add(k);
    edges.push({ a, b, kind });
  };

  const up = (n: AncestorNode | null) => {
    if (!n) return;
    if (n.father) { add(n.person.id, n.father.person.id, "parent"); up(n.father); }
    if (n.mother) { add(n.person.id, n.mother.person.id, "parent"); up(n.mother); }
    if (n.father && n.mother) add(n.father.person.id, n.mother.person.id, "spouse");
  };

  const down = (n: DescentNode) => {
    for (const spouse of n.spouses) {
      if (spouse.id !== n.person.id && opts.structuralIds.has(spouse.id)) {
        add(n.person.id, spouse.id, "spouse");
      }
    }
    for (const c of n.children) {
      add(n.person.id, c.person.id, "parent");           // отец → ребёнок
      for (const pid of c.parentIds) {                    // второй родитель → ребёнок (ВАРИАНТ А)
        if (pid !== n.person.id) add(pid, c.person.id, "parent2");
      }
      down(c);
    }
  };

  if (opts.ancestors) up(opts.ancestors);
  if (opts.descentRoot) down(opts.descentRoot);
  return edges;
}
```

---

## 2. `TreeCanvas`: единый замер + обход для линии-супруга

Замеряем все карточки один раз за проход, из этих же прямоугольников считаем и линии,
и препятствия для обхода. Замени помощники и `compute` на это.

### 2.1 Помощники
```tsx
type Rel = { left: number; right: number; top: number; bottom: number; cx: number; cy: number; h: number };

function rectRel(el: HTMLElement, o: DOMRect): Rel {
  const r = el.getBoundingClientRect();
  return {
    left: r.left - o.left, right: r.right - o.left,
    top: r.top - o.top, bottom: r.bottom - o.top,
    cx: r.left + r.width / 2 - o.left,
    cy: r.top + r.height / 2 - o.top,
    h: r.height,
  };
}

// вертикальная связь родитель↔ребёнок (порядок не важен — сам определяет, кто выше)
function verticalLink(a: Rel, b: Rel): string {
  const aAbove = a.bottom <= b.top;
  const ay = aAbove ? a.bottom : a.top;
  const by = aAbove ? b.top : b.bottom;
  const m = (ay + by) / 2;
  return `M ${a.cx} ${ay} C ${a.cx} ${m}, ${b.cx} ${m}, ${b.cx} ${by}`;
}

// линия-супруг: сплошная, уходит под ряд и огибает карточки между супругами
function spouseRoute(A: Rel, B: Rel, obstacles: { el: HTMLElement; r: Rel }[], skip: HTMLElement[]): string {
  const L = A.cx <= B.cx ? A : B;
  const R = A.cx <= B.cx ? B : A;
  const x1 = L.right, y1 = L.cy;
  const x2 = R.left,  y2 = R.cy;

  // самая нижняя карточка строго между супругами и примерно в том же ряду
  let maxBottom = Math.max(L.bottom, R.bottom);
  for (const { el, r } of obstacles) {
    if (skip.includes(el)) continue;
    const between = r.cx > Math.min(L.cx, R.cx) + 1 && r.cx < Math.max(L.cx, R.cx) - 1;
    const sameRow = Math.abs(r.top - L.top) < L.h + 40; // рядом по вертикали
    if (between && sameRow) maxBottom = Math.max(maxBottom, r.bottom);
  }

  const routeY = maxBottom + 14; // промежуток под рядом
  const r = Math.min(12, Math.max(4, (x2 - x1) / 2), (routeY - Math.min(y1, y2)) / 2);
  return `M ${x1} ${y1}`
    + ` V ${routeY - r}`
    + ` Q ${x1} ${routeY} ${x1 + r} ${routeY}`
    + ` H ${x2 - r}`
    + ` Q ${x2} ${routeY} ${x2} ${routeY - r}`
    + ` V ${y2}`;
}
```

### 2.2 Сам компонент (изменены `compute` и рендер svg)
```tsx
function TreeCanvas({ edges, structuralIds, children }: {
  edges: Edge[]; structuralIds: Set<string>; children: React.ReactNode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const registry = useRef<Map<string, HTMLElement>>(new Map());
  const [paths, setPaths] = useState<{ d: string; kind: Edge["kind"] }[]>([]);
  const [dots, setDots] = useState<{ x: number; y: number }[]>([]);

  const register = useCallback((id: string, el: HTMLElement | null) => {
    if (el) registry.current.set(id, el);
    else registry.current.delete(id);
  }, []);

  const compute = useCallback(() => {
    const box = containerRef.current;
    if (!box) return;
    const o = box.getBoundingClientRect();

    // один проход замера: id -> {el, r}
    const relById = new Map<string, { el: HTMLElement; r: Rel }>();
    registry.current.forEach((el, id) => relById.set(id, { el, r: rectRel(el, o) }));
    const obstacles = Array.from(relById.values());

    const lines: { d: string; kind: Edge["kind"] }[] = [];
    const junctions: { x: number; y: number }[] = [];

    for (const e of edges) {
      const A = relById.get(e.a);
      const B = relById.get(e.b);
      if (!A || !B) continue;

      if (e.kind === "spouse") {
        lines.push({ d: spouseRoute(A.r, B.r, obstacles, [A.el, B.el]), kind: "spouse" });
      } else {
        lines.push({ d: verticalLink(A.r, B.r), kind: e.kind });
        if (e.kind === "parent2") junctions.push({ x: B.r.cx, y: B.r.top }); // b = ребёнок
      }
    }
    // супругов рисуем первыми (позади линий родства)
    lines.sort((p, q) => (p.kind === "spouse" ? 0 : 1) - (q.kind === "spouse" ? 0 : 1));

    setPaths(lines);
    setDots(junctions);
  }, [edges]);

  useLayoutEffect(() => { compute(); }, [compute]);
  useEffect(() => {
    const box = containerRef.current;
    if (!box) return;
    const ro = new ResizeObserver(() => compute());
    ro.observe(box);
    window.addEventListener("resize", compute);
    document.fonts?.ready.then(() => compute());
    return () => { ro.disconnect(); window.removeEventListener("resize", compute); };
  }, [compute]);

  return (
    <RegisterCtx.Provider value={register}>
      <StructuralCtx.Provider value={structuralIds}>
        <div ref={containerRef} className="tree-canvas">
          <svg className="tree-lines" aria-hidden="true">
            {paths.map((p, i) => (
              <path key={`p${i}`} d={p.d}
                    className={p.kind === "spouse" ? "tree-line tree-line--spouse" : "tree-line"} />
            ))}
            {dots.map((d, i) => (
              <circle key={`d${i}`} cx={d.x} cy={d.y} r={3.5} className="tree-junction" />
            ))}
          </svg>
          <div className="tree-flow">{children}</div>
        </div>
      </StructuralCtx.Provider>
    </RegisterCtx.Provider>
  );
}
```

> Если раньше `verticalLink` имел сигнатуру с `DOMRect`+`origin` (из первого брифа) — замени
> все его вызовы на новую версию, работающую с `Rel` (уже относительные координаты).

---

## 3. CSS

В `:root` добавь тёплый цвет, если его ещё нет:
```css
:root { --union: #b07d2b; } /* тёплый; оттенок под вкус */
```

Стили линий:
```css
.tree-line { fill: none; stroke: var(--line-strong); stroke-width: 2;
             stroke-linecap: round; stroke-linejoin: round; }

/* линия-супруг: сплошная тёплая, чуть заметнее */
.tree-line--spouse { stroke: var(--union); stroke-width: 2.4; }

/* точка, где к ребёнку сходятся оба родителя (по желанию — можно удалить) */
.tree-junction { fill: var(--line-strong); }
```
Удали прежний стиль пунктирной светлой линии-супруга из аддендума #1
(`stroke-dasharray`, `stroke: var(--line)`), он больше не нужен.

---

## Проверка
1. Компилируется, страница человека открывается.
2. У ребёнка близкородственной пары — **две** серые линии (к отцу и к матери) и кружок
   в точке схода.
3. Между супругами Али и Патимат стоит Хадижат — тёплая линия-супруг проходит **под**
   её карточкой, не пересекая её. У Рустама и Аиши (между ними никого) — короткая дуга.
4. Внешние супруги — по-прежнему рядом через тире; линию-супруг получают только пары,
   где оба — свои узлы.
5. Клики по карточкам работают; `×N` и выделение текущего на месте.
6. При ресайзе и после загрузки шрифтов линии и обход пересчитываются корректно.

## Заметки / возможные доработки
- **Препятствия для обхода** — сейчас это зарегистрированные карточки (структурные люди).
  Inline-карточки внешних супругов не регистрируются, поэтому в обход не попадают; они
  всегда рядом со своим партнёром, так что между далёкой парой почти не встречаются. Если
  понадобится — можно регистрировать все карточки в отдельный «obstacle»-реестр.
- **Разные поколения у супругов** — `spouseRoute` уводит линию ниже обоих и корректно
  поднимается к каждому; отдельного кода не требуется.
- **Линию второго родителя (серую диагональ) пока не огибаем** — ты просил обход только для
  линии-супруга. Если позже захочешь пускать в обход и её, вызови для `parent2` тот же
  `spouseRoute` (стиль оставь серый `tree-line`) вместо `verticalLink`.
- **Цвет/толщина** линии-супруга — значения в CSS, меняются в одну строку.