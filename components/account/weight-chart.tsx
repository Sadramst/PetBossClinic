import { faNum } from '@/lib/club/pet-math';

/** Tiny dependency-free weight trend. Needs at least two points to draw a line. */
export function WeightChart({ points }: { points: Array<{ at: Date; kg: number }> }) {
  if (points.length < 2) return null;
  const W = 280, H = 80, P = 8;
  const kgs = points.map((p) => p.kg);
  const min = Math.min(...kgs), max = Math.max(...kgs);
  const span = max - min || 1;
  const xy = points.map((p, i) => [P + (i / (points.length - 1)) * (W - 2 * P), H - P - ((p.kg - min) / span) * (H - 2 * P)] as const);
  const d = xy.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  return (
    <figure className="min-w-0">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-20 w-full max-w-xs text-primary" role="img" aria-label={`روند وزن از ${faNum(kgs[0])} به ${faNum(kgs[kgs.length - 1])} کیلوگرم`}>
        <path d={d} fill="none" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {xy.map(([x, y], i) => <circle key={i} cx={x} cy={y} r="3" fill="currentColor" />)}
      </svg>
    </figure>
  );
}
