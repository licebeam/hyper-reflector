import { useState } from "react";
import { BellOff, Coffee, Flame, Radio, Swords, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useSettingsStore } from "../state/store";

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

type PingResult = {
  ping: number | null;
  isUnstable?: boolean;
  networkType?: string;
  source?: "measured" | "estimated";
};

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
  if (vr) return { ping: toNum(vr.ping), isUnstable: vr.isUnstable, networkType: vr.networkType, source: vr.source };
  const ur = (user.lastKnownPings as any[])?.find((p) => p?.id === viewer.uid);
  if (ur) return { ping: toNum(ur.ping), isUnstable: ur.isUnstable, networkType: ur.networkType, source: ur.source };
  return { ping: null };
}

function pingBarCount(ping: number | null): 0 | 1 | 2 | 3 {
  if (ping === null) return 0;
  if (ping <= 60) return 3;
  if (ping <= 120) return 2;
  if (ping <= 200) return 1;
  return 0;
}

function pingBarColor(bars: 0 | 1 | 2 | 3, isUnstable?: boolean): string {
  if (isUnstable) return "#fb923c";
  if (bars === 3) return "#34d399";
  if (bars === 2) return "#fbbf24";
  if (bars === 1) return "#fb923c";
  return "#f87171";
}

// ── Ping bars ──────────────────────────────────────────────────────────────────

type PingBarsProps = {
  ping: number | null;
  isUnstable?: boolean;
  networkType?: string;
  source?: "measured" | "estimated";
  measuring?: boolean;
  unreachable?: boolean;
};

function PingBars({ ping, isUnstable, networkType, source, measuring, unreachable }: PingBarsProps) {
  const { t } = useTranslation();
  const [rect, setRect] = useState<DOMRect | null>(null);
  const bars = pingBarCount(ping);
  const color = pingBarColor(bars, isUnstable);
  const showEstimating = !!measuring || (!unreachable && ping !== null && source !== "measured");
  const dim = showEstimating || !!unreachable;
  const pingLabel = ping === 0 ? t("playerList.lessThanOneMs") : ping !== null ? t("playerList.pingMs", { ms: Math.round(ping) }) : null;

  const statusNote = measuring
    ? t("playerList.estimating")
    : unreachable
    ? t("playerList.cannotReach")
    : showEstimating
    ? t("playerList.estimating")
    : null;

  const tooltipParts = [
    pingLabel ?? t("playerList.noPingData"),
    statusNote,
    isUnstable ? t("playerList.unstable") : null,
    networkType ?? null,
  ].filter(Boolean);

  return (
    <span
      className="relative inline-flex items-end gap-px cursor-default"
      style={{ height: 11, opacity: dim ? 0.55 : 1 }}
      onMouseEnter={(e) => setRect(e.currentTarget.getBoundingClientRect())}
      onMouseLeave={() => setRect(null)}
    >
      {([1, 2, 3] as const).map((n) => (
        <span
          key={n}
          style={{
            display: "inline-block",
            width: 3,
            height: 3 + n * 2.5,
            borderRadius: 1,
            background: n <= bars ? color : "var(--v2-border)",
            alignSelf: "flex-end",
          }}
        />
      ))}
      {isUnstable && (
        <span
          style={{ fontSize: 8, lineHeight: 1, color: "#fb923c", alignSelf: "flex-end", marginLeft: 1 }}
        >
          ~
        </span>
      )}
      {rect && (
        <span
          className="fixed px-2 py-1 rounded text-[10px] whitespace-nowrap pointer-events-none z-9999"
          style={{
            top: rect.top - 4,
            left: rect.right,
            transform: "translate(-100%, -100%)",
            background: "var(--v2-surface)",
            color: isUnstable ? "#fb923c" : "var(--v2-text)",
            border: "1px solid var(--v2-border)",
            boxShadow: "0 2px 8px rgba(0,0,0,0.4)",
          }}
        >
          {tooltipParts.join(" · ")}
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
  unreachableUids?: ReadonlySet<string>;
  onMeasurePing?: (uid: string) => void;
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
  unreachableUids,
  onMeasurePing,
}: RowProps) {
  const { t } = useTranslation();
  const [hovered, setHovered] = useState(false);
  const expanded = hovered;
  const isMuted = useSettingsStore((s) => s.isUserMuted(user.uid));
  const toggleMutedUser = useSettingsStore((s) => s.toggleMutedUser);

  const { ping, isUnstable, networkType, source } = resolvePing(user, currentUser);

  const streak = showStreak ? (user.winStreak ?? 0) : 0;

  return (
    <div
      className="relative flex items-start gap-2.5 px-3 py-3 border-b transition-colors"
      style={{
        background: hovered ? "var(--v2-hover)" : "transparent",
        borderColor: "var(--v2-border)",
        opacity: !isSelf && isMuted ? 0.5 : 1,
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
              {t("playerList.you")}
            </span>
          )}
          {!isSelf && isMuted && (
            <span
              className="flex items-center gap-0.5 text-[10px] px-1 rounded shrink-0"
              style={{ color: "var(--v2-muted)", background: "color-mix(in srgb, var(--v2-muted) 12%, transparent)" }}
            >
              <BellOff size={9} /> {t("playerList.muted")}
            </span>
          )}
          {user.userTitle?.title && <UserTitle title={user.userTitle} />}
          {/* Searching indicator */}
          {user.isRankQueued && (
            <span
              className="flex items-center gap-0.5 text-[10px] px-1 rounded"
              style={{ color: "#fbbf24", background: "#78350f44" }}
              title={t("playerList.searchingForRankedMatch")}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse inline-block" />
              {t("playerList.searching")}
            </span>
          )}
          <div
            className="flex items-center gap-1.5"
            style={{ flexDirection: "row", alignItems: "flex-end" }}
          >
            {!isSelf && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onMeasurePing?.(user.uid);
                }}
                disabled={!onMeasurePing}
                className="flex items-center"
                style={{ cursor: onMeasurePing ? "pointer" : "default" }}
                title={t("playerList.clickToMeasurePing")}
              >
                {ping !== null || measuringUids?.has(user.uid) || unreachableUids?.has(user.uid) ? (
                  <PingBars
                    ping={ping}
                    isUnstable={isUnstable}
                    networkType={networkType}
                    source={source}
                    measuring={measuringUids?.has(user.uid)}
                    unreachable={unreachableUids?.has(user.uid)}
                  />
                ) : (
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--v2-muted)" }}
                  >
                    {t("playerList.noPingDash")}
                  </span>
                )}
              </button>
            )}
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
                  {t("playerList.elo", { elo: user.accountElo })}
                </span>
                {streak > 0 && (
                  <span
                    className="flex items-center gap-0.5 text-[10px] font-semibold"
                    style={{ color: "#f97316" }}
                  >
                    <Flame size={10} strokeWidth={2.5} />
                    {t("playerList.streakCount", { count: streak })}
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
                        if (!challengeDisabled && !isMuted) onChallenge(user.uid);
                      }}
                      disabled={!!challengeDisabled || isMuted}
                      className="flex items-center gap-1 text-[16px] px-2 py-0.5 rounded font-medium transition-colors"
                      style={{
                        background: challengeDisabled || isMuted ? "var(--v2-hover)" : "var(--v2-accent)",
                        color: challengeDisabled || isMuted ? "var(--v2-muted)" : "var(--v2-accent-fg)",
                        cursor: challengeDisabled || isMuted ? "not-allowed" : "pointer",
                        opacity: challengeDisabled || isMuted ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!challengeDisabled && !isMuted) e.currentTarget.style.background = "var(--v2-accent-hover)";
                      }}
                      onMouseLeave={(e) => {
                        if (!challengeDisabled && !isMuted) e.currentTarget.style.background = "var(--v2-accent)";
                      }}
                      title={
                        isMuted
                          ? t("playerList.unmuteToChallenge")
                          : challengeDisabled
                          ? t("playerList.cannotChallenge")
                          : undefined
                      }
                    >
                      <Swords size={16} /> {t("playerList.challenge")}
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
                      <User size={16} /> {t("playerList.profile")}
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleMutedUser(user.uid);
                    }}
                    className="flex items-center gap-1 text-[16px] px-2 py-0.5 rounded font-medium border transition-colors"
                    style={{
                      background: "transparent",
                      color: "var(--v2-muted)",
                      borderColor: "var(--v2-border)",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--v2-text)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--v2-muted)")}
                    title={isMuted ? t("playerList.unmutePlayer") : t("playerList.mutePlayer")}
                  >
                    <BellOff size={16} /> {isMuted ? t("playerList.unmute") : t("playerList.mute")}
                  </button>
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

function MatchPairRow({
  players,
  currentUserUid,
  onSpectate,
}: {
  players: V2User[];
  currentUserUid?: string;
  onSpectate?: (matchId: string) => void;
}) {
  const { t } = useTranslation();
  const [p1, p2] = players;
  // Never offer to spectate a pairing that includes the viewer themselves — they're either
  // already playing it (nonsensical to also watch) or this is stale local state.
  const canSpectate = !!(onSpectate && p1 && p2 && p1.currentMatchId &&
    p1.uid !== currentUserUid && p2.uid !== currentUserUid);
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
            {p1?.userName ?? t("playerList.unknownPlayer")}
          </span>
        </div>
        <span className="text-[10px] shrink-0 px-0.5" style={{ color: "var(--v2-muted)" }}>{t("playerList.vs")}</span>
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
          <span className="text-[10px]" style={{ color: "var(--v2-muted)" }}>{t("playerList.unknownOpponent")}</span>
        )}
      </div>
      {canSpectate && (
        <button
          onClick={() => onSpectate!(p1.currentMatchId!)}
          className="flex items-center gap-1 text-[10px] px-1.5 py-1 rounded font-medium transition-colors shrink-0"
          style={{ background: "var(--v2-hover)", color: "var(--v2-muted)" }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "var(--v2-text)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "var(--v2-muted)"; }}
          title="Debug: launches this match for real (two local bot processes) plus a third process watching it via the spectate relay."
        >
          <Radio size={10} strokeWidth={2.5} />
          Spectate
        </button>
      )}
    </div>
  );
}

// ── AFK row ────────────────────────────────────────────────────────────────────

function AfkRow({ user }: { user: V2User }) {
  const { t } = useTranslation();
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
          {t("playerList.afk")}
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
  unreachableUids?: ReadonlySet<string>;
  onMeasurePing?: (uid: string) => void;
  onSpectateMatch?: (matchId: string) => void;
};

export function PlayerList({
  users,
  currentUser,
  lobbyGame,
  onViewProfile,
  onChallenge,
  challengeDisabled,
  measuringUids,
  unreachableUids,
  onMeasurePing,
  onSpectateMatch,
}: PlayerListProps) {
  const { t } = useTranslation();
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
          {t("playerList.playersCount", { count: available.length })}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-scroll">
        {isEmpty && (
          <p
            className="text-xs text-center pt-6 px-3"
            style={{ color: "var(--v2-muted)" }}
          >
            {t("playerList.noPlayersInLobby")}
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
              unreachableUids={unreachableUids}
              onMeasurePing={!isSelf ? onMeasurePing : undefined}
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
              {t("playerList.inMatchCount", { count: inMatchCount })}
            </span>
          </div>
          <div className="overflow-y-scroll flex-1 min-h-0">
            {matchPairs.map((players, i) => (
              <MatchPairRow
                key={players[0]?.uid ?? i}
                players={players}
                currentUserUid={currentUser?.uid}
                onSpectate={onSpectateMatch}
              />
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
              {t("playerList.afkCount", { count: afk.length })}
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
