// Pure geometry for the athletic-profile hexagon radar (AthleticRadarCard).
// Axes start straight up (-90°) and step clockwise; values are skill LEVELS.

/** Fixed 10-level baseline so growth is visible; expands only past Lv10 to avoid clipping. */
export function radarMax(values: number[]): number {
  return Math.max(10, ...values.map((v) => Math.ceil(v)))
}

/** Vertex on axis `i`: angle starts straight up (-90°) and steps clockwise. */
export function polarPoint(cx: number, cy: number, radius: number, axisIndex: number, axisCount: number) {
  const angle = (-90 + (360 / axisCount) * axisIndex) * (Math.PI / 180)
  return { x: cx + radius * Math.cos(angle), y: cy + radius * Math.sin(angle) }
}

const pointsStr = (pts: { x: number; y: number }[]) =>
  pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')

/** SVG `points` for a full grid ring at `radius`. */
export function polygonPoints(cx: number, cy: number, radius: number, axisCount: number): string {
  return pointsStr(Array.from({ length: axisCount }, (_, i) => polarPoint(cx, cy, radius, i, axisCount)))
}

/** SVG `points` for the data polygon; each axis value scaled to R*min(v,max)/max. */
export function dataPolygonPoints(cx: number, cy: number, R: number, values: number[], max: number): string {
  return pointsStr(values.map((v, i) => polarPoint(cx, cy, (R * Math.min(v, max)) / max, i, values.length)))
}
