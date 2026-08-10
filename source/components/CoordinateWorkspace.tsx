"use client";

import {
  Fragment,
  ReactNode,
  createElement,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  AngleObject,
  CircleObject,
  COLORS,
  FunctionObject,
  MathObject,
  Point,
  PointObject,
  PolygonObject,
  SegmentObject,
  SliderObject,
  StrokeStyle,
  Tool,
  Viewport,
  angleDegrees,
  distance,
  midpoint,
  nextPointName,
  polygonArea,
  polygonPerimeter,
  round,
  slope,
  uid,
} from "../lib/geometry";

type MathKeyboardElement = HTMLElement & {
  value: string;
  getValue: (format: string) => string;
  focus: () => void;
};
type Mode =
  | "coordinates"
  | "shapes"
  | "measurement"
  | "linear"
  | "graphs"
  | "advanced";
type FunctionKind = "linear" | "quadratic" | "general";
type ConstructionPoint = Point & {
  pointId?: string;
  name?: string;
  functionId?: string;
};

const MODES: Record<
  Mode,
  { label: string; description: string; grade: string }
> = {
  coordinates: {
    label: "נקודות ומערכת צירים",
    description: "יצירת נקודות, הזנת שיעורים, הזזה וקווי עזר לצירים",
    grade: "מתאים בעיקר לחטיבת הביניים",
  },
  shapes: {
    label: "קטעים וצורות",
    description: "נקודות, קטעים, ישרים ומצולעים",
    grade: "מתאים בעיקר לחטיבת הביניים",
  },
  measurement: {
    label: "מדידה וגאומטריה",
    description: "אורכים, זוויות, היקף, שטח ובניות גאומטריות",
    grade: "מתאים בעיקר לכיתות ח׳–י׳",
  },
  linear: {
    label: "ישרים ופונקציה קווית",
    description: "שיפוע, ישרים, חיתוכים ופונקציות מהצורה y=mx+b",
    grade: "מתאים בעיקר לכיתות ח׳–י׳",
  },
  graphs: {
    label: "פונקציות וגרפים",
    description: "פונקציות, פרבולות, תחומים, חיתוכים ומחוונים דינמיים",
    grade: "מתאים בעיקר לכיתות ט׳–י״א",
  },
  advanced: {
    label: "גיאומטריה אנליטית מתקדמת",
    description: "כלי גאומטריה, מעגלים, חיתוכים וחקירה אנליטית משולבת",
    grade: "מתאים בעיקר לכיתות י׳–י״ב",
  },
};

const MODE_SHAPE_TOOLS: Record<Mode, Tool[]> = {
  coordinates: ["point"],
  shapes: ["point", "segment", "line", "polygon"],
  measurement: [
    "point",
    "segment",
    "line",
    "polygon",
    "angle",
    "circle",
    "circleRadius",
    "circleThree",
  ],
  linear: [
    "point",
    "segment",
    "line",
    "polygon",
    "angle",
    "circle",
    "circleRadius",
    "circleThree",
  ],
  graphs: [
    "point",
    "segment",
    "line",
    "polygon",
    "angle",
    "circle",
    "circleRadius",
    "circleThree",
  ],
  advanced: [
    "point",
    "segment",
    "line",
    "angle",
    "polygon",
    "circle",
    "circleRadius",
    "circleThree",
  ],
};

const MODE_CONSTRUCTION_TOOLS: Record<Mode, Tool[]> = {
  coordinates: [],
  shapes: [],
  measurement: [
    "midpoint",
    "parallel",
    "perpendicular",
    "perpendicularBisector",
    "median",
    "angleBisector",
    "intersection",
  ],
  linear: [
    "midpoint",
    "parallel",
    "perpendicular",
    "perpendicularBisector",
    "median",
    "angleBisector",
    "intersection",
  ],
  graphs: [
    "midpoint",
    "parallel",
    "perpendicular",
    "perpendicularBisector",
    "median",
    "angleBisector",
    "intersection",
  ],
  advanced: [
    "midpoint",
    "parallel",
    "perpendicular",
    "perpendicularBisector",
    "median",
    "angleBisector",
    "intersection",
  ],
};

const MODE_DEFAULT_SECTIONS: Record<Mode, Record<string, boolean>> = {
  coordinates: { general: true, view: false, shapes: true, constructions: false, functions: false, sliders: false, transform: false },
  shapes: { general: true, view: false, shapes: true, constructions: false, functions: false, sliders: false, transform: false },
  measurement: { general: true, view: false, shapes: false, constructions: true, functions: false, sliders: false, transform: false },
  linear: { general: true, view: false, shapes: false, constructions: false, functions: true, sliders: false, transform: false },
  graphs: { general: true, view: false, shapes: false, constructions: false, functions: true, sliders: false, transform: false },
  advanced: { general: true, view: false, shapes: false, constructions: false, functions: false, sliders: false, transform: true },
};
const FUNCTION_COPY: Record<
  FunctionKind,
  { title: string; hint: string; example: string }
> = {
  linear: {
    title: "פונקציה קווית",
    hint: "למשל y=mx+b או y=2x+1",
    example: "y=2x+1",
  },
  quadratic: {
    title: "פונקציה ריבועית",
    hint: "למשל y=a*x^2+b",
    example: "y=x^2",
  },
  general: {
    title: "פונקציה כללית",
    hint: "אפשר להשתמש בשורש, מנה, ערך מוחלט וחזקות",
    example: "y=sqrt(x+2)",
  },
};
const TOOL_META: Record<Tool, { icon: string; label: string }> = {
  select: { icon: "↖", label: "בחירה" },
  pan: { icon: "✥", label: "הזזת מישור" },
  point: { icon: "●", label: "נקודה" },
  segment: { icon: "╱", label: "קטע" },
  line: { icon: "⟋", label: "ישר" },
  angle: { icon: "∠", label: "זווית" },
  polygon: { icon: "△", label: "מצולע" },
  circle: { icon: "○", label: "מעגל: מרכז ונקודה" },
  circleRadius: { icon: "⊙", label: "מעגל: מרכז ורדיוס" },
  circleThree: { icon: "◌", label: "מעגל דרך 3 נקודות" },
  midpoint: { icon: "◉", label: "נקודת אמצע" },
  parallel: { icon: "∥", label: "מקביל" },
  perpendicular: { icon: "⊥", label: "מאונך" },
  perpendicularBisector: { icon: "⊥̶", label: "אנך אמצעי" },
  median: { icon: "△̸", label: "תיכון במשולש" },
  angleBisector: { icon: "∠̸", label: "חוצה זווית" },
  intersection: { icon: "×", label: "נקודות חיתוך" },
};
const STROKE_STYLES: { value: StrokeStyle; label: string }[] = [
  { value: "solid", label: "רציף" },
  { value: "dashed", label: "מקווקו" },
  { value: "dotted", label: "מנוקד" },
];
const strokeDash = (style: StrokeStyle) =>
  style === "dashed" ? [10, 7] : style === "dotted" ? [2, 6] : [];
const MathDisplay = ({ latex }: { latex: string }) =>
  createElement("math-display", { value: latex, dir: "ltr" });
const canvasEquation = (raw: string) =>
  raw
    .replace(/sqrt\(([^()]*)\)/g, "√($1)")
    .replace(/\^2/g, "²")
    .replace(/\^3/g, "³")
    .replace(/\*/g, "·")
    .replace(/-/g, "−");
const GRID_PIXELS = 64;
const scaleForGridStep = (step: number) => GRID_PIXELS / step;
const clampScale = (scale: number, step: number) =>
  Math.max(
    scaleForGridStep(step) / 40,
    Math.min(scaleForGridStep(step) * 40, scale),
  );

const ToolSection = ({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) => (
  <section className={`tool-section ${open ? "open" : ""}`}>
    <button
      className="tool-section-head"
      type="button"
      onClick={onToggle}
      aria-expanded={open}
    >
      <span>{title}</span>
      <b>{open ? "⌄" : "›"}</b>
    </button>
    {open && <div className="tool-section-body">{children}</div>}
  </section>
);

const lineIntersection = (
  a: Point,
  b: Point,
  c: Point,
  d: Point,
): Point | null => {
  const den = (a.x - b.x) * (c.y - d.y) - (a.y - b.y) * (c.x - d.x);
  if (Math.abs(den) < 1e-10) return null;
  const cross1 = a.x * b.y - a.y * b.x,
    cross2 = c.x * d.y - c.y * d.x;
  return {
    x: (cross1 * (c.x - d.x) - (a.x - b.x) * cross2) / den,
    y: (cross1 * (c.y - d.y) - (a.y - b.y) * cross2) / den,
  };
};
const lineCircleIntersections = (
  a: Point,
  b: Point,
  center: Point,
  r: number,
) => {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    fx = a.x - center.x,
    fy = a.y - center.y;
  const A = dx * dx + dy * dy,
    B = 2 * (fx * dx + fy * dy),
    C = fx * fx + fy * fy - r * r,
    disc = B * B - 4 * A * C;
  if (A < 1e-12 || disc < -1e-10) return [] as Point[];
  const root = Math.sqrt(Math.max(0, disc));
  return [(-B - root) / (2 * A), (-B + root) / (2 * A)]
    .filter((t, i, x) => i === 0 || Math.abs(t - x[0]) > 1e-8)
    .map((t) => ({ x: a.x + t * dx, y: a.y + t * dy }));
};
const circleCircleIntersections = (
  c0: Point,
  r0: number,
  c1: Point,
  r1: number,
) => {
  const d = distance(c0, c1);
  if (d < 1e-10 || d > r0 + r1 + 1e-9 || d < Math.abs(r0 - r1) - 1e-9)
    return [] as Point[];
  const a = (r0 * r0 - r1 * r1 + d * d) / (2 * d),
    h = Math.sqrt(Math.max(0, r0 * r0 - a * a)),
    x2 = c0.x + (a * (c1.x - c0.x)) / d,
    y2 = c0.y + (a * (c1.y - c0.y)) / d;
  const rx = (-(c1.y - c0.y) * h) / d,
    ry = ((c1.x - c0.x) * h) / d;
  return h < 1e-9
    ? [{ x: x2, y: y2 }]
    : [
        { x: x2 + rx, y: y2 + ry },
        { x: x2 - rx, y: y2 - ry },
      ];
};
const circumcircle = (a: Point, b: Point, c: Point) => {
  const d = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
  if (Math.abs(d) < 1e-10) return null;
  const aa = a.x * a.x + a.y * a.y,
    bb = b.x * b.x + b.y * b.y,
    cc = c.x * c.x + c.y * c.y,
    center = {
      x: (aa * (b.y - c.y) + bb * (c.y - a.y) + cc * (a.y - b.y)) / d,
      y: (aa * (c.x - b.x) + bb * (a.x - c.x) + cc * (b.x - a.x)) / d,
    };
  return { center, r: distance(center, a) };
};

const valuesAreLinear = (evaluate: (x: number) => number) => {
  const values = [-2, -1, 0, 1, 2].map(evaluate);
  if (values.some((value) => !Number.isFinite(value))) return false;
  const tolerance = Math.max(1, ...values.map(Math.abs)) * 1e-7;
  const differences = values
    .slice(1)
    .map((value, index) => value - values[index]);
  return differences.every(
    (value) => Math.abs(value - differences[0]) < tolerance,
  );
};

const valuesAreQuadratic = (evaluate: (x: number) => number) => {
  const values = [-2, -1, 0, 1, 2].map(evaluate);
  if (values.some((value) => !Number.isFinite(value))) return false;
  const second = values
    .slice(0, 3)
    .map(
      (_, index) => values[index + 2] - 2 * values[index + 1] + values[index],
    );
  const tolerance = Math.max(1, ...values.map(Math.abs)) * 1e-7;
  return (
    Math.abs(second[0]) > tolerance &&
    Math.abs(second[1] - second[0]) < tolerance &&
    Math.abs(second[2] - second[1]) < tolerance
  );
};

export default function CoordinateWorkspace() {
  const canvasRef = useRef<HTMLCanvasElement>(null),
    wrapRef = useRef<HTMLDivElement>(null),
    keyboardHostRef = useRef<HTMLDivElement>(null);
  const keyboardFieldRef = useRef<MathKeyboardElement | null>(null),
    dragStartObjectsRef = useRef<MathObject[] | null>(null);
  const [objects, setObjects] = useState<MathObject[]>([]),
    [history, setHistory] = useState<MathObject[][]>([]),
    [future, setFuture] = useState<MathObject[][]>([]);
  const [tool, setTool] = useState<Tool>("point"),
    [mode, setMode] = useState<Mode>("coordinates"),
    [selectedId, setSelectedId] = useState<string | null>(null),
    [openPropertiesId, setOpenPropertiesId] = useState<string | null>(null);
  const [viewport, setViewport] = useState<Viewport>({
      centerX: 0,
      centerY: 0,
      scale: scaleForGridStep(1),
    }),
    [gridStep, setGridStep] = useState(1),
    [gridStepInput, setGridStepInput] = useState("1");
  const [snap, setSnap] = useState(true),
    [showGrid, setShowGrid] = useState(true),
    [showNumbers, setShowNumbers] = useState(true),
    [pending, setPending] = useState<ConstructionPoint | null>(null);
  const [anglePending, setAnglePending] = useState<string[]>([]),
    [polygonPending, setPolygonPending] = useState<string[]>([]),
    [objectPending, setObjectPending] = useState<string | null>(null),
    [pointer, setPointer] = useState<Point | null>(null);
  const [dragging, setDragging] = useState<{
      kind: "pan" | "point";
      id?: string;
      sx: number;
      sy: number;
      origin: Viewport;
    } | null>(null),
    [feedback, setFeedback] = useState<string | null>(null),
    [magneticTarget, setMagneticTarget] = useState<string | null>(null);
  const [equation, setEquation] = useState("y=2x+1"),
    [equationLatex, setEquationLatex] = useState("y=2x+1"),
    [functionKind, setFunctionKind] = useState<FunctionKind>("linear"),
    [keyboardOpen, setKeyboardOpen] = useState(false),
    [editingFunctionId, setEditingFunctionId] = useState<string | null>(null);
  const [leftOpen, setLeftOpen] = useState(true),
    [rightOpen, setRightOpen] = useState(true),
    [sections, setSections] = useState<Record<string, boolean>>(
      MODE_DEFAULT_SECTIONS.coordinates,
    );
  const [sliderName, setSliderName] = useState("a"),
    [sliderMin, setSliderMin] = useState(-5),
    [sliderMax, setSliderMax] = useState(5),
    [sliderStep, setSliderStep] = useState(0.1),
    [sliderValue, setSliderValue] = useState(1);
  const [moveX, setMoveX] = useState(2),
    [moveY, setMoveY] = useState(1),
    [rotation, setRotation] = useState(90);

  const selected = objects.find((o) => o.id === selectedId) ?? null;
  const sliders = objects.filter((o): o is SliderObject => o.type === "slider");
  const variables = Object.fromEntries(sliders.map((s) => [s.name, s.value]));
  const pushObjects = useCallback(
    (next: MathObject[]) => {
      setHistory((h) => [...h.slice(-49), objects]);
      setObjects(next);
      setFuture([]);
    },
    [objects],
  );
  const toggleSection = (key: string) =>
    setSections((s) => ({ ...s, [key]: !s[key] }));
  const resetPending = () => {
    setPending(null);
    setAnglePending([]);
    setPolygonPending([]);
    setObjectPending(null);
    setFeedback(null);
  };
  const chooseTool = (next: Tool) => {
    setTool(next);
    resetPending();
  };

  useEffect(() => {
    let disposed = false;
    const build = () => {
      if (
        disposed ||
        !keyboardHostRef.current ||
        keyboardFieldRef.current ||
        !customElements.get("math-keyboard-field")
      )
        return;
      const field = document.createElement(
        "math-keyboard-field",
      ) as MathKeyboardElement;
      field.setAttribute("placeholder", "הזינו פונקציה");
      field.setAttribute("value", equationLatex);
      field.addEventListener("mkf-input", (e) => {
        setEquation(field.getValue("ascii-math"));
        setEquationLatex((e as CustomEvent<{ latex: string }>).detail.latex);
      });
      keyboardHostRef.current.replaceChildren(field);
      keyboardFieldRef.current = field;
    };
    if (customElements.get("math-keyboard-field")) build();
    else {
      const existing = document.querySelector<HTMLScriptElement>(
          'script[data-math-keyboard="true"]',
        ),
        script = existing ?? document.createElement("script");
      script.addEventListener("load", build);
      if (!existing) {
        script.src = "./math-keyboard.js";
        script.dataset.mathKeyboard = "true";
        document.head.appendChild(script);
      }
    }
    return () => {
      disposed = true;
    };
  }, []);
  useEffect(() => {
    if (keyboardOpen && keyboardFieldRef.current) {
      keyboardFieldRef.current.value = equationLatex;
      requestAnimationFrame(() => keyboardFieldRef.current?.focus());
    }
  }, [keyboardOpen, equationLatex]);

  const expressionEvaluator = useCallback(
    (raw: string) => {
      const sides = raw
        .toLowerCase()
        .replace(/−/g, "-")
        .replace(/÷/g, "/")
        .replace(/[·×]/g, "*")
        .replace(/\s/g, "")
        .split("=");
      if (sides.length !== 2 || sides[0] !== "y") throw new Error("equation");
      let expression = sides[1];
      const allowedFunctions = new Set([
          "sqrt",
          "abs",
          "sin",
          "cos",
          "tan",
          "ln",
          "log",
          "exp",
          "pi",
        ]),
        words = expression.match(/[a-z]+/g) ?? [];
      for (const word of words) {
        if (
          word !== "x" &&
          !allowedFunctions.has(word) &&
          !(word.length === 1 && Object.hasOwn(variables, word))
        )
          throw new Error("symbol");
      }
      if (!/^[0-9a-z+\-*/^().,]+$/.test(expression))
        throw new Error("character");
      expression = expression
        .replace(/\^/g, "**")
        .replace(/\bpi\b/g, "Math.PI")
        .replace(/\bsqrt\b/g, "Math.sqrt")
        .replace(/\babs\b/g, "Math.abs")
        .replace(/\bsin\b/g, "Math.sin")
        .replace(/\bcos\b/g, "Math.cos")
        .replace(/\btan\b/g, "Math.tan")
        .replace(/\bln\b/g, "Math.log")
        .replace(/\blog\b/g, "Math.log10")
        .replace(/\bexp\b/g, "Math.exp");
      for (const name of Object.keys(variables))
        expression = expression.replace(
          new RegExp(`\\b${name}\\b`, "g"),
          `vars.${name}`,
        );
      expression = expression.replace(/(\d|x|\))(?=(x|\())/g, "$1*");
      const evaluate = new Function(
        "x",
        "vars",
        `"use strict";return (${expression});`,
      ) as (x: number, vars: Record<string, number>) => number;
      return {
        normalized: `y=${sides[1]}`,
        evaluate: (x: number) => evaluate(x, variables),
      };
    },
    [variables],
  );

  const pointById = useCallback(
    (id?: string, seen = new Set<string>()): PointObject | undefined => {
      if (!id || seen.has(id)) return;
      const raw = objects.find(
        (o): o is PointObject => o.type === "point" && o.id === id,
      );
      if (!raw) return;
      seen.add(id);
      if (raw.dependency?.kind === "midpoint") {
        const a = pointById(raw.dependency.aId, seen),
          b = pointById(raw.dependency.bId, seen);
        if (a && b) return { ...raw, ...midpoint(a, b) };
      }
      if (raw.dependency?.kind === "function") {
        const dependency = raw.dependency;
        const fn = objects.find(
          (object): object is FunctionObject =>
            object.type === "function" &&
            object.id === dependency.functionId,
        );
        if (fn) {
          try {
            const x = dependency.x,
              y = expressionEvaluator(fn.expression).evaluate(x);
            if (Number.isFinite(y)) return { ...raw, x, y };
          } catch {}
        }
      }
      return raw;
    },
    [expressionEvaluator, objects],
  );
  const segmentPoints = useCallback(
    (o: SegmentObject): { a: Point; b: Point } => {
      const construction = o.construction;
      if (
        construction?.kind === "parallel" ||
        construction?.kind === "perpendicular"
      ) {
        const sourceId = construction.sourceId,
          source = objects.find(
            (x): x is SegmentObject =>
              (x.type === "segment" || x.type === "line") && x.id === sourceId,
          ),
          through = pointById(construction.throughId);
        if (source && through) {
          const sourceEnds = segmentPoints(source),
            dx = sourceEnds.b.x - sourceEnds.a.x,
            dy = sourceEnds.b.y - sourceEnds.a.y,
            vector =
              construction.kind === "parallel"
                ? { x: dx, y: dy }
                : { x: -dy, y: dx };
          return {
            a: through,
            b: { x: through.x + vector.x, y: through.y + vector.y },
          };
        }
      }
      if (construction?.kind === "angleBisector") {
        const angleId = construction.angleId,
          angle = objects.find(
            (x): x is AngleObject => x.type === "angle" && x.id === angleId,
          );
        if (angle) {
          const a = pointById(angle.aId),
            v = pointById(angle.vertexId),
            c = pointById(angle.cId);
          if (a && v && c) {
            const u1 = {
                x: (a.x - v.x) / distance(a, v),
                y: (a.y - v.y) / distance(a, v),
              },
              u2 = {
                x: (c.x - v.x) / distance(c, v),
                y: (c.y - v.y) / distance(c, v),
              };
            return { a: v, b: { x: v.x + u1.x + u2.x, y: v.y + u1.y + u2.y } };
          }
        }
      }
      return { a: pointById(o.aId) ?? o.a, b: pointById(o.bId) ?? o.b };
    },
    [objects, pointById],
  );
  const circleData = useCallback(
    (o: CircleObject) => {
      if (o.threePointIds) {
        const [a, b, c] = o.threePointIds.map((id) => pointById(id));
        if (a && b && c) {
          const result = circumcircle(a, b, c);
          if (result) return result;
        }
      }
      const center = pointById(o.centerId) ?? o.center,
        through = pointById(o.throughId) ?? o.through;
      return {
        center,
        r: o.radius ?? (through ? distance(center, through) : 1),
      };
    },
    [pointById],
  );
  const polygonPoints = useCallback(
    (o: PolygonObject) =>
      o.pointIds
        .map((id) => pointById(id))
        .filter((p): p is PointObject => Boolean(p)),
    [pointById],
  );
  const worldToScreen = useCallback(
    (x: number, y: number, w: number, h: number) => ({
      x: w / 2 + (x - viewport.centerX) * viewport.scale,
      y: h / 2 - (y - viewport.centerY) * viewport.scale,
    }),
    [viewport],
  );
  const screenToWorld = useCallback(
    (x: number, y: number, w: number, h: number) => ({
      x: (x - w / 2) / viewport.scale + viewport.centerX,
      y: -(y - h / 2) / viewport.scale + viewport.centerY,
    }),
    [viewport],
  );
  const lineAcross = (a: Point, b: Point, w: number, h: number) => {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      c: { x: number; y: number; t: number }[] = [];
    if (Math.abs(dx) > 1e-9)
      for (const x of [0, w]) {
        const t = (x - a.x) / dx,
          y = a.y + t * dy;
        if (y >= -1 && y <= h + 1) c.push({ x, y, t });
      }
    if (Math.abs(dy) > 1e-9)
      for (const y of [0, h]) {
        const t = (y - a.y) / dy,
          x = a.x + t * dx;
        if (x >= -1 && x <= w + 1) c.push({ x, y, t });
      }
    c.sort((p, q) => p.t - q.t);
    return c.length >= 2 ? [c[0], c.at(-1)!] : [a, b];
  };
  const drawLabel = (
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    color: string,
  ) => {
    ctx.save();
    ctx.font = '600 14px "Latin Modern Math",serif';
    const width = ctx.measureText(text).width + 14;
    ctx.fillStyle = "rgba(255,255,255,.95)";
    ctx.strokeStyle = color + "66";
    ctx.beginPath();
    ctx.roundRect(x - width / 2, y - 13, width, 26, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, x, y);
    ctx.restore();
  };

  const lineEquation = (a: Point, b: Point) => {
    if (Math.abs(a.x - b.x) < 1e-10) return `x=${round(a.x)}`;
    const m = (b.y - a.y) / (b.x - a.x);
    const intercept = a.y - m * a.x;
    const mText =
      Math.abs(m - 1) < 1e-10
        ? ""
        : Math.abs(m + 1) < 1e-10
          ? "−"
          : String(round(m));
    const bText =
      Math.abs(intercept) < 1e-10
        ? ""
        : `${intercept > 0 ? "+" : "−"}${round(Math.abs(intercept))}`;
    return `y=${mText}x${bText}`;
  };

  const draw = useCallback(() => {
    const canvas = canvasRef.current,
      wrap = wrapRef.current;
    if (!canvas || !wrap) return;
    const rect = wrap.getBoundingClientRect(),
      dpr = window.devicePixelRatio || 1;
    if (
      canvas.width !== Math.round(rect.width * dpr) ||
      canvas.height !== Math.round(rect.height * dpr)
    ) {
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.direction = "ltr";
    const w = rect.width,
      h = rect.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, w, h);
    const visibleStep =
        gridStep * viewport.scale < 28
          ? gridStep * Math.ceil(28 / (gridStep * viewport.scale))
          : gridStep,
      minX = viewport.centerX - w / (2 * viewport.scale),
      maxX = viewport.centerX + w / (2 * viewport.scale),
      minY = viewport.centerY - h / (2 * viewport.scale),
      maxY = viewport.centerY + h / (2 * viewport.scale);
    if (showGrid) {
      ctx.strokeStyle = "#e7edf1";
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (
        let x = Math.floor(minX / visibleStep) * visibleStep;
        x <= maxX;
        x += visibleStep
      ) {
        const p = worldToScreen(x, 0, w, h);
        ctx.moveTo(p.x, 0);
        ctx.lineTo(p.x, h);
      }
      for (
        let y = Math.floor(minY / visibleStep) * visibleStep;
        y <= maxY;
        y += visibleStep
      ) {
        const p = worldToScreen(0, y, w, h);
        ctx.moveTo(0, p.y);
        ctx.lineTo(w, p.y);
      }
      ctx.stroke();
    }
    const origin = worldToScreen(0, 0, w, h);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 1.7;
    ctx.beginPath();
    ctx.moveTo(0, origin.y);
    ctx.lineTo(w, origin.y);
    ctx.moveTo(origin.x, 0);
    ctx.lineTo(origin.x, h);
    ctx.stroke();
    ctx.fillStyle = "#334155";
    ctx.beginPath();
    ctx.moveTo(w - 7, origin.y - 5);
    ctx.lineTo(w, origin.y);
    ctx.lineTo(w - 7, origin.y + 5);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(origin.x - 5, 7);
    ctx.lineTo(origin.x, 0);
    ctx.lineTo(origin.x + 5, 7);
    ctx.fill();
    ctx.font = "12px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    for (
      let x = Math.floor(minX / visibleStep) * visibleStep;
      x <= maxX;
      x += visibleStep
    ) {
      if (Math.abs(x) < 1e-8) continue;
      const p = worldToScreen(x, 0, w, h);
      ctx.beginPath();
      ctx.moveTo(p.x, origin.y - 4);
      ctx.lineTo(p.x, origin.y + 4);
      ctx.stroke();
      if (showNumbers) ctx.fillText(String(round(x)), p.x, origin.y + 7);
    }
    ctx.textAlign = "right";
    ctx.textBaseline = "middle";
    for (
      let y = Math.floor(minY / visibleStep) * visibleStep;
      y <= maxY;
      y += visibleStep
    ) {
      if (Math.abs(y) < 1e-8) continue;
      const p = worldToScreen(0, y, w, h);
      ctx.beginPath();
      ctx.moveTo(origin.x - 4, p.y);
      ctx.lineTo(origin.x + 4, p.y);
      ctx.stroke();
      if (showNumbers) ctx.fillText(String(round(y)), origin.x - 8, p.y);
    }
    ctx.font = "bold 14px Arial";
    ctx.fillText("x", w - 11, origin.y - 14);
    ctx.fillText("y", origin.x + 18, 12);
    objects
      .filter((o): o is PolygonObject => o.type === "polygon" && !o.hidden)
      .forEach((o) => {
        const pts = polygonPoints(o);
        if (pts.length < 3) return;
        const screens = pts.map((p) => worldToScreen(p.x, p.y, w, h));
        ctx.save();
        ctx.strokeStyle = o.color;
        ctx.fillStyle = o.color + "24";
        ctx.lineWidth = o.strokeWidth + (o.id === selectedId ? 1.5 : 0);
        ctx.setLineDash(strokeDash(o.strokeStyle));
        ctx.beginPath();
        screens.forEach((p, i) =>
          i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y),
        );
        ctx.closePath();
        if (o.fill) ctx.fill();
        ctx.stroke();
        ctx.restore();
        if (o.showLengths)
          screens.forEach((p, i) => {
            const q = screens[(i + 1) % screens.length],
              a = pts[i],
              b = pts[(i + 1) % pts.length];
            drawLabel(
              ctx,
              String(round(distance(a, b))),
              (p.x + q.x) / 2,
              (p.y + q.y) / 2,
              o.color,
            );
          });
        const center = screens.reduce(
            (s, p) => ({
              x: s.x + p.x / screens.length,
              y: s.y + p.y / screens.length,
            }),
            { x: 0, y: 0 },
          ),
          labels = [];
        if (o.showPerimeter)
          labels.push(`היקף ${round(polygonPerimeter(pts))}`);
        if (o.showArea) labels.push(`שטח ${round(polygonArea(pts))}`);
        if (labels.length)
          drawLabel(ctx, labels.join(" · "), center.x, center.y, o.color);
        if (o.showAngles)
          pts.forEach((p, i) => {
            const prev = pts[(i - 1 + pts.length) % pts.length],
              next = pts[(i + 1) % pts.length],
              screen = screens[i];
            drawLabel(
              ctx,
              `${round(angleDegrees(prev, p, next), 1)}°`,
              screen.x + 18,
              screen.y - 18,
              o.color,
            );
          });
      });
    objects
      .filter((o): o is CircleObject => o.type === "circle" && !o.hidden)
      .forEach((o) => {
        const { center, r } = circleData(o),
          p = worldToScreen(center.x, center.y, w, h),
          rp = r * viewport.scale;
        ctx.save();
        ctx.strokeStyle = o.color;
        ctx.fillStyle = o.color + "20";
        ctx.lineWidth = o.strokeWidth + (o.id === selectedId ? 1.5 : 0);
        ctx.setLineDash(strokeDash(o.strokeStyle));
        ctx.beginPath();
        ctx.arc(p.x, p.y, rp, 0, Math.PI * 2);
        if (o.fill) ctx.fill();
        ctx.stroke();
        ctx.restore();
        if (o.showCenter) {
          ctx.fillStyle = o.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
        if (o.showRadius || o.showDiameter) {
          ctx.save();
          ctx.strokeStyle = o.color;
          ctx.lineWidth = 1.5;
          ctx.setLineDash([5, 4]);
          ctx.beginPath();
          ctx.moveTo(o.showDiameter ? p.x - rp : p.x, p.y);
          ctx.lineTo(p.x + rp, p.y);
          ctx.stroke();
          ctx.restore();
        }
        const labels = [];
        if (o.showRadius) labels.push(`r=${round(r)}`);
        if (o.showDiameter) labels.push(`d=${round(2 * r)}`);
        if (o.showCircumference) labels.push(`היקף ${round(2 * Math.PI * r)}`);
        if (o.showArea) labels.push(`שטח ${round(Math.PI * r * r)}`);
        if (labels.length)
          drawLabel(ctx, labels.join(" · "), p.x, p.y - rp - 18, o.color);
      });
    objects
      .filter((o): o is FunctionObject => o.type === "function" && !o.hidden)
      .forEach((o) => {
        let evaluate: (x: number) => number;
        try {
          evaluate = expressionEvaluator(o.expression).evaluate;
        } catch {
          return;
        }
        ctx.save();
        ctx.strokeStyle = o.color;
        ctx.lineWidth = o.strokeWidth + (o.id === selectedId ? 1.5 : 0);
        ctx.setLineDash(strokeDash(o.strokeStyle));
        ctx.beginPath();
        let drawing = false,
          label: Point | null = null,
          previousY = 0;
        for (let sx = 0; sx <= w; sx += 2) {
          const x = screenToWorld(sx, h / 2, w, h).x;
          if (
            (o.domainMin !== undefined && x < o.domainMin) ||
            (o.domainMax !== undefined && x > o.domainMax)
          ) {
            drawing = false;
            continue;
          }
          const y = evaluate(x),
            s = worldToScreen(x, y, w, h),
            valid =
              Number.isFinite(y) &&
              Number.isFinite(s.y) &&
              Math.abs(s.y) < h * 5;
          if (!valid || (drawing && Math.abs(s.y - previousY) > h * 1.5)) {
            drawing = false;
            continue;
          }
          if (!drawing) {
            ctx.moveTo(s.x, s.y);
            drawing = true;
          } else ctx.lineTo(s.x, s.y);
          previousY = s.y;
          if (!label && s.x > w * 0.58 && s.y > 40 && s.y < h - 40) label = s;
        }
        ctx.stroke();
        ctx.restore();
        if (o.showEquation && label)
          drawLabel(
            ctx,
            `${o.name}: ${canvasEquation(o.expression)}`,
            label.x,
            label.y,
            o.color,
          );
        for (const side of ["min", "max"] as const) {
          const x = side === "min" ? o.domainMin : o.domainMax;
          if (x === undefined) continue;
          const y = evaluate(x);
          if (!Number.isFinite(y)) continue;
          const s = worldToScreen(x, y, w, h),
            closed = side === "min" ? o.minClosed : o.maxClosed;
          ctx.beginPath();
          ctx.arc(s.x, s.y, 5, 0, Math.PI * 2);
          ctx.fillStyle = closed ? o.color : "#fff";
          ctx.fill();
          ctx.strokeStyle = o.color;
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      });
    objects
      .filter(
        (o): o is SegmentObject =>
          (o.type === "segment" || o.type === "line") && !o.hidden,
      )
      .forEach((o) => {
        const ep = segmentPoints(o),
          pa = worldToScreen(ep.a.x, ep.a.y, w, h),
          pb = worldToScreen(ep.b.x, ep.b.y, w, h);
        ctx.save();
        ctx.strokeStyle = o.color;
        ctx.lineWidth = o.strokeWidth + (o.id === selectedId ? 1.5 : 0);
        ctx.setLineDash(strokeDash(o.strokeStyle));
        ctx.beginPath();
        let a = pa,
          b = pb;
        if (o.type === "line") [a, b] = lineAcross(pa, pb, w, h);
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.restore();
        const labels = [];
        if (o.showLength && o.type === "segment")
          labels.push(`אורך ${round(distance(ep.a, ep.b))}`);
        if (o.showSlope)
          labels.push(
            `שיפוע ${slope(ep.a, ep.b) === Infinity ? "לא מוגדר" : round(slope(ep.a, ep.b))}`,
          );
        if (o.showLabel && o.type === "line")
          labels.push(`${o.name}: ${lineEquation(ep.a, ep.b)}`);
        if (labels.length)
          drawLabel(
            ctx,
            labels.join(" · "),
            (a.x + b.x) / 2,
            (a.y + b.y) / 2,
            o.color,
          );
      });
    objects
      .filter((o): o is AngleObject => o.type === "angle" && !o.hidden)
      .forEach((o) => {
        const a = pointById(o.aId),
          v = pointById(o.vertexId),
          c = pointById(o.cId);
        if (!a || !v || !c) return;
        const pa = worldToScreen(a.x, a.y, w, h),
          pv = worldToScreen(v.x, v.y, w, h),
          pc = worldToScreen(c.x, c.y, w, h);
        let start = Math.atan2(pa.y - pv.y, pa.x - pv.x),
          end = Math.atan2(pc.y - pv.y, pc.x - pv.x),
          delta = (end - start + Math.PI * 2) % (Math.PI * 2);
        if (delta > Math.PI) {
          [start, end] = [end, start];
          delta = Math.PI * 2 - delta;
        }
        ctx.save();
        ctx.strokeStyle = o.color;
        ctx.lineWidth = o.strokeWidth;
        ctx.setLineDash(strokeDash(o.strokeStyle));
        ctx.beginPath();
        ctx.arc(pv.x, pv.y, 34, start, start + delta);
        ctx.stroke();
        ctx.restore();
        if (o.showMeasure) {
          const mid = start + delta / 2;
          drawLabel(
            ctx,
            `${round(angleDegrees(a, v, c), 1)}°`,
            pv.x + Math.cos(mid) * 52,
            pv.y + Math.sin(mid) * 52,
            o.color,
          );
        }
      });
    objects
      .filter((o): o is PointObject => o.type === "point" && !o.hidden)
      .forEach((raw) => {
        const o = pointById(raw.id) ?? raw,
          p = worldToScreen(o.x, o.y, w, h);
        if (o.guides) {
          ctx.save();
          ctx.setLineDash([5, 5]);
          ctx.strokeStyle = o.color + "88";
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x, origin.y);
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(origin.x, p.y);
          ctx.stroke();
          ctx.restore();
        }
        ctx.fillStyle = o.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, o.id === selectedId ? 7 : 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();
        let label = "";
        if (o.showName) label += o.name;
        if (o.showCoords)
          label += (label ? " " : "") + `(${round(o.x)}, ${round(o.y)})`;
        if (label) {
          ctx.fillStyle = o.color;
          ctx.font = '600 15px "Latin Modern Math",serif';
          ctx.textAlign = "left";
          ctx.fillText(label, p.x + 10, p.y - 12);
        }
      });
    if (
      pointer &&
      magneticTarget &&
      (tool === "point" || dragging?.kind === "point")
    ) {
      const p = worldToScreen(pointer.x, pointer.y, w, h);
      ctx.save();
      ctx.strokeStyle = "#087f78";
      ctx.fillStyle = "rgba(8,127,120,.12)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.restore();
    }
    if (polygonPending.length) {
      const points = polygonPending
        .map((id) => pointById(id))
        .filter((point): point is PointObject => Boolean(point));
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = "#ea580c";
      ctx.lineWidth = 2;
      ctx.beginPath();
      points.forEach((point, index) => {
        const p = worldToScreen(point.x, point.y, w, h);
        if (index === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      if (pointer) {
        const p = worldToScreen(pointer.x, pointer.y, w, h);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.restore();
    }
    if (anglePending.length) {
      const points = anglePending
        .map((id) => pointById(id))
        .filter((point): point is PointObject => Boolean(point));
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = "#7c3aed";
      ctx.lineWidth = 2;
      ctx.beginPath();
      points.forEach((point, index) => {
        const p = worldToScreen(point.x, point.y, w, h);
        if (index === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      });
      if (pointer) {
        const p = worldToScreen(pointer.x, pointer.y, w, h);
        ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.restore();
    }
    if (pending && pointer) {
      const a = worldToScreen(pending.x, pending.y, w, h),
        b = worldToScreen(pointer.x, pointer.y, w, h);
      ctx.save();
      ctx.setLineDash([6, 5]);
      ctx.strokeStyle = "#0f766e";
      ctx.beginPath();
      if (tool === "circle" || tool === "circleRadius") {
        ctx.arc(a.x, a.y, Math.hypot(b.x - a.x, b.y - a.y), 0, Math.PI * 2);
      } else {
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
      }
      ctx.stroke();
      ctx.restore();
    }
  }, [
    circleData,
    anglePending,
    dragging,
    expressionEvaluator,
    gridStep,
    magneticTarget,
    objects,
    pending,
    pointer,
    pointById,
    polygonPending,
    polygonPoints,
    screenToWorld,
    segmentPoints,
    selectedId,
    showGrid,
    showNumbers,
    tool,
    viewport,
    worldToScreen,
  ]);
  useEffect(() => {
    draw();
    const ro = new ResizeObserver(draw);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, [draw]);

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return {
      x: e.clientX - r.left,
      y: e.clientY - r.top,
      w: r.width,
      h: r.height,
    };
  };
  const snapWorld = (p: Point) =>
    snap
      ? {
          x: round(Math.round(p.x / gridStep) * gridStep, 4),
          y: round(Math.round(p.y / gridStep) * gridStep, 4),
        }
      : p;
  const nearestPoint = (sx: number, sy: number, w: number, h: number) =>
    objects
      .filter((o): o is PointObject => o.type === "point" && !o.hidden)
      .find((o) => {
        const p = pointById(o.id) ?? o,
          s = worldToScreen(p.x, p.y, w, h);
        return Math.hypot(s.x - sx, s.y - sy) < 13;
      });
  const distanceToSegment = (p: Point, a: Point, b: Point, extend = false) => {
    const dx = b.x - a.x,
      dy = b.y - a.y,
      len = dx * dx + dy * dy;
    if (!len) return distance(p, a);
    const raw = ((p.x - a.x) * dx + (p.y - a.y) * dy) / len,
      t = extend ? raw : Math.max(0, Math.min(1, raw));
    return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
  };
  const nearestObject = (sx: number, sy: number, w: number, h: number) => {
    const point = nearestPoint(sx, sy, w, h);
    if (point) return point;
    const world = screenToWorld(sx, sy, w, h);
    let best: MathObject | undefined,
      bestPx = 12;
    for (const o of [...objects].reverse()) {
      if (o.hidden) continue;
      let d = Infinity;
      if (o.type === "segment" || o.type === "line") {
        const ep = segmentPoints(o);
        d =
          distanceToSegment(world, ep.a, ep.b, o.type === "line") *
          viewport.scale;
      } else if (o.type === "circle") {
        const c = circleData(o);
        d = Math.abs(distance(world, c.center) - c.r) * viewport.scale;
      } else if (o.type === "polygon") {
        const pts = polygonPoints(o);
        pts.forEach(
          (p, i) =>
            (d = Math.min(
              d,
              distanceToSegment(world, p, pts[(i + 1) % pts.length]) *
                viewport.scale,
            )),
        );
      } else if (o.type === "angle") {
        const a = pointById(o.aId),
          vertex = pointById(o.vertexId),
          c = pointById(o.cId);
        if (a && vertex && c) {
          const pa = worldToScreen(a.x, a.y, w, h),
            pv = worldToScreen(vertex.x, vertex.y, w, h),
            pc = worldToScreen(c.x, c.y, w, h);
          let start = Math.atan2(pa.y - pv.y, pa.x - pv.x),
            end = Math.atan2(pc.y - pv.y, pc.x - pv.x),
            delta = (end - start + Math.PI * 2) % (Math.PI * 2);
          if (delta > Math.PI) {
            [start, end] = [end, start];
            delta = Math.PI * 2 - delta;
          }
          const pointerAngle = Math.atan2(sy - pv.y, sx - pv.x),
            relative = (pointerAngle - start + Math.PI * 2) % (Math.PI * 2);
          if (relative <= delta + 0.12)
            d = Math.abs(Math.hypot(sx - pv.x, sy - pv.y) - 34);
        }
      } else if (o.type === "function") {
        try {
          const ev = expressionEvaluator(o.expression).evaluate;
          for (
            let x = world.x - 14 / viewport.scale;
            x <= world.x + 14 / viewport.scale;
            x += 1 / viewport.scale
          )
            d = Math.min(
              d,
              Math.hypot(x - world.x, ev(x) - world.y) * viewport.scale,
            );
        } catch {}
      }
      if (d < bestPx) {
        best = o;
        bestPx = d;
      }
    }
    return best;
  };
  const magneticCandidate = (
    sx: number,
    sy: number,
    w: number,
    h: number,
    threshold = 22,
  ): { point: Point; name: string; objectId: string; distance: number } | null => {
    let best: {
      point: Point;
      name: string;
      objectId: string;
      distance: number;
    } | null = null;
    const consider = (point: Point, name: string, objectId: string, d: number) => {
      if (d <= threshold && (!best || d < best.distance))
        best = { point, name, objectId, distance: d };
    };
    for (const o of objects) {
      if (o.hidden) continue;
      if (o.type === "segment" || o.type === "line") {
        const ep = segmentPoints(o),
          a = worldToScreen(ep.a.x, ep.a.y, w, h),
          b = worldToScreen(ep.b.x, ep.b.y, w, h),
          dx = b.x - a.x,
          dy = b.y - a.y,
          len = dx * dx + dy * dy;
        if (!len) continue;
        const raw = ((sx - a.x) * dx + (sy - a.y) * dy) / len,
          t = o.type === "line" ? raw : Math.max(0, Math.min(1, raw)),
          screen = { x: a.x + t * dx, y: a.y + t * dy };
        consider(
          screenToWorld(screen.x, screen.y, w, h),
          o.name,
          o.id,
          Math.hypot(sx - screen.x, sy - screen.y),
        );
      } else if (o.type === "circle") {
        const c = circleData(o),
          world = screenToWorld(sx, sy, w, h),
          d = distance(c.center, world);
        if (d > 1e-9) {
          const point = {
              x: c.center.x + ((world.x - c.center.x) * c.r) / d,
              y: c.center.y + ((world.y - c.center.y) * c.r) / d,
            },
            screen = worldToScreen(point.x, point.y, w, h);
          consider(
            point,
            o.name,
            o.id,
            Math.hypot(sx - screen.x, sy - screen.y),
          );
        }
      } else if (o.type === "function") {
        try {
          const ev = expressionEvaluator(o.expression).evaluate;
          for (
            let screenX = Math.max(0, sx - threshold);
            screenX <= Math.min(w, sx + threshold);
            screenX++
          ) {
            const x = screenToWorld(screenX, sy, w, h).x;
            if (
              (o.domainMin !== undefined && x < o.domainMin) ||
              (o.domainMax !== undefined && x > o.domainMax)
            )
              continue;
            const y = ev(x),
              screen = worldToScreen(x, y, w, h);
            if (Number.isFinite(screen.y))
              consider(
                { x, y },
                o.name,
                o.id,
                Math.hypot(sx - screen.x, sy - screen.y),
              );
          }
        } catch {}
      }
    }
    return best;
  };
  const getOrCreatePoint = (cp: ConstructionPoint, current: MathObject[]) => {
    if (cp.pointId) return { id: cp.pointId, next: current };
    const p: PointObject = {
      id: uid(),
      type: "point",
      name: nextPointName(current),
      x: cp.x,
      y: cp.y,
      color: COLORS[0],
      showName: true,
      showCoords: false,
      guides: false,
      dependency: cp.functionId
        ? { kind: "function", functionId: cp.functionId, x: cp.x }
        : undefined,
    };
    return { id: p.id, next: [...current, p] };
  };
  const finishPolygon = () => {
    if (polygonPending.length < 3) {
      setFeedback("כדי לסגור מצולע דרושות לפחות שלוש נקודות");
      return;
    }
    const p: PolygonObject = {
      id: uid(),
      type: "polygon",
      name: `מצולע ${objects.filter((o) => o.type === "polygon").length + 1}`,
      pointIds: polygonPending,
      color: COLORS[4],
      fill: true,
      showLengths: false,
      showAngles: false,
      showPerimeter: true,
      showArea: true,
      strokeWidth: 2.5,
      strokeStyle: "solid",
    };
    pushObjects([...objects, p]);
    setPolygonPending([]);
    setSelectedId(p.id);
    setOpenPropertiesId(p.id);
    setTool("select");
  };

  const addIntersections = (first: MathObject, second: MathObject) => {
    let points: Point[] = [];
    const isLine = (o: MathObject): o is SegmentObject =>
      o.type === "line" || o.type === "segment";
    const onObject = (point: Point, object: SegmentObject) => {
      if (object.type === "line") return true;
      const ends = segmentPoints(object);
      return (
        point.x >= Math.min(ends.a.x, ends.b.x) - 1e-7 &&
        point.x <= Math.max(ends.a.x, ends.b.x) + 1e-7 &&
        point.y >= Math.min(ends.a.y, ends.b.y) - 1e-7 &&
        point.y <= Math.max(ends.a.y, ends.b.y) + 1e-7
      );
    };
    const functionRange = (fn: FunctionObject) => ({
      min: fn.domainMin ?? viewport.centerX - 20,
      max: fn.domainMax ?? viewport.centerX + 20,
    });
    const rootsOf = (
      evaluate: (x: number) => number,
      min: number,
      max: number,
    ) => {
      const roots: number[] = [];
      const span = Math.max(0.001, max - min);
      const step = Math.max(0.002, span / 1600);
      let previousX = min,
        previousValue = evaluate(min);
      for (let x = min + step; x <= max + step / 2; x += step) {
        const currentX = Math.min(x, max),
          value = evaluate(currentX);
        if (Number.isFinite(value) && Math.abs(value) < 1e-6)
          roots.push(currentX);
        if (
          Number.isFinite(value) &&
          Number.isFinite(previousValue) &&
          value * previousValue < 0
        ) {
          let lo = previousX,
            hi = currentX,
            loValue = previousValue;
          for (let iteration = 0; iteration < 40; iteration++) {
            const middle = (lo + hi) / 2,
              middleValue = evaluate(middle);
            if (!Number.isFinite(middleValue)) break;
            if (loValue * middleValue <= 0) hi = middle;
            else {
              lo = middle;
              loValue = middleValue;
            }
          }
          const root = (lo + hi) / 2;
          if (Math.abs(evaluate(root)) < 1e-4) roots.push(root);
        }
        previousX = currentX;
        previousValue = value;
      }
      return roots.filter(
        (root, index) =>
          roots.findIndex((candidate) => Math.abs(candidate - root) < 0.002) ===
          index,
      );
    };
    if (isLine(first) && isLine(second)) {
      const a = segmentPoints(first),
        b = segmentPoints(second),
        p = lineIntersection(a.a, a.b, b.a, b.b);
      if (p && onObject(p, first) && onObject(p, second)) points = [p];
    } else if (
      (isLine(first) && second.type === "circle") ||
      (first.type === "circle" && isLine(second))
    ) {
      const line = isLine(first) ? first : (second as SegmentObject),
        circle = first.type === "circle" ? first : (second as CircleObject),
        l = segmentPoints(line),
        c = circleData(circle);
      points = lineCircleIntersections(l.a, l.b, c.center, c.r).filter(
        (point) => onObject(point, line),
      );
    } else if (first.type === "circle" && second.type === "circle") {
      const a = circleData(first),
        b = circleData(second);
      points = circleCircleIntersections(a.center, a.r, b.center, b.r);
    } else if (
      (isLine(first) && second.type === "function") ||
      (first.type === "function" && isLine(second))
    ) {
      try {
        const line = isLine(first) ? first : (second as SegmentObject),
          fn = first.type === "function" ? first : (second as FunctionObject),
          f = expressionEvaluator(fn.expression).evaluate,
          ends = segmentPoints(line),
          range = functionRange(fn);
        if (Math.abs(ends.a.x - ends.b.x) < 1e-10) {
          const x = ends.a.x,
            y = f(x),
            point = { x, y };
          if (
            x >= range.min &&
            x <= range.max &&
            Number.isFinite(y) &&
            onObject(point, line)
          )
            points = [point];
        } else {
          const m = (ends.b.y - ends.a.y) / (ends.b.x - ends.a.x),
            b = ends.a.y - m * ends.a.x;
          points = rootsOf((x) => f(x) - (m * x + b), range.min, range.max)
            .map((x) => ({ x, y: f(x) }))
            .filter((point) => onObject(point, line));
        }
      } catch {}
    } else if (
      (first.type === "circle" && second.type === "function") ||
      (first.type === "function" && second.type === "circle")
    ) {
      try {
        const circle =
            first.type === "circle" ? first : (second as CircleObject),
          fn = first.type === "function" ? first : (second as FunctionObject),
          f = expressionEvaluator(fn.expression).evaluate,
          data = circleData(circle),
          range = functionRange(fn);
        points = rootsOf(
          (x) =>
            (x - data.center.x) ** 2 +
            (f(x) - data.center.y) ** 2 -
            data.r ** 2,
          range.min,
          range.max,
        ).map((x) => ({ x, y: f(x) }));
      } catch {}
    } else if (first.type === "function" && second.type === "function") {
      try {
        const f = expressionEvaluator(first.expression).evaluate,
          g = expressionEvaluator(second.expression).evaluate,
          firstRange = functionRange(first),
          secondRange = functionRange(second),
          min = Math.max(firstRange.min, secondRange.min),
          max = Math.min(firstRange.max, secondRange.max);
        if (max >= min)
          points = rootsOf((x) => f(x) - g(x), min, max).map((x) => ({
            x,
            y: f(x),
          }));
      } catch {}
    }
    if (!points.length) {
      setFeedback("לא נמצאו נקודות חיתוך בין שני האובייקטים");
      return;
    }
    let next = objects;
    const created: PointObject[] = points.map((p) => {
      const o: PointObject = {
        id: uid(),
        type: "point",
        name: nextPointName(next),
        x: p.x,
        y: p.y,
        color: COLORS[2],
        showName: true,
        showCoords: true,
        guides: false,
      };
      next = [...next, o];
      return o;
    });
    pushObjects(next);
    setSelectedId(created[0].id);
    setOpenPropertiesId(created[0].id);
    setFeedback(`נוצרו ${created.length} נקודות חיתוך`);
    setObjectPending(null);
  };

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    const p = pointerPos(e),
      magnet = magneticCandidate(p.x, p.y, p.w, p.h),
      world = magnet?.point ?? snapWorld(screenToWorld(p.x, p.y, p.w, p.h)),
      hitPoint = nearestPoint(p.x, p.y, p.w, p.h),
      hit = nearestObject(p.x, p.y, p.w, p.h),
      cp: ConstructionPoint = hitPoint
        ? { ...hitPoint, pointId: hitPoint.id }
        : {
            ...world,
            functionId: objects.some(
              (object) =>
                object.type === "function" && object.id === magnet?.objectId,
            )
              ? magnet?.objectId
              : undefined,
          };
    setMagneticTarget(magnet?.name ?? null);
    if (tool === "pan" || e.button === 1 || e.altKey) {
      setDragging({
        kind: "pan",
        sx: e.clientX,
        sy: e.clientY,
        origin: viewport,
      });
      return;
    }
    if (tool === "select") {
      if (hit) {
        setSelectedId(hit.id);
        setOpenPropertiesId(hit.id);
        if (
          hit.type === "point" &&
          (!hit.dependency || hit.dependency.kind === "function")
        ) {
          dragStartObjectsRef.current = objects;
          setDragging({
            kind: "point",
            id: hit.id,
            sx: e.clientX,
            sy: e.clientY,
            origin: viewport,
          });
        }
      } else {
        setSelectedId(null);
        setOpenPropertiesId(null);
        setDragging({
          kind: "pan",
          sx: e.clientX,
          sy: e.clientY,
          origin: viewport,
        });
      }
      return;
    }
    if (tool === "point") {
      const o: PointObject = {
        id: uid(),
        type: "point",
        name: nextPointName(objects),
        x: world.x,
        y: world.y,
        color: COLORS[0],
        showName: true,
        showCoords: true,
        guides: false,
        dependency: cp.functionId
          ? { kind: "function", functionId: cp.functionId, x: cp.x }
          : undefined,
      };
      pushObjects([...objects, o]);
      setSelectedId(o.id);
      setOpenPropertiesId(o.id);
      return;
    }
    if (tool === "segment" || tool === "line") {
      if (!pending) {
        setPending(cp);
        return;
      }
      if (distance(pending, cp) < 1e-9) {
        setFeedback("בחרו נקודה שנייה שונה");
        return;
      }
      let next = objects;
      const a = getOrCreatePoint(pending, next);
      next = a.next;
      const b = getOrCreatePoint(cp, next);
      next = b.next;
      const pa = next.find(
          (o): o is PointObject => o.type === "point" && o.id === a.id,
        )!,
        pb = next.find(
          (o): o is PointObject => o.type === "point" && o.id === b.id,
        )!;
      const o: SegmentObject = {
        id: uid(),
        type: tool,
        name: `${pa.name}${pb.name}`,
        a: pa,
        b: pb,
        aId: a.id,
        bId: b.id,
        color: COLORS[1],
        showLength: tool === "segment",
        showSlope: false,
        showLabel: tool === "line",
        strokeWidth: 2.5,
        strokeStyle: "solid",
      };
      pushObjects([...next, o]);
      setPending(null);
      setSelectedId(o.id);
      setOpenPropertiesId(o.id);
      return;
    }
    if (tool === "angle") {
      if (!hitPoint) {
        setFeedback("בחרו שלוש נקודות קיימות; הנקודה השנייה היא הקודקוד");
        return;
      }
      if (anglePending.includes(hitPoint.id)) {
        setFeedback("יש לבחור שלוש נקודות שונות");
        return;
      }
      const next = [...anglePending, hitPoint.id];
      if (next.length < 3) {
        setAnglePending(next);
        setFeedback(
          next.length === 1
            ? "בחרו את קודקוד הזווית"
            : "בחרו את הנקודה השלישית",
        );
        return;
      }
      const [aId, vertexId, cId] = next,
        a = pointById(aId)!,
        v = pointById(vertexId)!,
        c = pointById(cId)!,
        o: AngleObject = {
          id: uid(),
          type: "angle",
          name: `∠${a.name}${v.name}${c.name}`,
          aId,
          vertexId,
          cId,
          color: COLORS[3],
          showMeasure: true,
          strokeWidth: 2.5,
          strokeStyle: "solid",
        };
      pushObjects([...objects, o]);
      setAnglePending([]);
      setSelectedId(o.id);
      setOpenPropertiesId(o.id);
      setFeedback(null);
      return;
    }
    if (tool === "polygon") {
      let next = objects,
        id = hitPoint?.id;
      if (!id) {
        const made = getOrCreatePoint(cp, next);
        id = made.id;
        next = made.next;
        if (next !== objects) setObjects(next);
      }
      if (polygonPending.length >= 3 && id === polygonPending[0]) {
        setObjects(objects);
        finishPolygon();
        return;
      }
      if (polygonPending.includes(id)) {
        setFeedback("הנקודה כבר שייכת למצולע");
        return;
      }
      setPolygonPending([...polygonPending, id]);
      setFeedback(
        polygonPending.length < 2
          ? "המשיכו לבחור קודקודים"
          : "לחצו על הנקודה הראשונה או על ‘סיום מצולע’",
      );
      return;
    }
    if (tool === "circle" || tool === "circleRadius") {
      if (!pending) {
        setPending(cp);
        setFeedback(
          tool === "circle"
            ? "בחרו נקודה על המעגל"
            : "לחצו שוב לקביעת הרדיוס, או הזינו אותו במאפיינים",
        );
        return;
      }
      const center = getOrCreatePoint(pending, objects),
        through = tool === "circle" ? getOrCreatePoint(cp, center.next) : null,
        r = Math.max(gridStep * 0.1, distance(pending, cp));
      const o: CircleObject = {
        id: uid(),
        type: "circle",
        name: `מעגל ${objects.filter((x) => x.type === "circle").length + 1}`,
        center: pending,
        centerId: center.id,
        through: tool === "circle" ? cp : undefined,
        throughId: through?.id,
        radius: tool === "circleRadius" ? r : undefined,
        color: COLORS[5],
        fill: false,
        showCenter: true,
        showRadius: true,
        showDiameter: false,
        showCircumference: true,
        showArea: true,
        strokeWidth: 2.5,
        strokeStyle: "solid",
      };
      pushObjects([...(through?.next ?? center.next), o]);
      setPending(null);
      setSelectedId(o.id);
      setOpenPropertiesId(o.id);
      setFeedback(null);
      return;
    }
    if (tool === "circleThree") {
      if (!hitPoint) {
        setFeedback("בחרו שלוש נקודות קיימות");
        return;
      }
      if (anglePending.includes(hitPoint.id)) {
        setFeedback("יש לבחור שלוש נקודות שונות");
        return;
      }
      const next = [...anglePending, hitPoint.id];
      if (next.length < 3) {
        setAnglePending(next);
        setFeedback(`נבחרו ${next.length} מתוך 3 נקודות`);
        return;
      }
      const [a, b, c] = next.map((id) => pointById(id)!);
      const data = circumcircle(a, b, c);
      if (!data) {
        setAnglePending([]);
        setFeedback("שלוש הנקודות נמצאות על ישר אחד ולכן אינן מגדירות מעגל");
        return;
      }
      const o: CircleObject = {
        id: uid(),
        type: "circle",
        name: `מעגל ${objects.filter((x) => x.type === "circle").length + 1}`,
        center: data.center,
        radius: data.r,
        threePointIds: [next[0], next[1], next[2]],
        color: COLORS[5],
        fill: false,
        showCenter: true,
        showRadius: true,
        showDiameter: false,
        showCircumference: true,
        showArea: true,
        strokeWidth: 2.5,
        strokeStyle: "solid",
      };
      pushObjects([...objects, o]);
      setAnglePending([]);
      setSelectedId(o.id);
      setOpenPropertiesId(o.id);
      setTool("select");
      setFeedback(null);
      return;
    }
    if (tool === "midpoint" || tool === "perpendicularBisector") {
      if (!hit || (hit.type !== "segment" && hit.type !== "line")) {
        setFeedback("בחרו קטע או ישר");
        return;
      }
      const ep = segmentPoints(hit);
      if (!hit.aId || !hit.bId) {
        setFeedback("הבנייה דורשת אובייקט המחובר לשתי נקודות");
        return;
      }
      const m: PointObject = {
        id: uid(),
        type: "point",
        name: nextPointName(objects),
        ...midpoint(ep.a, ep.b),
        dependency: { kind: "midpoint", aId: hit.aId, bId: hit.bId },
        color: COLORS[0],
        showName: true,
        showCoords: true,
        guides: false,
      };
      let next: MathObject[] = [...objects, m];
      if (tool === "perpendicularBisector") {
        const l: SegmentObject = {
          id: uid(),
          type: "line",
          name: `אנך אמצעי ל־${hit.name}`,
          a: m,
          b: { x: m.x - (ep.b.y - ep.a.y), y: m.y + (ep.b.x - ep.a.x) },
          aId: m.id,
          color: COLORS[6],
          showLength: false,
          showSlope: false,
          showLabel: true,
          strokeWidth: 2.5,
          strokeStyle: "dashed",
          construction: {
            kind: "perpendicular",
            sourceId: hit.id,
            throughId: m.id,
          },
        };
        next.push(l);
        setSelectedId(l.id);
        setOpenPropertiesId(l.id);
      } else {
        setSelectedId(m.id);
        setOpenPropertiesId(m.id);
      }
      pushObjects(next);
      setTool("select");
      return;
    }
    if (tool === "parallel" || tool === "perpendicular") {
      if (!objectPending) {
        if (!hit || (hit.type !== "segment" && hit.type !== "line")) {
          setFeedback("תחילה בחרו ישר או קטע");
          return;
        }
        setObjectPending(hit.id);
        setFeedback("כעת בחרו נקודה שהישר יעבור דרכה");
        return;
      }
      if (!hitPoint) {
        setFeedback("בחרו נקודה קיימת");
        return;
      }
      const source = objects.find(
        (o): o is SegmentObject =>
          (o.type === "segment" || o.type === "line") && o.id === objectPending,
      );
      if (!source) return;
      const ep = segmentPoints(source),
        dx = ep.b.x - ep.a.x,
        dy = ep.b.y - ep.a.y,
        v = tool === "parallel" ? { x: dx, y: dy } : { x: -dy, y: dx },
        o: SegmentObject = {
          id: uid(),
          type: "line",
          name:
            tool === "parallel"
              ? `מקביל ל־${source.name}`
              : `מאונך ל־${source.name}`,
          a: hitPoint,
          b: { x: hitPoint.x + v.x, y: hitPoint.y + v.y },
          aId: hitPoint.id,
          color: COLORS[6],
          showLength: false,
          showSlope: false,
          showLabel: true,
          strokeWidth: 2.5,
          strokeStyle: "solid",
          construction: {
            kind: tool,
            sourceId: source.id,
            throughId: hitPoint.id,
          },
        };
      pushObjects([...objects, o]);
      setObjectPending(null);
      setSelectedId(o.id);
      setOpenPropertiesId(o.id);
      setTool("select");
      return;
    }
    if (tool === "median") {
      if (!objectPending) {
        if (!hit || hit.type !== "polygon" || hit.pointIds.length !== 3) {
          setFeedback("תחילה בחרו משולש");
          return;
        }
        setObjectPending(hit.id);
        setFeedback("כעת בחרו את קודקוד התיכון");
        return;
      }
      const poly = objects.find(
        (o): o is PolygonObject =>
          o.type === "polygon" && o.id === objectPending,
      );
      if (!poly || !hitPoint || !poly.pointIds.includes(hitPoint.id)) {
        setFeedback("בחרו קודקוד של המשולש");
        return;
      }
      const other = poly.pointIds.filter((id) => id !== hitPoint.id),
        a = pointById(other[0])!,
        b = pointById(other[1])!,
        m: PointObject = {
          id: uid(),
          type: "point",
          name: nextPointName(objects),
          ...midpoint(a, b),
          dependency: { kind: "midpoint", aId: a.id, bId: b.id },
          color: COLORS[0],
          showName: true,
          showCoords: false,
          guides: false,
        },
        seg: SegmentObject = {
          id: uid(),
          type: "segment",
          name: `תיכון מ־${hitPoint.name}`,
          a: hitPoint,
          b: m,
          aId: hitPoint.id,
          bId: m.id,
          color: COLORS[7],
          showLength: true,
          showSlope: false,
          showLabel: false,
          strokeWidth: 2.5,
          strokeStyle: "dashed",
        };
      pushObjects([...objects, m, seg]);
      setObjectPending(null);
      setSelectedId(seg.id);
      setOpenPropertiesId(seg.id);
      setTool("select");
      return;
    }
    if (tool === "angleBisector") {
      if (!hit || hit.type !== "angle") {
        setFeedback("בחרו אובייקט זווית");
        return;
      }
      const v = pointById(hit.vertexId)!;
      const l: SegmentObject = {
        id: uid(),
        type: "line",
        name: `חוצה ${hit.name}`,
        a: v,
        b: { x: v.x + 1, y: v.y },
        aId: v.id,
        color: COLORS[3],
        showLength: false,
        showSlope: false,
        showLabel: true,
        strokeWidth: 2.5,
        strokeStyle: "dashed",
        construction: { kind: "angleBisector", angleId: hit.id },
      };
      pushObjects([...objects, l]);
      setSelectedId(l.id);
      setOpenPropertiesId(l.id);
      setTool("select");
      return;
    }
    if (tool === "intersection") {
      if (!hit) {
        setFeedback("בחרו אובייקט ראשון");
        return;
      }
      if (!objectPending) {
        setObjectPending(hit.id);
        setFeedback("כעת בחרו אובייקט שני");
        return;
      }
      const first = objects.find((o) => o.id === objectPending);
      if (first && first.id !== hit.id) addIntersections(first, hit);
      else setFeedback("בחרו אובייקט אחר");
      return;
    }
  };
  const onMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const p = pointerPos(e),
      magnet = magneticCandidate(
        p.x,
        p.y,
        p.w,
        p.h,
        dragging?.kind === "point" ? 27 : 22,
      ),
      world = magnet?.point ?? snapWorld(screenToWorld(p.x, p.y, p.w, p.h));
    setMagneticTarget(magnet?.name ?? null);
    setPointer(world);
    if (!dragging) return;
    if (dragging.kind === "pan") {
      setMagneticTarget(null);
      setViewport({
        ...dragging.origin,
        centerX:
          dragging.origin.centerX -
          (e.clientX - dragging.sx) / dragging.origin.scale,
        centerY:
          dragging.origin.centerY +
          (e.clientY - dragging.sy) / dragging.origin.scale,
      });
    } else if (dragging.id)
      setObjects((os) =>
        os.map((o) =>
          o.id === dragging.id && o.type === "point"
            ? o.dependency?.kind === "function"
              ? {
                  ...o,
                  x: world.x,
                  y: world.y,
                  dependency: { ...o.dependency, x: world.x },
                }
              : { ...o, x: world.x, y: world.y }
            : o,
        ),
      );
  };
  const onUp = () => {
    if (dragging?.kind === "point" && dragStartObjectsRef.current) {
      setHistory((h) => [...h.slice(-49), dragStartObjectsRef.current!]);
      setFuture([]);
    }
    dragStartObjectsRef.current = null;
    setDragging(null);
    setMagneticTarget(null);
  };

  const saveEquation = () => {
    const raw = keyboardFieldRef.current?.getValue("ascii-math") || equation;
    let parsed: { normalized: string; evaluate: (x: number) => number };
    try {
      parsed = expressionEvaluator(raw);
    } catch {
      setFeedback(
        "לא הצלחתי לקרוא את הפונקציה. בדקו שהיא מתחילה ב־y= ושכל משתנה קיבל מחוון.",
      );
      return;
    }
    const samples = [-3, -1, 0, 1, 3].map(parsed.evaluate);
    if (samples.every((v) => !Number.isFinite(v))) {
      setFeedback("הפונקציה אינה מחזירה ערכים שניתן להציג");
      return;
    }
    const editing = objects.find(
        (o): o is FunctionObject =>
          o.type === "function" && o.id === editingFunctionId,
      ),
      detectedKind: FunctionKind = valuesAreLinear(parsed.evaluate)
        ? "linear"
        : valuesAreQuadratic(parsed.evaluate)
          ? "quadratic"
          : "general",
      requestedKind = mode === "linear" ? "linear" : detectedKind,
      latex =
        keyboardFieldRef.current?.value || equationLatex || parsed.normalized;
    if (requestedKind === "linear" && !valuesAreLinear(parsed.evaluate)) {
      setFeedback("נבחרה פונקציה קווית, אך הביטוי אינו מהצורה y = mx + b");
      return;
    }
    if (requestedKind === "quadratic" && !valuesAreQuadratic(parsed.evaluate)) {
      setFeedback(
        "נבחרה פונקציה ריבועית, אך הביטוי אינו מתאר פרבולה ממעלה שנייה",
      );
      return;
    }
    if (editing) {
      pushObjects(
        objects.map((o) =>
          o.id === editing.id
            ? {
                ...o,
                expression: parsed.normalized,
                latex,
                functionKind: requestedKind,
              }
            : o,
        ),
      );
      setKeyboardOpen(false);
      setEditingFunctionId(null);
      return;
    }
    const used = new Set(
        objects
          .filter((o): o is FunctionObject => o.type === "function")
          .map((o) => o.name),
      ),
      name =
        ["f", "g", "h", "p", "q", "r"].find((n) => !used.has(n)) ??
        `f${used.size + 1}`,
      o: FunctionObject = {
        id: uid(),
        type: "function",
        name,
        expression: parsed.normalized,
        latex,
        functionKind: requestedKind,
        color: COLORS[2],
        showEquation: true,
        showTable: false,
        strokeWidth: 2.5,
        strokeStyle: "solid",
        minClosed: true,
        maxClosed: true,
      };
    pushObjects([...objects, o]);
    setSelectedId(o.id);
    setOpenPropertiesId(o.id);
    setEquation(parsed.normalized);
    setEquationLatex(latex);
    setFunctionKind(requestedKind);
    setKeyboardOpen(false);
  };
  const addSlider = () => {
    const name = sliderName.trim().toLowerCase();
    if (!/^[a-wz]$/.test(name) || name === "x") {
      setFeedback("שם מחוון צריך להיות אות אנגלית אחת שאינה x");
      return;
    }
    if (objects.some((o) => o.type === "slider" && o.name === name)) {
      setFeedback(`כבר קיים מחוון בשם ${name}`);
      return;
    }
    if (sliderMax <= sliderMin || sliderStep <= 0) {
      setFeedback("טווח המחוון או גודל הצעד אינם תקינים");
      return;
    }
    const o: SliderObject = {
      id: uid(),
      type: "slider",
      name,
      value: Math.max(sliderMin, Math.min(sliderMax, sliderValue)),
      min: sliderMin,
      max: sliderMax,
      step: sliderStep,
      color: COLORS[8],
    };
    pushObjects([...objects, o]);
    setSelectedId(o.id);
    setOpenPropertiesId(o.id);
    setSliderName(
      name === "z" ? "a" : String.fromCharCode(name.charCodeAt(0) + 1),
    );
    setFeedback(`המחוון ${name} נוסף. אפשר להשתמש בו כעת בפונקציה`);
  };
  const updateSelected = (patch: Record<string, unknown>) => {
    if (selected)
      pushObjects(
        objects.map((o) =>
          o.id === selected.id ? ({ ...o, ...patch } as MathObject) : o,
        ),
      );
  };
  const renameSelected = (name: string) => {
    const value = name.trim();
    if (!selected || !value) return;
    if (
      selected.type === "slider" &&
      (!/^[a-wz]$/i.test(value) || value.toLowerCase() === "x")
    ) {
      setFeedback("שם מחוון צריך להיות אות אנגלית אחת שאינה x");
      return;
    }
    if (
      objects.some(
        (o) =>
          o.id !== selected.id && o.name.toLowerCase() === value.toLowerCase(),
      )
    ) {
      setFeedback("כבר קיים אובייקט בשם הזה");
      return;
    }
    const nextName = selected.type === "slider" ? value.toLowerCase() : value;
    const oldSliderName = selected.type === "slider" ? selected.name : null;
    pushObjects(
      objects.map((o) => {
        if (o.id === selected.id)
          return { ...o, name: nextName } as MathObject;
        if (o.type === "function" && oldSliderName) {
          const pattern = new RegExp(`\\b${oldSliderName}\\b`, "g");
          return {
            ...o,
            expression: o.expression.replace(pattern, nextName),
            latex: o.latex.replace(pattern, nextName),
          };
        }
        return o;
      }),
    );
  };
  const removeSelected = () => {
    if (!selected) return;
    if (
      selected.type === "slider" &&
      objects.some(
        (o) =>
          o.type === "function" &&
          new RegExp(`\\b${selected.name}\\b`).test(o.expression),
      )
    ) {
      setFeedback(
        `אי אפשר למחוק את המחוון ${selected.name} כל עוד פונקציה משתמשת בו`,
      );
      return;
    }
    const ids = new Set([selected.id]);
    let changed = true;
    while (changed) {
      changed = false;
      objects.forEach((o) => {
        if (ids.has(o.id)) return;
        const dependsOnDeleted =
          ((o.type === "segment" || o.type === "line") &&
            (Boolean(o.aId && ids.has(o.aId)) ||
              Boolean(o.bId && ids.has(o.bId)) ||
              Boolean(
                o.construction &&
                  (("sourceId" in o.construction &&
                    ids.has(o.construction.sourceId)) ||
                    ("throughId" in o.construction &&
                      ids.has(o.construction.throughId)) ||
                    ("angleId" in o.construction &&
                      ids.has(o.construction.angleId))),
              ))) ||
          (o.type === "point" &&
            Boolean(
              o.dependency &&
                (o.dependency.kind === "midpoint"
                  ? ids.has(o.dependency.aId) || ids.has(o.dependency.bId)
                  : ids.has(o.dependency.functionId)),
            )) ||
          (o.type === "angle" &&
            [o.aId, o.vertexId, o.cId].some((id) => ids.has(id))) ||
          (o.type === "polygon" && o.pointIds.some((id) => ids.has(id))) ||
          (o.type === "circle" &&
            (Boolean(o.centerId && ids.has(o.centerId)) ||
              Boolean(o.throughId && ids.has(o.throughId)) ||
              Boolean(o.threePointIds?.some((id) => ids.has(id)))));
        if (dependsOnDeleted) {
          ids.add(o.id);
          changed = true;
        }
      });
    }
    pushObjects(objects.filter((o) => !ids.has(o.id)));
    setSelectedId(null);
    setOpenPropertiesId(null);
  };
  const copyWithTransform = (transform: (p: Point) => Point, label: string) => {
    if (
      !selected ||
      selected.type === "function" ||
      selected.type === "angle" ||
      selected.type === "slider"
    ) {
      setFeedback("בחרו נקודה, קטע, ישר, מצולע או מעגל לטרנספורמציה");
      return;
    }
    let points: PointObject[] = [],
      copy: MathObject;
    const clonePoint = (p: PointObject) => {
      const q = transform(pointById(p.id) ?? p),
        n: PointObject = {
          ...p,
          id: uid(),
          name: nextPointName([...objects, ...points]),
          x: q.x,
          y: q.y,
          dependency: undefined,
        };
      points.push(n);
      return n;
    };
    const cloneCoordinates = (p: Point, color: string) =>
      clonePoint({
        id: "",
        type: "point",
        name: "",
        x: p.x,
        y: p.y,
        color,
        showName: true,
        showCoords: false,
        guides: false,
      });
    if (selected.type === "point") {
      copy = clonePoint(selected);
      points = [];
    } else if (selected.type === "segment" || selected.type === "line") {
      const ep = segmentPoints(selected),
        a = cloneCoordinates(ep.a, selected.color),
        b = cloneCoordinates(ep.b, selected.color);
      copy = {
        ...selected,
        id: uid(),
        name: `${a.name}${b.name}`,
        a,
        b,
        aId: a.id,
        bId: b.id,
        construction: undefined,
      };
    } else if (selected.type === "polygon") {
      const pts = polygonPoints(selected).map(clonePoint);
      copy = {
        ...selected,
        id: uid(),
        name: `${selected.name}׳`,
        pointIds: pts.map((p) => p.id),
      };
    } else if (selected.type === "circle") {
      const data = circleData(selected),
        center = cloneCoordinates(data.center, selected.color);
      copy = {
        ...selected,
        id: uid(),
        name: `${selected.name}׳`,
        center,
        centerId: center.id,
        throughId: undefined,
        through: undefined,
        threePointIds: undefined,
        radius: data.r,
      };
    } else return;
    pushObjects([...objects, ...points, copy]);
    setSelectedId(copy.id);
    setOpenPropertiesId(copy.id);
    setFeedback(`${label} נוצר בהצלחה`);
  };
  const exportPng = () => {
    draw();
    requestAnimationFrame(() => {
      const link = document.createElement("a");
      link.download = "המרחב-המתמטי.png";
      link.href = canvasRef.current!.toDataURL("image/png");
      link.click();
    });
  };
  const undo = () => {
      const prev = history.at(-1);
      if (prev) {
        setFuture((f) => [objects, ...f]);
        setObjects(prev);
        setHistory((h) => h.slice(0, -1));
      }
    },
    redo = () => {
      const next = future[0];
      if (next) {
        setHistory((h) => [...h, objects]);
        setObjects(next);
        setFuture((f) => f.slice(1));
      }
    },
    fit = () =>
      setViewport({
        centerX: 0,
        centerY: 0,
        scale: scaleForGridStep(gridStep),
      });
  const resetWorkspace = () => {
    if (
      objects.length &&
      !window.confirm("למחוק את כל האובייקטים ולהתחיל מרחב חדש?")
    )
      return;
    setObjects([]);
    setHistory([]);
    setFuture([]);
    setSelectedId(null);
    setOpenPropertiesId(null);
    resetPending();
    setMode("coordinates");
    setSections(MODE_DEFAULT_SECTIONS.coordinates);
    setTool("select");
    setViewport({ centerX: 0, centerY: 0, scale: scaleForGridStep(1) });
    setGridStep(1);
    setGridStepInput("1");
  };
  const applyGridStep = (raw: string) => {
    const v = Number(raw);
    if (Number.isFinite(v) && v > 0) {
      setGridStep(v);
      setGridStepInput(String(v));
      setViewport((x) => ({ ...x, scale: scaleForGridStep(v) }));
    } else setGridStepInput(String(gridStep));
  };
  const shapeTools = MODE_SHAPE_TOOLS[mode],
    constructionTools = MODE_CONSTRUCTION_TOOLS[mode],
    modeAllowsFunctions = ["linear", "graphs", "advanced"].includes(mode),
    modeAllowsSliders = ["linear", "graphs", "advanced"].includes(mode),
    modeAllowsTransform = [
      "measurement",
      "linear",
      "graphs",
      "advanced",
    ].includes(mode);
  const hint = magneticTarget
    ? `מגנט: הצמדה אל ${magneticTarget}`
    : tool === "polygon"
      ? polygonPending.length
        ? `נבחרו ${polygonPending.length} קודקודים`
        : `בחרו קודקודים לפי הסדר`
      : tool === "angle"
        ? "בחרו שלוש נקודות; השנייה היא קודקוד הזווית"
        : objectPending
          ? "השלימו את הבחירה השנייה"
          : pending
            ? "בחרו נקודה שנייה"
            : tool === "select"
              ? "בחרו אובייקט או גררו נקודה"
              : "פעלו במישור לפי הכלי שנבחר";

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <img src="./logo-prisming.png" alt="Prismind" />
        </div>
        <div className="workspace-title">
          <span>{MODES[mode].label}</span>
        </div>
        <div className="top-actions">
          <button className="new-workspace" onClick={resetWorkspace}>
            ＋ חדש
          </button>
          <button
            className="history-action"
            onClick={undo}
            disabled={!history.length}
            title="ביטול פעולה"
            aria-label="ביטול פעולה"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M9 7H5v-4" />
              <path d="M5 7c2.1-2.2 4.6-3.3 7.5-3.1 4.3.3 7.6 3.9 7.5 8.2-.1 4.4-3.7 7.9-8.1 7.9-3.2 0-6-1.9-7.3-4.6" />
            </svg>
          </button>
          <button
            className="history-action"
            onClick={redo}
            disabled={!future.length}
            title="ביצוע מחדש"
            aria-label="ביצוע מחדש"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M15 7h4v-4" />
              <path d="M19 7c-2.1-2.2-4.6-3.3-7.5-3.1C7.2 4.2 3.9 7.8 4 12.1c.1 4.4 3.7 7.9 8.1 7.9 3.2 0 6-1.9 7.3-4.6" />
            </svg>
          </button>
          <button className="view-reset" onClick={fit}>איפוס תצוגה</button>
          <button className="export-action" onClick={exportPng}>⇩ ייצוא PNG</button>
        </div>
        <button
          className="mobile-panel"
          onClick={() => setRightOpen((v) => !v)}
        >
          ☰ כלים
        </button>
      </header>
      {feedback && (
        <div
          className={`feedback ${feedback.includes("בהצלחה") || feedback.includes("נוסף") ? "success" : ""}`}
        >
          <span>{feedback}</span>
          <button onClick={() => setFeedback(null)}>×</button>
        </div>
      )}
      <section className="workspace">
        <aside className={`side-panel tools-panel ${rightOpen ? "open" : ""}`}>
          <div className="mobile-panel-head">
            <button
              className="mobile-close"
              onClick={() => setRightOpen(false)}
            >
              ×
            </button>
          </div>
          <ToolSection
            title="כלים כלליים"
            open={sections.general}
            onToggle={() => toggleSection("general")}
          >
            <div className="tool-grid single-tool">
              <button
                className={tool === "select" ? "active" : ""}
                onClick={() => chooseTool("select")}
              >
                <span>{TOOL_META.select.icon}</span>
                {TOOL_META.select.label}
              </button>
            </div>
          </ToolSection>
          <label className="field-label" htmlFor="workspace-mode">
            סביבת עבודה
          </label>
          <select
            id="workspace-mode"
            value={mode}
            onChange={(e) => {
              const nextMode = e.target.value as Mode;
              setMode(nextMode);
              setSections(MODE_DEFAULT_SECTIONS[nextMode]);
              if (nextMode === "linear") {
                setFunctionKind("linear");
                setEquation(FUNCTION_COPY.linear.example);
                setEquationLatex(FUNCTION_COPY.linear.example);
              }
              chooseTool("select");
            }}
          >
            {Object.entries(MODES).map(([key, m]) => (
              <option key={key} value={key}>
                {m.label}
              </option>
            ))}
          </select>
          <p className="mode-description">
            {MODES[mode].description}
            <small>{MODES[mode].grade}</small>
          </p>
          <ToolSection
            title="תצוגת המישור"
            open={sections.view}
            onToggle={() => toggleSection("view")}
          >
            <div className="grid-step-control">
              <div className="step-row">
                <span>גודל שנתה</span>
                <input
                  type="number"
                  min="0.0001"
                  step="any"
                  value={gridStepInput}
                  onChange={(e) => setGridStepInput(e.target.value)}
                  onBlur={(e) => applyGridStep(e.target.value)}
                />
              </div>
            </div>
            <label className="toggle">
              <input
                type="checkbox"
                checked={snap}
                onChange={(e) => setSnap(e.target.checked)}
              />
              <span />
              הצמדה לרשת
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={showGrid}
                onChange={(e) => setShowGrid(e.target.checked)}
              />
              <span />
              הצגת רשת
            </label>
            <label className="toggle">
              <input
                type="checkbox"
                checked={showNumbers}
                onChange={(e) => setShowNumbers(e.target.checked)}
              />
              <span />
              הצגת מספרים
            </label>
          </ToolSection>
          {shapeTools.length > 0 && (
            <>
              <ToolSection
                title={
                  mode === "coordinates"
                    ? "נקודות"
                    : mode === "linear" || mode === "graphs"
                      ? "כלים בסיסיים"
                      : mode === "advanced"
                        ? "כלי גאומטריה"
                        : "קטעים וצורות"
                }
                open={sections.shapes}
                onToggle={() => toggleSection("shapes")}
              >
                <div className="tool-grid">
                  {shapeTools.map((t) => (
                    <button
                      key={t}
                      className={tool === t ? "active" : ""}
                      onClick={() => chooseTool(t)}
                    >
                      <span>{TOOL_META[t].icon}</span>
                      {TOOL_META[t].label}
                    </button>
                  ))}
                </div>
                {tool === "polygon" && polygonPending.length >= 3 && (
                  <button className="finish-shape" onClick={finishPolygon}>
                    סיום וסגירת המצולע
                  </button>
                )}
              </ToolSection>
              {constructionTools.length > 0 && (
                <ToolSection
                  title={mode === "linear" ? "ישרים ובניות" : "מדידה ובניות"}
                  open={sections.constructions}
                  onToggle={() => toggleSection("constructions")}
                >
                  <div className="tool-grid">
                    {constructionTools.map((t) => (
                      <button
                        key={t}
                        className={tool === t ? "active" : ""}
                        onClick={() => chooseTool(t)}
                      >
                        <span>{TOOL_META[t].icon}</span>
                        {TOOL_META[t].label}
                      </button>
                    ))}
                  </div>
                </ToolSection>
              )}
            </>
          )}
          {modeAllowsFunctions && (
            <>
              <ToolSection
                title="גרפים ופונקציות"
                open={sections.functions}
                onToggle={() => toggleSection("functions")}
              >
                {mode === "linear" ? (
                  <p className="fixed-function-kind">פונקציה קווית · y=mx+b</p>
                ) : null}
                <button
                  className="open-keyboard"
                  onClick={() => {
                    setEditingFunctionId(null);
                    setKeyboardOpen(true);
                  }}
                >
                  <span className="equation-preview">
                    <MathDisplay latex={equationLatex} />
                  </span>
                  <b>⌨ הוספת פונקציה</b>
                </button>
                <p className="equation-help">
                  {mode === "linear"
                    ? FUNCTION_COPY.linear.hint
                    : "כתבו את הפונקציה הרצויה — סוג הגרף יזוהה אוטומטית"}
                </p>
              </ToolSection>
              {modeAllowsSliders && (
                <ToolSection
                  title="מחוונים דינמיים"
                  open={sections.sliders}
                  onToggle={() => toggleSection("sliders")}
                >
                <div className="slider-create">
                  <div>
                    <label>
                      משתנה
                      <input
                        value={sliderName}
                        maxLength={1}
                        onChange={(e) => setSliderName(e.target.value)}
                      />
                    </label>
                    <label>
                      ערך
                      <input
                        type="number"
                        value={sliderValue}
                        onChange={(e) => setSliderValue(Number(e.target.value))}
                      />
                    </label>
                  </div>
                  <div>
                    <label>
                      מינ׳
                      <input
                        type="number"
                        value={sliderMin}
                        onChange={(e) => setSliderMin(Number(e.target.value))}
                      />
                    </label>
                    <label>
                      מקס׳
                      <input
                        type="number"
                        value={sliderMax}
                        onChange={(e) => setSliderMax(Number(e.target.value))}
                      />
                    </label>
                    <label>
                      צעד
                      <input
                        type="number"
                        min="0.0001"
                        value={sliderStep}
                        onChange={(e) => setSliderStep(Number(e.target.value))}
                      />
                    </label>
                  </div>
                  <button onClick={addSlider}>＋ הוספת מחוון</button>
                </div>
                {sliders.map((s) => (
                  <div className="live-slider" key={s.id}>
                    <div>
                      <b>
                        {s.name} = {round(s.value, 4)}
                      </b>
                      <button
                        onClick={() => {
                          setSelectedId(s.id);
                          setOpenPropertiesId(s.id);
                        }}
                      >
                        ⋯
                      </button>
                    </div>
                    <input
                      type="range"
                      min={s.min}
                      max={s.max}
                      step={s.step}
                      value={s.value}
                      onChange={(e) =>
                        setObjects((os) =>
                          os.map((o) =>
                            o.id === s.id
                              ? { ...s, value: Number(e.target.value) }
                              : o,
                          ),
                        )
                      }
                    />
                    <small>
                      {s.min}
                      <span>{s.max}</span>
                    </small>
                  </div>
                ))}
                </ToolSection>
              )}
            </>
          )}
          {modeAllowsTransform && (
            <ToolSection
              title="טרנספורמציות"
              open={sections.transform}
              onToggle={() => toggleSection("transform")}
            >
              <p className="section-help">
                בחרו אובייקט, ואז צרו עותק שעבר טרנספורמציה.
              </p>
              <div className="transform-row">
                <label>
                  Δx
                  <input
                    type="number"
                    value={moveX}
                    onChange={(e) => setMoveX(Number(e.target.value))}
                  />
                </label>
                <label>
                  Δy
                  <input
                    type="number"
                    value={moveY}
                    onChange={(e) => setMoveY(Number(e.target.value))}
                  />
                </label>
                <button
                  onClick={() =>
                    copyWithTransform(
                      (p) => ({ x: p.x + moveX, y: p.y + moveY }),
                      "עותק מוזז",
                    )
                  }
                >
                  הזזה
                </button>
              </div>
              <div className="transform-row">
                <label>
                  זווית
                  <input
                    type="number"
                    value={rotation}
                    onChange={(e) => setRotation(Number(e.target.value))}
                  />
                </label>
                <button
                  onClick={() => {
                    const a = (rotation * Math.PI) / 180;
                    copyWithTransform(
                      (p) => ({
                        x: p.x * Math.cos(a) - p.y * Math.sin(a),
                        y: p.x * Math.sin(a) + p.y * Math.cos(a),
                      }),
                      "עותק מסובב",
                    );
                  }}
                >
                  סיבוב סביב הראשית
                </button>
              </div>
              <div className="reflection-buttons">
                <button
                  onClick={() =>
                    copyWithTransform(
                      (p) => ({ x: p.x, y: -p.y }),
                      "שיקוף בציר x",
                    )
                  }
                >
                  שיקוף בציר x
                </button>
                <button
                  onClick={() =>
                    copyWithTransform(
                      (p) => ({ x: -p.x, y: p.y }),
                      "שיקוף בציר y",
                    )
                  }
                >
                  שיקוף בציר y
                </button>
                <button
                  onClick={() =>
                    copyWithTransform(
                      (p) => ({ x: p.y, y: p.x }),
                      "שיקוף ב־y=x",
                    )
                  }
                >
                  שיקוף ב־y=x
                </button>
              </div>
            </ToolSection>
          )}
        </aside>
        <div className="canvas-area" ref={wrapRef}>
          <canvas
            ref={canvasRef}
            onPointerDown={onDown}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            onWheel={(e) => {
              e.preventDefault();
              setViewport((v) => ({
                ...v,
                scale: clampScale(
                  v.scale * (e.deltaY < 0 ? 1.12 : 0.89),
                  gridStep,
                ),
              }));
            }}
          />
          <div className="canvas-hint">{hint}</div>
          <div className="zoom">
            <button
              onClick={() =>
                setViewport((v) => ({
                  ...v,
                  scale: clampScale(v.scale * 1.2, gridStep),
                }))
              }
            >
              +
            </button>
            <span>
              {Math.round((viewport.scale / scaleForGridStep(gridStep)) * 100)}%
            </span>
            <button
              onClick={() =>
                setViewport((v) => ({
                  ...v,
                  scale: clampScale(v.scale / 1.2, gridStep),
                }))
              }
            >
              −
            </button>
          </div>
          <button
            className="mobile-objects"
            onClick={() => setLeftOpen((v) => !v)}
          >
            אובייקטים {objects.length}
          </button>
        </div>
        <aside className={`side-panel objects-panel ${leftOpen ? "open" : ""}`}>
          <div className="panel-title">
            <div>
              <strong>אובייקטים</strong>
              <span>
                {objects.length
                  ? `${objects.length} פריטים במישור`
                  : "עדיין לא נוצרו פריטים"}
              </span>
            </div>
            <button className="mobile-close" onClick={() => setLeftOpen(false)}>
              ×
            </button>
          </div>
          <div className="object-list">
            {objects.map((o) => (
              <Fragment key={o.id}>
                <div
                  className={`object-card ${selectedId === o.id ? "selected" : ""} ${o.hidden ? "hidden-object" : ""}`}
                >
                  <button
                    className="object-main"
                    onClick={() => {
                      setSelectedId(o.id);
                      setTool("select");
                    }}
                  >
                    <i style={{ background: o.color }} />
                    <span>
                      {o.type === "function" ? (
                        <>
                          <b>{o.name}: </b>
                          <MathDisplay latex={o.latex} />
                        </>
                      ) : o.type === "slider" ? (
                        `${o.name} = ${round(o.value, 4)}`
                      ) : (
                        o.name
                      )}
                    </span>
                  </button>
                  <button
                    className="object-toggle"
                    onClick={() => {
                      setSelectedId(o.id);
                      setOpenPropertiesId((v) => (v === o.id ? null : o.id));
                    }}
                  >
                    {openPropertiesId === o.id ? "⌄" : "›"}
                  </button>
                </div>
                {selectedId === o.id &&
                  openPropertiesId === o.id &&
                  selected && (
                    <div className="properties">
                      <div className="properties-title">
                        <strong>מאפייני האובייקט</strong>
                      </div>
                      <label className="name-field">
                        שם האובייקט
                        <input
                          defaultValue={selected.name}
                          key={`${selected.id}-${selected.name}`}
                          onBlur={(e) => renameSelected(e.target.value)}
                        />
                      </label>
                      <label className="toggle">
                        <input
                          type="checkbox"
                          checked={!selected.hidden}
                          onChange={(e) =>
                            updateSelected({ hidden: !e.target.checked })
                          }
                        />
                        <span />
                        הצגת האובייקט במישור
                      </label>
                      {selected.type === "point" && (
                        <>
                          <div className="xy-row">
                            <label>
                              X
                              <input
                                type="number"
                                value={(pointById(selected.id) ?? selected).x}
                                disabled={Boolean(selected.dependency)}
                                onChange={(e) =>
                                  updateSelected({ x: Number(e.target.value) })
                                }
                              />
                            </label>
                            <label>
                              Y
                              <input
                                type="number"
                                value={(pointById(selected.id) ?? selected).y}
                                disabled={Boolean(selected.dependency)}
                                onChange={(e) =>
                                  updateSelected({ y: Number(e.target.value) })
                                }
                              />
                            </label>
                          </div>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={selected.showName}
                              onChange={(e) =>
                                updateSelected({ showName: e.target.checked })
                              }
                            />
                            <span />
                            הצגת שם
                          </label>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={selected.showCoords}
                              onChange={(e) =>
                                updateSelected({ showCoords: e.target.checked })
                              }
                            />
                            <span />
                            הצגת שיעורים
                          </label>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={selected.guides}
                              onChange={(e) =>
                                updateSelected({ guides: e.target.checked })
                              }
                            />
                            <span />
                            קווי עזר לצירים
                          </label>
                        </>
                      )}
                      {(selected.type === "segment" ||
                        selected.type === "line") && (
                        <>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={selected.showSlope}
                              onChange={(e) =>
                                updateSelected({ showSlope: e.target.checked })
                              }
                            />
                            <span />
                            הצגת שיפוע
                          </label>
                          {selected.type === "segment" && (
                            <label className="toggle">
                              <input
                                type="checkbox"
                                checked={selected.showLength}
                                onChange={(e) =>
                                  updateSelected({
                                    showLength: e.target.checked,
                                  })
                                }
                              />
                              <span />
                              הצגת אורך
                            </label>
                          )}
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={selected.showLabel}
                              onChange={(e) =>
                                updateSelected({ showLabel: e.target.checked })
                              }
                            />
                            <span />
                            הצגת תווית
                          </label>
                        </>
                      )}
                      {selected.type === "angle" && (
                        <label className="toggle">
                          <input
                            type="checkbox"
                            checked={selected.showMeasure}
                            onChange={(e) =>
                              updateSelected({ showMeasure: e.target.checked })
                            }
                          />
                          <span />
                          הצגת גודל
                        </label>
                      )}
                      {selected.type === "polygon" && (
                        <>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={selected.fill}
                              onChange={(e) =>
                                updateSelected({ fill: e.target.checked })
                              }
                            />
                            <span />
                            מילוי שקוף
                          </label>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={selected.showLengths}
                              onChange={(e) =>
                                updateSelected({
                                  showLengths: e.target.checked,
                                })
                              }
                            />
                            <span />
                            אורכי צלעות
                          </label>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={selected.showAngles}
                              onChange={(e) =>
                                updateSelected({ showAngles: e.target.checked })
                              }
                            />
                            <span />
                            גודל זוויות
                          </label>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={selected.showPerimeter}
                              onChange={(e) =>
                                updateSelected({
                                  showPerimeter: e.target.checked,
                                })
                              }
                            />
                            <span />
                            היקף
                          </label>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={selected.showArea}
                              onChange={(e) =>
                                updateSelected({ showArea: e.target.checked })
                              }
                            />
                            <span />
                            שטח
                          </label>
                        </>
                      )}
                      {selected.type === "circle" && (
                        <>
                          <label className="radius-field">
                            רדיוס
                            <input
                              type="number"
                              min="0.0001"
                              disabled={Boolean(
                                selected.throughId || selected.threePointIds,
                              )}
                              value={round(circleData(selected).r, 5)}
                              onChange={(e) =>
                                updateSelected({
                                  radius: Math.max(
                                    0.0001,
                                    Number(e.target.value),
                                  ),
                                })
                              }
                            />
                          </label>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={selected.fill}
                              onChange={(e) =>
                                updateSelected({ fill: e.target.checked })
                              }
                            />
                            <span />
                            מילוי שקוף
                          </label>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={selected.showCenter}
                              onChange={(e) =>
                                updateSelected({ showCenter: e.target.checked })
                              }
                            />
                            <span />
                            מרכז
                          </label>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={selected.showRadius}
                              onChange={(e) =>
                                updateSelected({ showRadius: e.target.checked })
                              }
                            />
                            <span />
                            רדיוס
                          </label>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={selected.showDiameter}
                              onChange={(e) =>
                                updateSelected({
                                  showDiameter: e.target.checked,
                                })
                              }
                            />
                            <span />
                            קוטר
                          </label>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={selected.showCircumference}
                              onChange={(e) =>
                                updateSelected({
                                  showCircumference: e.target.checked,
                                })
                              }
                            />
                            <span />
                            היקף
                          </label>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={selected.showArea}
                              onChange={(e) =>
                                updateSelected({ showArea: e.target.checked })
                              }
                            />
                            <span />
                            שטח
                          </label>
                        </>
                      )}
                      {selected.type === "function" && (
                        <>
                          <div className="property-equation">
                            <MathDisplay latex={selected.latex} />
                          </div>
                          <button
                            className="edit-function"
                            onClick={() => {
                              setEditingFunctionId(selected.id);
                              setEquation(selected.expression);
                              setEquationLatex(selected.latex);
                              setKeyboardOpen(true);
                            }}
                          >
                            ✎ עריכת הפונקציה
                          </button>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={selected.showEquation}
                              onChange={(e) =>
                                updateSelected({
                                  showEquation: e.target.checked,
                                })
                              }
                            />
                            <span />
                            הצגת תווית
                          </label>
                          <label className="toggle">
                            <input
                              type="checkbox"
                              checked={selected.showTable}
                              onChange={(e) =>
                                updateSelected({ showTable: e.target.checked })
                              }
                            />
                            <span />
                            הצגת טבלת ערכים
                          </label>
                          {selected.showTable && (
                            <table className="value-table">
                              <thead>
                                <tr>
                                  <th>x</th>
                                  <th>y</th>
                                </tr>
                              </thead>
                              <tbody>
                                {[-2, -1, 0, 1, 2].map((x) => {
                                  let y = NaN;
                                  try {
                                    y = expressionEvaluator(
                                      selected.expression,
                                    ).evaluate(x);
                                  } catch {}
                                  return (
                                    <tr key={x}>
                                      <td>{x}</td>
                                      <td>
                                        {Number.isFinite(y)
                                          ? round(y, 3)
                                          : "לא מוגדר"}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          )}
                          <div className="domain-fields">
                            <strong>הגבלת תחום (אופציונלי)</strong>
                            <div>
                              <label>
                                מ־x
                                <input
                                  type="number"
                                  value={selected.domainMin ?? ""}
                                  onChange={(e) =>
                                    updateSelected({
                                      domainMin:
                                        e.target.value === ""
                                          ? undefined
                                          : Number(e.target.value),
                                    })
                                  }
                                />
                              </label>
                              <label>
                                עד x
                                <input
                                  type="number"
                                  value={selected.domainMax ?? ""}
                                  onChange={(e) =>
                                    updateSelected({
                                      domainMax:
                                        e.target.value === ""
                                          ? undefined
                                          : Number(e.target.value),
                                    })
                                  }
                                />
                              </label>
                            </div>
                            <label className="toggle">
                              <input
                                type="checkbox"
                                checked={selected.minClosed}
                                onChange={(e) =>
                                  updateSelected({
                                    minClosed: e.target.checked,
                                  })
                                }
                              />
                              <span />
                              קצה שמאלי סגור
                            </label>
                            <label className="toggle">
                              <input
                                type="checkbox"
                                checked={selected.maxClosed}
                                onChange={(e) =>
                                  updateSelected({
                                    maxClosed: e.target.checked,
                                  })
                                }
                              />
                              <span />
                              קצה ימני סגור
                            </label>
                          </div>
                        </>
                      )}
                      {selected.type === "slider" && (
                        <div className="slider-properties">
                          <label>
                            מינימום
                            <input
                              type="number"
                              value={selected.min}
                              onChange={(e) =>
                                updateSelected({ min: Number(e.target.value) })
                              }
                            />
                          </label>
                          <label>
                            מקסימום
                            <input
                              type="number"
                              value={selected.max}
                              onChange={(e) =>
                                updateSelected({ max: Number(e.target.value) })
                              }
                            />
                          </label>
                          <label>
                            צעד
                            <input
                              type="number"
                              value={selected.step}
                              onChange={(e) =>
                                updateSelected({ step: Number(e.target.value) })
                              }
                            />
                          </label>
                        </div>
                      )}
                      {selected.type !== "point" &&
                        selected.type !== "slider" && (
                          <div className="line-appearance">
                            <label>
                              עובי
                              <select
                                value={selected.strokeWidth}
                                onChange={(e) =>
                                  updateSelected({
                                    strokeWidth: Number(e.target.value),
                                  })
                                }
                              >
                                {[1, 1.5, 2, 2.5, 3, 4, 5, 6].map((v) => (
                                  <option key={v}>{v}</option>
                                ))}
                              </select>
                            </label>
                            <label>
                              סגנון
                              <select
                                value={selected.strokeStyle}
                                onChange={(e) =>
                                  updateSelected({
                                    strokeStyle: e.target.value as StrokeStyle,
                                  })
                                }
                              >
                                {STROKE_STYLES.map((v) => (
                                  <option key={v.value} value={v.value}>
                                    {v.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        )}
                      <div className="colors">
                        {COLORS.map((c) => (
                          <button
                            key={c}
                            aria-label={`צבע ${c}`}
                            style={{ background: c }}
                            className={selected.color === c ? "chosen" : ""}
                            onClick={() => updateSelected({ color: c })}
                          />
                        ))}
                      </div>
                      <button className="delete" onClick={removeSelected}>
                        מחיקת האובייקט
                      </button>
                    </div>
                  )}
              </Fragment>
            ))}
            {!objects.length && (
              <div className="empty">
                <span>＋</span>
                <p>
                  התחילו בהצבת נקודה,
                  <br />
                  בבניית צורה או בהוספת פונקציה
                </p>
              </div>
            )}
          </div>
        </aside>
      </section>
      <div
        className={`keyboard-backdrop ${keyboardOpen ? "open" : ""}`}
        onMouseDown={(e) => {
          if (e.target === e.currentTarget) {
            setKeyboardOpen(false);
            setEditingFunctionId(null);
          }
        }}
      >
        <section className="keyboard-dialog" role="dialog" aria-modal="true">
          <header>
            <div>
              <strong>
                {editingFunctionId
                  ? "עריכת הפונקציה"
                  : mode === "linear"
                    ? "הוספת פונקציה קווית"
                    : "הוספת פונקציה"}
              </strong>
              <span>
                {editingFunctionId
                  ? "שנו את המשוואה ושמרו"
                  : mode === "linear"
                    ? FUNCTION_COPY.linear.hint
                    : "כתבו פונקציה והמערכת תזהה אוטומטית את סוג הגרף"}
              </span>
            </div>
            <button
              onClick={() => {
                setKeyboardOpen(false);
                setEditingFunctionId(null);
              }}
            >
              ×
            </button>
          </header>
          <div className="math-keyboard-host" ref={keyboardHostRef}>
            <div className="keyboard-loading">המקלדת המתמטית נטענת…</div>
          </div>
          <div className="keyboard-actions">
            <button
              className="secondary"
              onClick={() => setKeyboardOpen(false)}
            >
              ביטול
            </button>
            <button className="primary" onClick={saveEquation}>
              {editingFunctionId ? "שמירת השינויים" : "הוספה למישור"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
