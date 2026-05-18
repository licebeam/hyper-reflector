type MeterChartProps = {
  p1Samples: number[];
  p2Samples: number[];
  height?: number;
  p1Color?: string;
  p2Color?: string;
};

export function MeterChart({
  p1Samples,
  p2Samples,
  height = 56,
  p1Color = "var(--v2-accent)",
  p2Color = "var(--v2-muted)",
}: MeterChartProps) {
  const W = 400;
  const H = height;
  const PAD = 4;

  const cumulative = (samples: number[]) => {
    let total = 0;
    return samples.map((v) => (total += v));
  };

  const p1Cum = cumulative(p1Samples);
  const p2Cum = cumulative(p2Samples);

  if (p1Cum.length < 2 && p2Cum.length < 2) return null;

  const maxVal = Math.max(...p1Cum, ...p2Cum, 1);
  const totalPoints = Math.max(p1Cum.length, p2Cum.length, 2);

  const toPoints = (data: number[]) =>
    data
      .map((v, i) => {
        const x = PAD + (i / (totalPoints - 1)) * (W - PAD * 2);
        const y = H - PAD - (v / maxVal) * (H - PAD * 2);
        return `${x},${y}`;
      })
      .join(" ");

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }}>
      {p2Cum.length >= 2 && (
        <polyline
          points={toPoints(p2Cum)}
          fill="none"
          stroke={p2Color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.6"
        />
      )}
      {p1Cum.length >= 2 && (
        <polyline
          points={toPoints(p1Cum)}
          fill="none"
          stroke={p1Color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
    </svg>
  );
}
