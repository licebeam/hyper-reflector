import { useEffect, useRef, useState } from "react";

export type ProjectilePos = [number, number];

export type ReplayFrame = {
  p1x: number; p1y: number;
  p2x: number; p2y: number;
  p1hp: number | null;
  p2hp: number | null;
  p1sa: number | null;
  p2sa: number | null;
  projs: ProjectilePos[];
  p1stun: number | null;
  p2stun: number | null;
  p1stunMax: number | null;
  p2stunMax: number | null;
  p1dizzy: boolean;
  p2dizzy: boolean;
  p1crouch: boolean;
  p2crouch: boolean;
};

type MatchReplayProps = {
  frames: ReplayFrame[];
  p1Color?: string;
  p2Color?: string;
};

const W = 400;
const DOT = 5;
// top HUD: HP then stun
const HP_Y = 4;   const HP_H = 7;
const STUN_Y = 13; const STUN_H = 4;
const PAD_TOP = 22;
// stage
const FLOOR_Y = 127;
// bottom HUD: super meter
const SA_Y = FLOOR_Y + 6; const SA_H = 5;
const H = SA_Y + SA_H + 6;
const BAR_W = W / 2 - 12;

const HP_COLOR        = "#4ade80";
const STUN_COLOR      = "#facc15";
const STUN_DIZZY_COLOR = "#f87171";
const SA_COLOR        = "#60a5fa";

function normalize(frames: ReplayFrame[]) {
  if (!frames.length) {
    return { minX: 0, rangeX: 1, jumpRange: 1, maxP1Hp: 255, maxP2Hp: 255, maxP1Sa: 1, maxP2Sa: 1 };
  }
  let minX = Infinity, maxX = -Infinity, maxY = 0;
  let maxP1Hp = 1, maxP2Hp = 1, maxP1Sa = 1, maxP2Sa = 1;
  for (const f of frames) {
    if (f.p1x < minX) minX = f.p1x;
    if (f.p2x < minX) minX = f.p2x;
    if (f.p1x > maxX) maxX = f.p1x;
    if (f.p2x > maxX) maxX = f.p2x;
    if (f.p1y > maxY) maxY = f.p1y;
    if (f.p2y > maxY) maxY = f.p2y;
    for (const [px, py] of f.projs) {
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (py > maxY) maxY = py;
    }
    if (f.p1hp !== null && f.p1hp > maxP1Hp) maxP1Hp = f.p1hp;
    if (f.p2hp !== null && f.p2hp > maxP2Hp) maxP2Hp = f.p2hp;
    if (f.p1sa !== null && f.p1sa > maxP1Sa) maxP1Sa = f.p1sa;
    if (f.p2sa !== null && f.p2sa > maxP2Sa) maxP2Sa = f.p2sa;
  }
  return { minX, rangeX: maxX - minX || 1, jumpRange: maxY || 1, maxP1Hp, maxP2Hp, maxP1Sa, maxP2Sa };
}

export function MatchReplay({
  frames,
  p1Color = "var(--v2-accent)",
  p2Color = "var(--v2-muted)",
}: MatchReplayProps) {
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);

  const { minX, rangeX, jumpRange, maxP1Hp, maxP2Hp, maxP1Sa, maxP2Sa } = normalize(frames);
  const total = frames.length;

  const toSvgX = (x: number) => DOT + ((x - minX) / rangeX) * (W - DOT * 2);
  const toSvgY = (y: number) =>
    FLOOR_Y - (Math.min(Math.max(y, 0), jumpRange) / jumpRange) * (FLOOR_Y - PAD_TOP);

  useEffect(() => {
    if (!playing) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }
    const step = (time: number) => {
      if (time - lastTimeRef.current >= 1000 / 60) {
        lastTimeRef.current = time;
        setCursor((c) => {
          if (c >= total - 1) { setPlaying(false); return c; }
          return c + 1;
        });
      }
      rafRef.current = requestAnimationFrame(step);
    };
    rafRef.current = requestAnimationFrame(step);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [playing, total]);

  if (!total) return null;

  const f = frames[cursor];
  const p1x = toSvgX(f.p1x);
  const p1y = toSvgY(f.p1y);
  const p2x = toSvgX(f.p2x);
  const p2y = toSvgY(f.p2y);
  const hasHud = f.p1hp !== null;

  const pct = (v: number | null, max: number) =>
    v !== null ? Math.max(0, Math.min(1, v / max)) * BAR_W : 0;

  const p1HpW   = pct(f.p1hp,   maxP1Hp);
  const p2HpW   = pct(f.p2hp,   maxP2Hp);
  const p1StunW = f.p1dizzy ? BAR_W : pct(f.p1stun, f.p1stunMax ?? 1);
  const p2StunW = f.p2dizzy ? BAR_W : pct(f.p2stun, f.p2stunMax ?? 1);
  const p1SaW   = pct(f.p1sa,   maxP1Sa);
  const p2SaW   = pct(f.p2sa,   maxP2Sa);

  return (
    <div className="space-y-1">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full rounded"
        style={{ height: H, background: "var(--v2-hover)" }}
      >
        {/* top HUD — HP and stun */}
        {hasHud && (
          <>
            <rect x={6} y={HP_Y} width={BAR_W} height={HP_H} fill="var(--v2-surface)" rx="2" />
            <rect x={W - 6 - BAR_W} y={HP_Y} width={BAR_W} height={HP_H} fill="var(--v2-surface)" rx="2" />
            <rect x={6} y={HP_Y} width={p1HpW} height={HP_H} fill={HP_COLOR} rx="2" />
            <rect x={W - 6 - p2HpW} y={HP_Y} width={p2HpW} height={HP_H} fill={HP_COLOR} rx="2" />

            <rect x={6} y={STUN_Y} width={BAR_W} height={STUN_H} fill="var(--v2-surface)" rx="1" />
            <rect x={W - 6 - BAR_W} y={STUN_Y} width={BAR_W} height={STUN_H} fill="var(--v2-surface)" rx="1" />
            <rect x={6} y={STUN_Y} width={p1StunW} height={STUN_H} fill={f.p1dizzy ? STUN_DIZZY_COLOR : STUN_COLOR} rx="1" />
            <rect x={W - 6 - p2StunW} y={STUN_Y} width={p2StunW} height={STUN_H} fill={f.p2dizzy ? STUN_DIZZY_COLOR : STUN_COLOR} rx="1" />
          </>
        )}

        {/* floor */}
        <line x1={0} y1={FLOOR_Y} x2={W} y2={FLOOR_Y} stroke="var(--v2-border)" strokeWidth="1" />

        {/* projectiles */}
        {f.projs.map(([px, py], i) => (
          <circle key={i} cx={toSvgX(px)} cy={toSvgY(py)} r={3} fill={SA_COLOR} opacity="0.85" />
        ))}

        {/* P2 pill — bottom sits on player Y, shorter when crouching */}
        <rect x={p2x - DOT} y={p2y - (f.p2crouch ? DOT * 3 : DOT * 6)} width={DOT * 2} height={f.p2crouch ? DOT * 3 : DOT * 6} rx={DOT} fill={p2Color} opacity="0.7" />
        {/* P1 pill — bottom sits on player Y, shorter when crouching */}
        <rect x={p1x - DOT} y={p1y - (f.p1crouch ? DOT * 3 : DOT * 6)} width={DOT * 2} height={f.p1crouch ? DOT * 3 : DOT * 6} rx={DOT} fill={p1Color} />

        {/* bottom HUD — super meter */}
        {hasHud && (
          <>
            <rect x={6} y={SA_Y} width={BAR_W} height={SA_H} fill="var(--v2-surface)" rx="1" />
            <rect x={W - 6 - BAR_W} y={SA_Y} width={BAR_W} height={SA_H} fill="var(--v2-surface)" rx="1" />
            <rect x={6} y={SA_Y} width={p1SaW} height={SA_H} fill={SA_COLOR} rx="1" />
            <rect x={W - 6 - p2SaW} y={SA_Y} width={p2SaW} height={SA_H} fill={SA_COLOR} rx="1" />
          </>
        )}
      </svg>

      <div className="flex items-center gap-2">
        <button
          onClick={() => {
            if (cursor >= total - 1) setCursor(0);
            setPlaying((p) => !p);
          }}
          className="text-xs px-2 py-0.5 rounded border shrink-0"
          style={{ borderColor: "var(--v2-border)", color: "var(--v2-muted)" }}
        >
          {playing ? "Pause" : cursor >= total - 1 ? "Replay" : "Play"}
        </button>
        <input
          type="range"
          min={0}
          max={total - 1}
          value={cursor}
          onChange={(e) => { setPlaying(false); setCursor(Number(e.target.value)); }}
          className="w-full h-1 accent-(--v2-accent)"
          style={{ accentColor: "var(--v2-accent)" }}
        />
        <span className="text-xs shrink-0 tabular-nums" style={{ color: "var(--v2-muted)" }}>
          {(cursor / 60).toFixed(1)}s
        </span>
      </div>
    </div>
  );
}
