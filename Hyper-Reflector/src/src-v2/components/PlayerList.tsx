import { useState } from "react";
import { Coffee, Flame, Swords, User } from "lucide-react";

function streakGlowStyle(streak: number): React.CSSProperties {
  if (streak <= 0) return {};
  const t = Math.min(streak, 10) / 10; // 0→1
  const alpha = Math.round(t * 180).toString(16).padStart(2, "0");
  const spread = 4 + t * 18;
  return {
    boxShadow: `inset 0 0 ${spread}px #f97316${alpha}, inset 2px 0 0 #f97316${Math.round(t * 255).toString(16).padStart(2, "0")}`,
  };
}
import type { V2User } from "../types";
import { CountryFlag } from "./CountryFlag";
import { UserTitle } from "./UserTitle";

// ── Ping helpers ───────────────────────────────────────────────────────────────

type PingResult = { ping: number | null; isUnstable?: boolean };

function toNum(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function resolvePing(
  user: V2User,
  viewer: V2User | null | undefined,
): PingResult {
  if (!viewer || viewer.uid === user.uid) return { ping: null };
  const vr = (viewer.lastKnownPings as any[])?.find((p) => p?.id === user.uid);
  if (vr) return { ping: toNum(vr.ping), isUnstable: vr.isUnstable };
  const ur = (user.lastKnownPings as any[])?.find((p) => p?.id === viewer.uid);
  if (ur) return { ping: toNum(ur.ping), isUnstable: ur.isUnstable };
  return { ping: null };
}

function pingColor(ping: number | null, isUnstable?: boolean): string {
  if (ping === null) return "var(--v2-muted)";
  if (isUnstable) return "#fb923c";
  if (ping <= 30) return "#34d399";
  if (ping <= 80) return "#fbbf24";
  if (ping <= 150) return "#fb923c";
  return "#f87171";
}

// ── Ping tooltip ───────────────────────────────────────────────────────────────

type PingBadgeProps = {
  pingLabel: string;
  isUnstable?: boolean;
  color: string;
};

function PingBadge({ pingLabel, isUnstable, color }: PingBadgeProps) {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const label = isUnstable ? `~${pingLabel}` : pingLabel;
  const tooltipText = isUnstable
    ? `Unstable connection · ${pingLabel}`
    : pingLabel;

  return (
    <span
      className="relative inline-flex items-center"
      onMouseEnter={(e) => setRect(e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => setRect(null)}
    >
      <span className="text-[10px]" style={{ color }}>
        {label}
      </span>
      {rect && (
        <span
          className="fixed px-2 py-1 rounded text-[10px] whitespace-nowrap pointer-events-none z-9999"
          style={{
            top: rect.top - 4,
            left: rect.left + rect.width / 2,
            transform: "translate(-50%, -100%)",
            background: "var(--v2-surface)",
            color: isUnstable ? "#fb923c" : "var(--v2-text)",
            border: "1px solid var(--v2-border)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}
        >
          {tooltipText}
        </span>
      )}
    </span>
  );
}

// ── Avatar ─────────────────────────────────────────────────────────────────────

function UserAvatar({ user }: { user: V2User }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = !!user.userProfilePic && !imgFailed;
  return (
    <div
      id="user-image-chat"
      className="w-7 h-7 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold hover:scale-200"
      style={{ background: "var(--v2-accent)", color: "var(--v2-accent-fg)" }}
    >
      {showImg ? (
        <img
          src={user.userProfilePic}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setImgFailed(true)}
        />
      ) : (
        user.userName.slice(0, 2).toUpperCase()
      )}
    </div>
  );
}

// ── Player row ─────────────────────────────────────────────────────────────────

type RowProps = {
  user: V2User;
  isSelf: boolean;
  onViewProfile?: (uid: string) => void;
  onChallenge?: (uid: string) => void;
  currentUser?: V2User | null;
  challengeDisabled?: boolean;
  showStreak?: boolean;
  measuringUids?: ReadonlySet<string>;
};

function PlayerRow({
  user,
  isSelf,
  onViewProfile,
  onChallenge,
  currentUser,
  challengeDisabled,
  showStreak,
  measuringUids,
}: RowProps) {
  const [hovered, setHovered] = useState(false);
  const expanded = hovered;

  const { ping, isUnstable } = resolvePing(user, currentUser);
  const pingMs = ping !== null ? Math.round(ping) : null;
  const pingLabel =
    ping === 0 ? "< 1 ms" : pingMs !== null ? `${pingMs} ms` : null;
  const pColor = pingColor(ping, isUnstable);

  const streak = showStreak ? (user.winStreak ?? 0) : 0;

  return (
    <div
      className="relative flex items-start gap-2.5 px-3 py-3 border-b transition-colors"
      style={{
        background: hovered ? "var(--v2-hover)" : "transparent",
        borderColor: "var(--v2-border)",
        ...streakGlowStyle(streak),
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="flex-1 min-w-0">
        {/* Always visible: name + (you) + flag */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <CountryFlag code={user.countryCode} className="h-3" />
          <UserAvatar user={user} />
          <span
            className="text-sm font-medium truncate"
            style={{ color: isSelf ? "var(--v2-name-self)" : "var(--v2-text)" }}
          >
            {user.userName}
          </span>
          {isSelf && (
            <span
              className="text-[10px] shrink-0"
              style={{ color: "var(--v2-muted)" }}
            >
              (you)
            </span>
          )}
          {user.userTitle?.title && <UserTitle title={user.userTitle} />}
          {/* Searching indicator */}
          {user.isRankQueued && (
            <span
              className="flex items-center gap-0.5 text-[10px] px-1 rounded"
              style={{ color: "#fbbf24", background: "#78350f44" }}
              title="Searching for ranked match"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse inline-block" />
              Searching
            </span>
          )}
          <div
            className="flex items-center gap-1.5"
            style={{ flexDirection: "row", alignItems: "flex-end" }}
          >
            {!isSelf &&
              (pingLabel !== null ? (
                <PingBadge
                  pingLabel={pingLabel}
                  isUnstable={isUnstable}
                  color={pColor}
                />
              ) : measuringUids?.has(user.uid) ? (
                <span
                  className="text-[10px] animate-pulse"
                  style={{ color: "var(--v2-muted)" }}
                >
                  estimating
                </span>
              ) : (
                <span
                  className="text-[10px]"
                  style={{ color: "var(--v2-muted)" }}
                >
                  ping —
                </span>
              ))}
          </div>
        </div>

        {/*
          Expandable section.
          transition-[grid-template-rows] is the Tailwind v4 arbitrary-property syntax.
          Both row values appear as complete literals here so the scanner picks them up.
        */}
        <div
          className={`grid overflow-hidden transition-[grid-template-rows] duration-200 ease-out ${
            expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
          }`}
        >
          <div className="overflow-hidden">
            <div className="pt-1 pb-1 space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className="text-[10px]"
                  style={{ color: "var(--v2-muted)" }}
                >
                  {user.accountElo} ELO
                </span>
                {streak > 0 && (
                  <span
                    className="flex items-center gap-0.5 text-[10px] font-semibold"
                    style={{ color: "#f97316" }}
                  >
                    <Flame size={10} strokeWidth={2.5} />
                    {streak} streak
                  </span>
                )}
              </div>

              {/* Action buttons for other players */}
              {!isSelf && (
                <div className="flex gap-1.5 flex-wrap">
                  {onChallenge && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!challengeDisabled) onChallenge(user.uid);
                      }}
                      disabled={!!challengeDisabled}
                      className="flex items-center gap-1 text-[16px] px-2 py-0.5 rounded font-medium transition-colors"
                      style={{
                        background: challengeDisabled ? "var(--v2-hover)" : "var(--v2-accent)",
                        color: challengeDisabled ? "var(--v2-muted)" : "var(--v2-accent-fg)",
                        cursor: challengeDisabled ? "not-allowed" : "pointer",
                        opacity: challengeDisabled ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!challengeDisabled) e.currentTarget.style.background = "var(--v2-accent-hover)";
                      }}
                      onMouseLeave={(e) => {
                        if (!challengeDisabled) e.currentTarget.style.background = challengeDisabled ? "var(--v2-hover)" : "var(--v2-accent)";
                      }}
                      title={challengeDisabled ? "Cannot challenge while in a match or searching" : undefined}
                    >
                      <Swords size={16} /> Challenge
                    </button>
                  )}
                  {onViewProfile && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onViewProfile(user.uid);
                      }}
                      className="flex items-center gap-1 text-[16px] px-2 py-0.5 rounded font-medium transition-colors"
                      style={{
                        background: "var(--v2-accent)",
                        color: "var(--v2-accent-fg)",
                        cursor: "pointer",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background =
                          "var(--v2-accent-hover)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "var(--v2-accent)")
                      }
                    >
                      <User size={16} /> Profile
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── In-match pair row ──────────────────────────────────────────────────────────

function MatchPairRow({ players }: { players: V2User[] }) {
  const [p1, p2] = players;
  return (
    <div
      className="flex items-center gap-2 px-3 py-2.5 border-b"
      style={{ borderColor: "var(--v2-border)" }}
    >
      <Swords size={11} className="shrink-0" style={{ color: "var(--v2-muted)" }} />
      <div className="flex items-center gap-1 min-w-0 flex-1">
        {/* Player 1 */}
        <div className="flex items-center gap-1 min-w-0" style={{ maxWidth: "calc(50% - 12px)" }}>
          <CountryFlag code={p1?.countryCode ?? ""} className="h-2.5 shrink-0" />
          <span
            className="text-xs truncate"
            style={{ color: "var(--v2-text)" }}
            title={p1?.userName}
          >
            {p1?.userName ?? "?"}
          </span>
        </div>
        <span className="text-[10px] shrink-0 px-0.5" style={{ color: "var(--v2-muted)" }}>vs</span>
        {/* Player 2 */}
        {p2 ? (
          <div className="flex items-center gap-1 min-w-0" style={{ maxWidth: "calc(50% - 12px)" }}>
            <CountryFlag code={p2.countryCode ?? ""} className="h-2.5 shrink-0" />
            <span
              className="text-xs truncate"
              style={{ color: "var(--v2-text)" }}
              title={p2.userName}
            >
              {p2.userName}
            </span>
          </div>
        ) : (
          <span className="text-[10px]" style={{ color: "var(--v2-muted)" }}>???</span>
        )}
      </div>
    </div>
  );
}

// ── AFK row ────────────────────────────────────────────────────────────────────

function AfkRow({ user }: { user: V2User }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2.5 border-b"
      style={{ borderColor: "var(--v2-border)", opacity: 0.5 }}
    >
      <Coffee size={11} className="shrink-0" style={{ color: "var(--v2-muted)" }} />
      <div className="flex items-center gap-1.5 min-w-0 flex-1">
        <CountryFlag code={user.countryCode ?? ""} className="h-2.5 shrink-0" />
        <span
          className="text-xs truncate"
          style={{ color: "var(--v2-text)" }}
          title={user.userName}
        >
          {user.userName}
        </span>
        <span
          className="text-[9px] px-1 rounded shrink-0"
          style={{
            color: "var(--v2-muted)",
            background: "color-mix(in srgb, var(--v2-muted) 12%, transparent)",
          }}
        >
          AFK
        </span>
      </div>
    </div>
  );
}

// ── List ───────────────────────────────────────────────────────────────────────

const STREAK_GAME = 'sfiii3nr1'

type PlayerListProps = {
  users: V2User[];
  currentUser?: V2User | null;
  lobbyGame?: string;
  onViewProfile?: (uid: string) => void;
  onChallenge?: (uid: string) => void;
  challengeDisabled?: boolean;
  measuringUids?: ReadonlySet<string>;
};

export function PlayerList({
  users,
  currentUser,
  lobbyGame,
  onViewProfile,
  onChallenge,
  challengeDisabled,
  measuringUids,
}: PlayerListProps) {
  const showStreak = !lobbyGame || lobbyGame === STREAK_GAME
  const available: V2User[] = [];
  const inMatchRaw: V2User[] = [];
  const afk: V2User[] = [];

  for (const u of users) {
    if (u.isAfk) {
      afk.push(u);
    } else if (u.currentMatchId) {
      inMatchRaw.push(u);
    } else {
      available.push(u);
    }
  }

  // Group in-match users into pairs by their currentMatchId
  const matchGroups = new Map<string, V2User[]>();
  for (const u of inMatchRaw) {
    const key = u.currentMatchId!;
    if (!matchGroups.has(key)) matchGroups.set(key, []);
    matchGroups.get(key)!.push(u);
  }

  // Solo match groups = opponent is in a different lobby ("vs ???") → treat as AFK
  const matchPairs: V2User[][] = [];
  for (const group of matchGroups.values()) {
    if (group.length === 1) {
      afk.push(group[0]);
    } else {
      matchPairs.push(group);
    }
  }

  const inMatchCount = matchPairs.reduce((n, p) => n + p.length, 0);
  const isEmpty = available.length === 0 && matchPairs.length === 0 && afk.length === 0;

  return (
    <div
      className="flex flex-col h-full border-l"
      style={{ borderColor: "var(--v2-border)" }}
    >
      {/* ── Available ── */}
      <div
        className="px-3 py-2 border-b shrink-0"
        style={{ borderColor: "var(--v2-border)" }}
      >
        <span
          className="text-xs font-semibold uppercase tracking-wide"
          style={{ color: "var(--v2-muted)" }}
        >
          Players ({available.length})
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-scroll">
        {isEmpty && (
          <p
            className="text-xs text-center pt-6 px-3"
            style={{ color: "var(--v2-muted)" }}
          >
            No players in lobby
          </p>
        )}
        {available.map((user) => {
          const isSelf = user.uid === currentUser?.uid;
          return (
            <PlayerRow
              key={user.uid}
              user={user}
              isSelf={isSelf}
              onViewProfile={!isSelf ? onViewProfile : undefined}
              onChallenge={!isSelf ? onChallenge : undefined}
              currentUser={currentUser}
              challengeDisabled={challengeDisabled}
              showStreak={showStreak}
              measuringUids={measuringUids}
            />
          );
        })}
      </div>

      {/* ── In Match ── */}
      {matchPairs.length > 0 && (
        <div
          className="shrink-0 flex flex-col border-t"
          style={{ borderColor: "var(--v2-border)", height: "160px" }}
        >
          <div className="px-3 pt-2 pb-1 flex items-center gap-1.5 shrink-0">
            <Swords size={11} style={{ color: "var(--v2-muted)" }} />
            <span
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--v2-muted)" }}
            >
              In Match ({inMatchCount})
            </span>
          </div>
          <div className="overflow-y-scroll flex-1 min-h-0">
            {matchPairs.map((players, i) => (
              <MatchPairRow key={players[0]?.uid ?? i} players={players} />
            ))}
          </div>
        </div>
      )}

      {/* ── AFK ── */}
      {afk.length > 0 && (
        <div
          className="shrink-0 flex flex-col border-t"
          style={{ borderColor: "var(--v2-border)", height: "104px" }}
        >
          <div className="px-3 pt-2 pb-1 flex items-center gap-1.5 shrink-0">
            <Coffee size={11} style={{ color: "var(--v2-muted)" }} />
            <span
              className="text-[10px] font-semibold uppercase tracking-wide"
              style={{ color: "var(--v2-muted)" }}
            >
              AFK ({afk.length})
            </span>
          </div>
          <div className="overflow-y-scroll flex-1 min-h-0">
            {afk.map((user) => (
              <AfkRow key={user.uid} user={user} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
