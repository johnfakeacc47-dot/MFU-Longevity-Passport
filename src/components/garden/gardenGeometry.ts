// Pure path-geometry helpers for the Longevity Garden's Lamduan tree.
// These just compute SVG path data — GardenPlant.tsx composes them into JSX.
// Kept separate (and framework-free) so the math is easy to read on its own.

function normalize(dx: number, dy: number): [number, number] {
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  return [dx / len, dy / len];
}

/**
 * A tapered, filled ribbon from (x1,y1) to (x2,y2) via control point
 * (mx,my) — width w1 at the start, w2 at the tip. This is what makes a
 * branch or trunk read as a real silhouette instead of a uniform stroke.
 */
export function taperedRibbon(
  x1: number, y1: number,
  mx: number, my: number,
  x2: number, y2: number,
  w1: number, w2: number,
): string {
  const [t0x, t0y] = normalize(mx - x1, my - y1);
  const [t1x, t1y] = normalize(x2 - mx, y2 - my);
  const p0: [number, number] = [-t0y * w1 / 2, t0x * w1 / 2];
  const p1: [number, number] = [-t1y * w2 / 2, t1x * w2 / 2];
  const cx1 = (mx + (p0[0] + p1[0]) / 2).toFixed(1);
  const cy1 = (my + (p0[1] + p1[1]) / 2).toFixed(1);
  const cx2 = (mx - (p0[0] + p1[0]) / 2).toFixed(1);
  const cy2 = (my - (p0[1] + p1[1]) / 2).toFixed(1);
  return (
    `M${(x1 + p0[0]).toFixed(1)},${(y1 + p0[1]).toFixed(1)} ` +
    `Q${cx1},${cy1} ${(x2 + p1[0]).toFixed(1)},${(y2 + p1[1]).toFixed(1)} ` +
    `L${(x2 - p1[0]).toFixed(1)},${(y2 - p1[1]).toFixed(1)} ` +
    `Q${cx2},${cy2} ${(x1 - p0[0]).toFixed(1)},${(y1 - p0[1]).toFixed(1)} Z`
  );
}

/**
 * A single pointed blade (leaf or Lamduan petal), tip pointing up (-y) from
 * the origin. `taper` controls how quickly it narrows near the tip — lower
 * for a slender leaf, higher (closer to 1) for a plump waxy petal.
 */
export function bladeShape(len: number, wid: number, taper = 0.55): string {
  const l = len.toFixed(1);
  const w = wid.toFixed(1);
  const w2 = (wid * taper).toFixed(1);
  const l2 = (len * 0.82).toFixed(1);
  const l3 = (len * 0.32).toFixed(1);
  return `M0,0 C -${w},-${l3} -${w2},-${l2} 0,-${l} C ${w2},-${l2} ${w},-${l3} 0,0 Z`;
}
