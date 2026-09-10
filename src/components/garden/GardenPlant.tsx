// GardenPlant — the Longevity Garden's Lamduan tree.
//
// Two independent inputs drive how it looks:
//   - `stage` (0 seed … 4 mature tree) — from profiles.total_points, all-time,
//     never goes down. See src/utils/growthStage.ts.
//   - `breakdown` — today's 4 pillars (0–25 each), same shape as
//     LongevityBreakdown. Drives soil richness, branch/leaf fullness, bloom,
//     and glow *within* whatever stage the tree has grown to. A rough day
//     just leaves it dim/un-flowered until the next log — it never shrinks
//     the tree itself.
//
// A Lamduan doesn't flower until it's a young tree or older, so `sleep`
// has no visual outlet before stage 3 — same as the real thing.
import React, { useId } from 'react';
import { taperedRibbon, bladeShape } from './gardenGeometry';
import { pillarTier, type GrowthStage } from '../../utils/growthStage';
import '../../styles/Garden.css';

export interface GardenBreakdown {
  nutrition: number;
  exercise: number;
  sleep: number;
  mental: number;
}

interface GardenPlantProps {
  breakdown: GardenBreakdown;
  stage: GrowthStage;
  /** Rendered width in px; height follows the tree's 200:260 aspect ratio. */
  size?: number;
  className?: string;
  title?: string;
}

type Tier = 0 | 1 | 2 | 3;

// ── small reusable pieces ────────────────────────────────────────────────

const LEAF_FANS: ReadonlyArray<ReadonlyArray<readonly [number, number, number]>> = [
  [[-38, 15, 6.4], [-4, 17.5, 6.8], [30, 14.5, 5.8], [-68, 10.5, 4.8]],
  [[-52, 13, 5.8], [-12, 16.5, 6.4], [24, 15.5, 6], [58, 11.5, 5]],
  [[-26, 16, 6.4], [12, 14.5, 5.8], [46, 12, 5], [-58, 10, 4.6]],
];

const LeafCluster: React.FC<{ cx: number; cy: number; r: number; fill: string; fanIdx: number }> = ({ cx, cy, r, fill, fanIdx }) => {
  const fan = LEAF_FANS[fanIdx % LEAF_FANS.length];
  const scale = r / 15;
  return (
    <>
      {fan.map(([angle, len, wid], i) => {
        const l = len * scale, w = wid * scale;
        return (
          <g key={i} transform={`translate(${cx},${cy}) rotate(${angle})`}>
            <path d={bladeShape(l, w)} fill={fill} />
            <line x1={0} y1={0} x2={0} y2={-l} stroke="rgba(0,0,0,.2)" strokeWidth={0.5} />
          </g>
        );
      })}
    </>
  );
};

const TrunkShape: React.FC<{ topY: number; wBase: number; wTop: number; fill: string; bend?: number }> = ({ topY, wBase, wTop, fill, bend = 0 }) => {
  const mx = 100 + bend, my = 228 - (228 - topY) * 0.55;
  return (
    <>
      <path d={taperedRibbon(100, 228, mx, my, 100, topY, wBase, wTop)} fill={fill} stroke="rgba(0,0,0,.22)" strokeWidth={0.6} />
      <path d={`M100,224 Q${mx.toFixed(1)},${my.toFixed(1)} 100,${topY + 6}`} stroke="rgba(0,0,0,.15)" strokeWidth={1} fill="none" />
    </>
  );
};

const BranchShape: React.FC<{ x1: number; y1: number; x2: number; y2: number; w1: number; w2: number; fill: string }> =
  ({ x1, y1, x2, y2, w1, w2, fill }) => {
    const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 - 12;
    return <path d={taperedRibbon(x1, y1, mx, my, x2, y2, w1, w2)} fill={fill} stroke="rgba(0,0,0,.18)" strokeWidth={0.5} />;
  };

// Lamduan (ลำดวน) — thick, waxy petals in two whorls of three, opening
// around a small gold centre. Real bud→bloom stages, not a generic flower.
const LamduanFlower: React.FC<{ tier: Tier; petalFill?: string }> = ({ tier, petalFill }) => {
  const bloomVar = `var(--bloom-${tier})`;
  const gold = 'var(--bloom-gold)';
  const tilt = -8;

  if (tier < 2) {
    const budH = tier === 0 ? 13 : 17, budW = tier === 0 ? 7 : 9;
    return (
      <>
        <ellipse cx={0} cy={-(budH * 0.55)} rx={budW} ry={budH} fill={bloomVar} transform={`rotate(${tilt})`} />
        {tier === 1 && [0, 120, 240].map((a) => (
          <g key={a} transform={`rotate(${a + tilt})`}>
            <path d={bladeShape(6, 3.4, 0.92)} fill={bloomVar} />
          </g>
        ))}
      </>
    );
  }

  const outerLen = tier === 2 ? 20 : 24, innerLen = tier === 2 ? 6 : 17;
  return (
    <>
      {[0, 120, 240].map((a) => (
        <g key={a} transform={`rotate(${a + tilt})`}>
          <path d={bladeShape(outerLen, outerLen * 0.52, 0.92)} fill={petalFill || bloomVar} />
          <line x1={0} y1={0} x2={0} y2={-(outerLen * 0.86)} stroke="rgba(255,255,255,.45)" strokeWidth={0.6} />
        </g>
      ))}
      {[60, 180, 300].map((a) => (
        <g key={a} transform={`rotate(${a + tilt})`}>
          <path d={bladeShape(innerLen, innerLen * 0.58, 0.92)} fill="var(--bloom-3)" />
        </g>
      ))}
      <circle cx={0} cy={0} r={4.2} fill={gold} />
      {tier === 3 && (
        <>
          {[0, 1, 2, 3, 4].map((k) => (
            <line key={k} x1={0} y1={0} x2={0} y2={-6} stroke={gold} strokeWidth={1.3} transform={`rotate(${k * 72})`} />
          ))}
          <circle cx={5} cy={-7} r={2.3} fill="#fff" opacity={0.85} />
        </>
      )}
    </>
  );
};

const FlowerAt: React.FC<{ cx: number; cy: number; scale: number; tier: Tier; petalFill?: string }> = ({ cx, cy, scale, tier, petalFill }) => (
  <g transform={`translate(${cx},${cy}) scale(${scale})`}>
    <LamduanFlower tier={tier} petalFill={petalFill} />
  </g>
);

// Wraps one branch (and whatever's on it) so it sways with its own delay —
// in the wind, a branch swings more than the trunk it hangs off, and each
// one lags the next by a beat, so a gust reads as moving through the tree.
const LimbGroup: React.FC<{ originX: number; originY: number; delay: number; children: React.ReactNode }> =
  ({ originX, originY, delay, children }) => (
    <g className="limb-sway" style={{ animationDelay: `${delay.toFixed(2)}s`, transformOrigin: `${originX}px ${originY}px` }}>
      {children}
    </g>
  );

// ── growth-stage bodies ──────────────────────────────────────────────────

const SeedStage: React.FC<{ seedGradId: string }> = ({ seedGradId }) => (
  <>
    <ellipse cx={100} cy={214} rx={7} ry={10} fill={`url(#${seedGradId})`} transform="rotate(-12 100 214)" />
    <ellipse cx={97} cy={208} rx={2.2} ry={3.2} fill="rgba(255,255,255,.3)" />
  </>
);

const SproutStage: React.FC<{ exTier: Tier; leafUrl: string }> = ({ exTier, leafUrl }) => {
  const w = [2.4, 3, 3.6, 4.2][exTier];
  return (
    <>
      <path d="M100,228 C101,216 99,208 100,196" stroke={leafUrl} strokeWidth={w} fill="none" strokeLinecap="round" />
      <g transform="translate(89,199) rotate(-38)"><path d={bladeShape(13, 7)} fill={leafUrl} /></g>
      <g transform="translate(111,199) rotate(38)"><path d={bladeShape(13, 7)} fill={leafUrl} /></g>
    </>
  );
};

const SAPLING_CLUSTERS: ReadonlyArray<readonly [number, number, number]> = [[86, 182, 9], [116, 178, 9], [100, 160, 10]];

const SaplingStage: React.FC<{ exTier: Tier; leafUrl: string; barkUrl: string }> = ({ exTier, leafUrl, barkUrl }) => {
  const w = [4, 5.5, 7, 8.5][exTier], lean = [10, 4, 0, 0][exTier];
  const count = [1, 2, 3, 3][exTier];
  return (
    <g transform={`rotate(${-lean} 100 228)`}>
      <TrunkShape topY={158} wBase={w + 2} wTop={w * 0.4} fill={barkUrl} />
      {SAPLING_CLUSTERS.slice(0, count).map(([cx, cy, r], i) => (
        <LimbGroup key={i} originX={cx} originY={cy} delay={i * 0.3}>
          <LeafCluster cx={cx} cy={cy} r={r} fill={leafUrl} fanIdx={i} />
        </LimbGroup>
      ))}
    </g>
  );
};

const YOUNG_LIMBS: ReadonlyArray<{ b: readonly [number, number, number, number]; c: readonly [number, number, number] }> = [
  { b: [100, 175, 74, 152], c: [74, 150, 13] },
  { b: [100, 175, 126, 152], c: [126, 150, 13] },
  { b: [100, 145, 80, 120], c: [80, 118, 14] },
  { b: [100, 145, 120, 120], c: [120, 118, 14] },
];
const YOUNG_SLOTS: ReadonlyArray<readonly [number, number]> = [[74, 150], [126, 150], [100, 106], [80, 118]];
const YOUNG_FLOWER_GROUP = [0, 1, 4, 2]; // index 4 = crown (no branch of its own)

const YoungTreeStage: React.FC<{ exTier: Tier; slTier: Tier; leafUrl: string; barkUrl: string; petalUrl: string }> =
  ({ exTier, slTier, leafUrl, barkUrl, petalUrl }) => {
    const w = [6, 7.5, 9, 10.5][exTier], bw = [3, 4, 5, 6][exTier];
    const leafCount = [2, 3, 4, 5][exTier];
    const flowerCount = [0, 1, 2, 4][slTier];
    const limbFlowers: Array<Array<readonly [number, number]>> = [[], [], [], [], []];
    for (let f = 0; f < flowerCount; f++) limbFlowers[YOUNG_FLOWER_GROUP[f]].push(YOUNG_SLOTS[f]);

    return (
      <>
        <TrunkShape topY={128} wBase={w + 3} wTop={w * 0.4} fill={barkUrl} />
        {YOUNG_LIMBS.map((limb, i) => (
          <LimbGroup key={i} originX={limb.b[0]} originY={limb.b[1]} delay={i * 0.35}>
            <BranchShape x1={limb.b[0]} y1={limb.b[1]} x2={limb.b[2]} y2={limb.b[3]} w1={bw} w2={Math.max(1.6, bw * 0.35)} fill={barkUrl} />
            {i < leafCount && <LeafCluster cx={limb.c[0]} cy={limb.c[1]} r={limb.c[2]} fill={leafUrl} fanIdx={i} />}
            {limbFlowers[i].map(([fx, fy], j) => (
              <FlowerAt key={j} cx={fx} cy={fy} scale={0.5} tier={slTier} petalFill={petalUrl} />
            ))}
          </LimbGroup>
        ))}
        <LimbGroup originX={100} originY={128} delay={0.15}>
          {leafCount > 4 && <LeafCluster cx={100} cy={106} r={15} fill={leafUrl} fanIdx={4} />}
          {limbFlowers[4].map(([fx, fy], j) => (
            <FlowerAt key={j} cx={fx} cy={fy} scale={0.5} tier={slTier} petalFill={petalUrl} />
          ))}
        </LimbGroup>
      </>
    );
  };

const MATURE_LIMBS: ReadonlyArray<{ b: readonly [number, number, number, number]; c: readonly [number, number, number] }> = [
  { b: [100, 190, 58, 168], c: [58, 168, 17] },
  { b: [100, 190, 142, 168], c: [142, 168, 17] },
  { b: [100, 158, 46, 132], c: [46, 132, 18] },
  { b: [100, 158, 154, 132], c: [154, 132, 18] },
  { b: [100, 128, 70, 100], c: [70, 100, 19] },
  { b: [100, 128, 130, 100], c: [130, 100, 19] },
];
const MATURE_SLOTS: ReadonlyArray<readonly [number, number]> = [
  [58, 168], [142, 168], [46, 132], [154, 132], [70, 100], [130, 100],
  [100, 86], [88, 140], [112, 140], [100, 118], [64, 120], [136, 152],
];
const MATURE_FLOWER_GROUP = [0, 1, 2, 3, 4, 5, 6, 6, 6, 6, 6, 6]; // 6 = crown

const MatureTreeStage: React.FC<{ exTier: Tier; slTier: Tier; leafUrl: string; barkUrl: string; petalUrl: string }> =
  ({ exTier, slTier, leafUrl, barkUrl, petalUrl }) => {
    const w = [9, 10.5, 12, 13.5][exTier], bw = [4, 5.5, 7, 8.5][exTier];
    const leafCount = [3, 5, 6, 7][exTier];
    const flowerCount = [0, 3, 7, 12][slTier];
    const limbFlowers: Array<Array<readonly [number, number]>> = [[], [], [], [], [], [], []];
    for (let f = 0; f < flowerCount; f++) limbFlowers[MATURE_FLOWER_GROUP[f]].push(MATURE_SLOTS[f]);

    return (
      <>
        <TrunkShape topY={98} wBase={w + 4} wTop={w * 0.35} fill={barkUrl} />
        {MATURE_LIMBS.map((limb, i) => {
          const w2 = Math.max(1.8, bw * 0.3);
          return (
            <LimbGroup key={i} originX={limb.b[0]} originY={limb.b[1]} delay={i * 0.3}>
              <BranchShape x1={limb.b[0]} y1={limb.b[1]} x2={limb.b[2]} y2={limb.b[3]} w1={bw} w2={w2} fill={barkUrl} />
              {i < leafCount && <LeafCluster cx={limb.c[0]} cy={limb.c[1]} r={limb.c[2]} fill={leafUrl} fanIdx={i} />}
              {limbFlowers[i].map(([fx, fy], j) => (
                <FlowerAt key={j} cx={fx} cy={fy} scale={0.42} tier={slTier} petalFill={petalUrl} />
              ))}
            </LimbGroup>
          );
        })}
        <LimbGroup originX={100} originY={98} delay={0.1}>
          {leafCount > 6 && <LeafCluster cx={100} cy={86} r={20} fill={leafUrl} fanIdx={6} />}
          {limbFlowers[6].map(([fx, fy], j) => (
            <FlowerAt key={j} cx={fx} cy={fy} scale={0.42} tier={slTier} petalFill={petalUrl} />
          ))}
        </LimbGroup>
      </>
    );
  };

// ── the component ────────────────────────────────────────────────────────

const AURA_CENTER_Y: Record<GrowthStage, number> = { 0: 150, 1: 148, 2: 138, 3: 120, 4: 104 };
const FIREFLY_OFFSETS: ReadonlyArray<readonly [number, number]> = [[-30, 0], [32, -10], [0, -35], [-40, 25], [40, 30], [-14, 55]];
const FLY_KEYFRAMES = ['fireflyFloatA', 'fireflyFloatB', 'fireflyFloatC'];

export const GardenPlant: React.FC<GardenPlantProps> = ({ breakdown, stage, size = 200, className, title }) => {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, '');
  const tN = pillarTier(breakdown.nutrition);
  const tE = pillarTier(breakdown.exercise);
  const tS = pillarTier(breakdown.sleep);
  const tM = pillarTier(breakdown.mental);

  const auraCenterY = AURA_CENTER_Y[stage];
  const auraR = [40, 55, 70, 88][tM];
  const auraOp = [0.06, 0.14, 0.24, 0.36][tM];
  const fireflyCount = [0, 0, 3, 6][tM];

  const leafGradId = `leafGrad${rawId}`;
  const barkGradId = `barkGrad${rawId}`;
  const petalGradId = `petalGrad${rawId}`;
  const soilGradId = `soilGrad${rawId}`;
  const seedGradId = `seedGrad${rawId}`;
  const shadowBlurId = `sBlur${rawId}`;
  const treeShadowId = `tShadow${rawId}`;
  const auraBlurId = `aBlur${rawId}`;

  const leafBase = `var(--leaf-${tE})`;
  const bloomBase = `var(--bloom-${tS})`;
  const leafUrl = `url(#${leafGradId})`;
  const barkUrl = `url(#${barkGradId})`;
  const petalUrl = `url(#${petalGradId})`;

  const soilOp = [0.22, 0.48, 0.76, 1][tN];
  const cracks = tN < 2;
  const glisten = tN === 3;
  const speckle: ReadonlyArray<readonly [number, number]> = [[80, 227], [122, 229], [92, 238], [112, 236], [100, 224], [68, 235]];

  return (
    <svg
      viewBox="0 0 200 260"
      width={size}
      height={size * 1.3}
      className={className}
      role="img"
      aria-label={title ?? `Longevity garden tree, stage ${stage}`}
    >
      <defs>
        <filter id={auraBlurId} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation={10} /></filter>
        <filter id={shadowBlurId} x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation={3} /></filter>
        <filter id={treeShadowId} x="-30%" y="-20%" width="160%" height="150%">
          <feDropShadow dx={1.4} dy={2.6} stdDeviation={1.6} floodOpacity={0.28} />
        </filter>
        <linearGradient id={leafGradId} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" style={{ stopColor: `color-mix(in srgb, ${leafBase} 65%, black 25%)` }} />
          <stop offset="1" style={{ stopColor: `color-mix(in srgb, ${leafBase} 85%, white 20%)` }} />
        </linearGradient>
        <linearGradient id={barkGradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--bark) 68%, black 32%)' }} />
          <stop offset="0.5" style={{ stopColor: 'var(--bark)' }} />
          <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--bark) 75%, white 25%)' }} />
        </linearGradient>
        <linearGradient id={petalGradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: bloomBase }} />
          <stop offset="1" style={{ stopColor: `color-mix(in srgb, ${bloomBase} 55%, white 45%)` }} />
        </linearGradient>
        <radialGradient id={soilGradId} cx="0.5" cy="0.32" r="0.7">
          <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--nutrition) 88%, black 12%)' }} />
          <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--nutrition) 68%, black 38%)' }} />
        </radialGradient>
        {stage === 0 && (
          <radialGradient id={seedGradId} cx="0.35" cy="0.3" r="0.75">
            <stop offset="0" style={{ stopColor: 'color-mix(in srgb, var(--bark) 70%, white 30%)' }} />
            <stop offset="1" style={{ stopColor: 'color-mix(in srgb, var(--bark) 68%, black 32%)' }} />
          </radialGradient>
        )}
      </defs>

      <circle cx={100} cy={auraCenterY} r={auraR} fill="var(--mental)" opacity={auraOp} filter={`url(#${auraBlurId})`} />

      {Array.from({ length: fireflyCount }, (_, i) => {
        const [ox, oy] = FIREFLY_OFFSETS[i];
        const fx = 100 + ox, fy = auraCenterY + oy;
        return (
          <g key={i} className="firefly-fly" style={{ animationName: FLY_KEYFRAMES[i % FLY_KEYFRAMES.length], animationDelay: `${(i * 0.55).toFixed(2)}s` }}>
            <circle className="firefly" cx={fx} cy={fy} r={4.5} fill="#fff" opacity={0.18} />
            <circle className="firefly" cx={fx} cy={fy} r={1.3} fill="#fff" opacity={0.85} />
          </g>
        );
      })}

      {stage === 0 && <SeedStage seedGradId={seedGradId} />}

      <ellipse cx={100} cy={244} rx={62} ry={8} fill="#000" opacity={0.16} filter={`url(#${shadowBlurId})`} />
      <ellipse cx={100} cy={234} rx={74} ry={20} fill="var(--surface-soft)" />
      <g opacity={soilOp}>
        <ellipse cx={100} cy={232} rx={70} ry={18} fill={`url(#${soilGradId})`} />
        {speckle.map(([sx, sy], i) => <circle key={i} cx={sx} cy={sy} r={1.2} fill="rgba(0,0,0,.3)" />)}
      </g>
      {cracks && (
        <>
          <path d="M74,228 q10,-8 18,0" stroke="var(--text-secondary)" strokeWidth={1.4} fill="none" opacity={0.35} />
          <path d="M112,232 q8,-6 16,2" stroke="var(--text-secondary)" strokeWidth={1.4} fill="none" opacity={0.35} />
        </>
      )}
      {glisten && <ellipse cx={78} cy={222} rx={14} ry={4} fill="#fff" opacity={0.35} />}

      {stage > 0 && (
        <g className="tree-sway" filter={`url(#${treeShadowId})`}>
          {stage === 1 && <SproutStage exTier={tE} leafUrl={leafUrl} />}
          {stage === 2 && <SaplingStage exTier={tE} leafUrl={leafUrl} barkUrl={barkUrl} />}
          {stage === 3 && <YoungTreeStage exTier={tE} slTier={tS} leafUrl={leafUrl} barkUrl={barkUrl} petalUrl={petalUrl} />}
          {stage === 4 && <MatureTreeStage exTier={tE} slTier={tS} leafUrl={leafUrl} barkUrl={barkUrl} petalUrl={petalUrl} />}
        </g>
      )}
    </svg>
  );
};
