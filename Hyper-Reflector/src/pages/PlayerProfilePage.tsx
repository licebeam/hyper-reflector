import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  RefreshCcw,
  Save,
} from "lucide-react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import api from "../external-api/requests";
import { validateName } from "../utils/validation";
import { auth } from "../utils/firebase";
import type { V2User } from "../types";
import { CountryFlag } from "../components/CountryFlag";
import { UserTitle } from "../components/UserTitle";
import { MeterChart } from "../components/MeterChart";
import { MatchReplay, type ReplayFrame } from "../components/MatchReplay";
import { readPositionReplayFile } from "../utils/matchFiles";

// ── Types ──────────────────────────────────────────────────────────────────────

type SuperArtStats = { wins?: number; losses?: number };
type PlayerCharacterStats = {
  picks: number;
  superChoice?: SuperArtStats[] | Record<string, SuperArtStats>;
};
type PlayerStats = {
  totalWins?: number;
  totalLosses?: number;
  totalGames?: number;
  longestWinStreak?: number;
  winStreak?: number;
  accountElo?: number;
  characters?: Record<string, PlayerCharacterStats>;
};
type MatchCharEntry = { char: string | null; super?: number | null };
type PlayerMatch = {
  id?: string;
  sessionId?: string;
  timestamp?: number;
  player1Name?: string;
  player2Name?: string;
  player1Uid?: string;
  player2Uid?: string;
  p1Wins?: number;
  p2Wins?: number;
  // legacy single-value fields (old sessions)
  player1Char?: string;
  player2Char?: string;
  player1Super?: number;
  player2Super?: number;
  // new array fields (sessions after the update)
  player1Chars?: MatchCharEntry[];
  player2Chars?: MatchCharEntry[];
};
type ProfileData = {
  uid?: string;
  userName?: string;
  accountElo?: number;
  countryCode?: string;
  userTitle?: { bgColor: string; border: string; color: string; title: string };
  userProfilePic?: string;
  knownAliases?: string[];
  winStreak?: number;
  longestWinStreak?: number;
  gravEmail?: string;
  createdAt?: number;
  assignedFlairs?: {
    bgColor: string;
    border: string;
    color: string;
    title: string;
  }[];
};
type TitleOption = {
  bgColor: string;
  border: string;
  color: string;
  title: string;
};

// ── Constants ──────────────────────────────────────────────────────────────────

const SA_COLORS: [string, string, string] = ["#ECC94B", "#ED8936", "#4299E1"];


// ── Helpers ────────────────────────────────────────────────────────────────────

function normalizeSuperChoices(
  choice?: PlayerCharacterStats["superChoice"],
): SuperArtStats[] {
  if (!choice) return [];
  if (Array.isArray(choice)) return choice;
  const result: SuperArtStats[] = [];
  for (const [key, val] of Object.entries(choice)) {
    const idx = parseInt(key, 10);
    if (!isNaN(idx) && idx >= 0 && idx <= 2) result[idx] = val;
  }
  return result;
}


// ── Sub-components ─────────────────────────────────────────────────────────────

function Avatar({ user }: { user: ProfileData }) {
  const [failed, setFailed] = useState(false);
  const show = !!user.userProfilePic && !failed;
  return (
    <div
      className="w-20 h-20 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-xl font-bold"
      style={{ background: "var(--v2-accent)", color: "var(--v2-accent-fg)" }}
    >
      {show ? (
        <img
          src={user.userProfilePic}
          alt=""
          className="w-full h-full object-cover"
          onError={() => setFailed(true)}
        />
      ) : (
        (user.userName || "?").slice(0, 2).toUpperCase()
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div
      className="rounded-lg p-4 border"
      style={{
        background: "var(--v2-surface)",
        borderColor: "var(--v2-border)",
      }}
    >
      <p className="text-xs mb-1" style={{ color: "var(--v2-muted)" }}>
        {label}
      </p>
      <p className="text-xl font-bold" style={{ color: "var(--v2-accent)" }}>
        {value}
      </p>
    </div>
  );
}


function CharSADonut({
  name,
  stats,
}: {
  name: string;
  stats: PlayerCharacterStats;
}) {
  const superChoices = normalizeSuperChoices(stats.superChoice);
  const data = [0, 1, 2].map((i) => {
    const e = superChoices[i];
    return {
      name: `SA ${i + 1}`,
      value: (e?.wins || 0) + (e?.losses || 0),
      color: SA_COLORS[i],
    };
  });
  const hasData = data.some((d) => d.value > 0);
  return (
    <div
      className="flex flex-col items-center gap-2 rounded-lg border p-4"
      style={{
        background: "var(--v2-surface)",
        borderColor: "var(--v2-border)",
      }}
    >
      <p className="text-xs font-semibold" style={{ color: "var(--v2-text)" }}>
        {name}
      </p>
      {hasData ? (
        <div className="w-28 h-28">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Tooltip
                contentStyle={{
                  background: "var(--v2-surface)",
                  border: "1px solid var(--v2-border)",
                  borderRadius: "6px",
                  fontSize: "11px",
                }}
                itemStyle={{ color: "var(--v2-text)" }}
                cursor={false}
              />
              <Pie
                innerRadius={32}
                outerRadius={48}
                isAnimationActive={false}
                data={data}
                dataKey="value"
              >
                {data.map((item) => (
                  <Cell key={item.name} fill={item.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      ) : (
        <p className="text-xs py-4" style={{ color: "var(--v2-muted)" }}>
          —
        </p>
      )}
      <p className="text-xs" style={{ color: "var(--v2-muted)" }}>
        {stats.picks || 0} picks
      </p>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type PlayerProfilePageProps = {
  profileUid: string;
  currentUser: V2User | null;
  onBack: () => void;
  onUserUpdated?: (updated: Partial<V2User>) => void;
  onNavigateToProfile?: (uid: string) => void;
};

export function PlayerProfilePage({
  profileUid,
  currentUser,
  onBack,
  onUserUpdated,
  onNavigateToProfile,
}: PlayerProfilePageProps) {
  const isSelf = !!currentUser && currentUser.uid === profileUid;
  const canEdit = isSelf;

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStats | null>(null);
  const [titles, setTitles] = useState<TitleOption[]>([]);
  const [matches, setMatches] = useState<PlayerMatch[]>([]);
  const [matchCursor, setMatchCursor] = useState<{
    last?: string | null;
    first?: string | null;
  }>({});
  const [profileLoading, setProfileLoading] = useState(true);
  const [matchesLoading, setMatchesLoading] = useState(false);
  const [charOpen, setCharOpen] = useState(false);
  const [matchesOpen, setMatchesOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameInvalid, setNameInvalid] = useState(false);
  const [pendingTitle, setPendingTitle] = useState<TitleOption | null>(null);
  const [gravEmailDraft, setGravEmailDraft] = useState("");
  const [gravEmailEditing, setGravEmailEditing] = useState(false);
  const [titlePickerOpen, setTitlePickerOpen] = useState(false);
  const [expandedMatchId, setExpandedMatchId] = useState<string | null>(null);
  const [matchDetailCache, setMatchDetailCache] = useState<Record<string, unknown>>({});
  const [fetchingMatchId, setFetchingMatchId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [replayFrames, setReplayFrames] = useState<ReplayFrame[] | null>(null);

  // ── Load profile ─────────────────────────────────────────────────────────────

  const loadProfile = useCallback(async () => {
    if (!auth.currentUser) return;
    setProfileLoading(true);
    setPlayerStats(null);
    setMatches([]);
    setMatchCursor({});
    setGravEmailEditing(false);
    setTitlePickerOpen(false);
    setSaveError(null);
    setExpandedMatchId(null);
    setMatchDetailCache({});
    try {
      const [userData, statsData, titlesData] = await Promise.all([
        api.getUserData(auth, profileUid),
        api.getPlayerStats(auth, profileUid),
        canEdit ? api.getAllTitles(auth, profileUid) : Promise.resolve(null),
      ]);
      if (userData) {
        const p = userData as ProfileData;
        setProfile(p);
        setNameDraft(p.userName || "");
        setPendingTitle(p.userTitle || null);
        setGravEmailDraft(p.gravEmail || "");
      }
      if (statsData?.playerStatSet)
        setPlayerStats(statsData.playerStatSet as PlayerStats);
      else if (statsData) setPlayerStats(statsData as PlayerStats);

      if (canEdit) {
        const serverTitles: TitleOption[] = Array.isArray(
          titlesData?.titleData?.titles,
        )
          ? (titlesData.titleData.titles as TitleOption[])
          : [];
        const assignedFlairs: TitleOption[] = Array.isArray(
          (userData as ProfileData)?.assignedFlairs,
        )
          ? (userData as ProfileData).assignedFlairs!
          : [];
        const merged: TitleOption[] = [...serverTitles];
        const seen = new Set(serverTitles.map((t) => t.title));
        for (const f of assignedFlairs) {
          if (!seen.has(f.title)) {
            merged.push(f);
            seen.add(f.title);
          }
        }
        setTitles(merged);
      }
    } catch (err) {
      console.error("[v2] PlayerProfilePage: loadProfile failed", err);
    } finally {
      setProfileLoading(false);
    }
  }, [profileUid, canEdit]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  // ── Load matches ─────────────────────────────────────────────────────────────

  // Cursors passed explicitly so this callback is stable and doesn't re-trigger effects
  const fetchMatches = useCallback(
    async (
      direction: "initial" | "next" | "prev",
      cursorLast: string | null | undefined,
      cursorFirst: string | null | undefined,
    ) => {
      if (!auth.currentUser) return;
      setMatchesLoading(true);
      try {
        const nextCursor = direction === "next" ? (cursorLast ?? null) : null;
        const prevCursor = direction === "prev" ? (cursorFirst ?? null) : null;
        const res = await (
          api.getUserMatches as unknown as (
            auth: unknown,
            uid: string,
            last?: string | null,
            first?: string | null,
          ) => Promise<any>
        )(auth, profileUid, nextCursor, prevCursor);
        if (res?.matches) {
          setMatches(res.matches as PlayerMatch[]);
          setMatchCursor({ last: res.lastVisible, first: res.firstVisible });
        } else if (direction === "initial") {
          setMatches([]);
          setMatchCursor({});
        }
      } catch (err) {
        console.error("[v2] PlayerProfilePage: fetchMatches failed", err);
      } finally {
        setMatchesLoading(false);
      }
    },
    [profileUid],
  );

  useEffect(() => {
    if (matchesOpen && matches.length === 0)
      void fetchMatches("initial", null, null);
  }, [matchesOpen, fetchMatches, matches.length]);

  useEffect(() => {
    if (!matchesOpen || replayFrames) return;
    void readPositionReplayFile().then((raw) => {
      if (!raw) return;
      try {
        const data = JSON.parse(raw);
        if (Array.isArray(data?.frames) && data.frames.length > 0) {
          const rawFrames = data.frames as unknown[][];
          const parsed: ReplayFrame[] = rawFrames.map((f) => ({
            p1x: f[0] as number, p1y: f[1] as number,
            p2x: f[2] as number, p2y: f[3] as number,
            p1hp:      (f[4]  as number) ?? null,
            p2hp:      (f[5]  as number) ?? null,
            p1sa:      (f[6]  as number) ?? null,
            p2sa:      (f[7]  as number) ?? null,
            projs:     Array.isArray(f[8]) ? f[8] as [number, number][] : [],
            p1stun:    (f[9]  as number) ?? null,
            p2stun:    (f[10] as number) ?? null,
            p1stunMax: (f[11] as number) ?? null,
            p2stunMax: (f[12] as number) ?? null,
            p1dizzy:   false,
            p2dizzy:   false,
            p1crouch:  (f[17] as number) === 32 || (f[17] as number) === 33,
            p2crouch:  (f[18] as number) === 32 || (f[18] as number) === 33,
          }));
          // Stateful dizzy detection — mirrors effie's is_stunned logic:
          // set when stun_activate fires (=1) or stun_timer is counting down (1-249)
          // clear when stun_timer hits 0 or resets to >=250 and activate is not firing
          let p1Dizzy = false, p2Dizzy = false;
          for (let i = 0; i < rawFrames.length; i++) {
            const f = rawFrames[i];
            const p1Timer    = f[13] as number;
            const p2Timer    = f[14] as number;
            const p1Activate = f[15] as number;
            const p2Activate = f[16] as number;
            if (p1Activate === 1 || (p1Timer > 0 && p1Timer < 250)) p1Dizzy = true;
            if (p2Activate === 1 || (p2Timer > 0 && p2Timer < 250)) p2Dizzy = true;
            if (p1Dizzy && p1Activate !== 1 && (p1Timer === 0 || p1Timer >= 250)) p1Dizzy = false;
            if (p2Dizzy && p2Activate !== 1 && (p2Timer === 0 || p2Timer >= 250)) p2Dizzy = false;
            parsed[i].p1dizzy = p1Dizzy;
            parsed[i].p2dizzy = p2Dizzy;
          }
          // Latch HP at 0 once a player is KO'd — prevents spurious reset during KO animation
          let p1Dead = false, p2Dead = false;
          for (const frame of parsed) {
            if (frame.p1hp === 0) p1Dead = true;
            if (frame.p2hp === 0) p2Dead = true;
            if (p1Dead) frame.p1hp = 0;
            if (p2Dead) frame.p2hp = 0;
          }
          setReplayFrames(parsed);
        }
      } catch { /* ignore malformed file */ }
    });
  }, [matchesOpen, replayFrames]);

  // ── Name validation ───────────────────────────────────────────────────────────

  const [nameError, setNameError] = useState<string | null>(null);

  useEffect(() => {
    const error = validateName(nameDraft)
    setNameInvalid(error !== null);
    setNameError(error);
  }, [nameDraft]);

  // ── Derived ───────────────────────────────────────────────────────────────────

  const winStats = useMemo(() => {
    const totalGames = playerStats?.totalGames ?? 0;
    const totalWins = playerStats?.totalWins ?? 0;
    const totalLosses = playerStats?.totalLosses ?? 0;
    const winRate =
      totalGames > 0 ? ((totalWins / totalGames) * 100).toFixed(1) : "0.0";
    return { totalGames, totalWins, totalLosses, winRate };
  }, [playerStats]);

  const characterEntries = useMemo(() => {
    if (!playerStats?.characters) return [];
    return Object.entries(playerStats.characters).sort(
      (a, b) => (b[1]?.picks || 0) - (a[1]?.picks || 0),
    );
  }, [playerStats]);

  const elo = playerStats?.accountElo ?? profile?.accountElo;
  const displayElo = elo !== undefined && elo !== null ? Math.round(elo) : null;

  // ── Save ──────────────────────────────────────────────────────────────────────

  const saveProfile = async () => {
    if (!canEdit || !profile || !auth.currentUser) return;
    const payload: Record<string, unknown> = {};
    const trimName = nameDraft.trim();
    if (!nameInvalid && trimName && trimName !== profile.userName)
      payload.userName = trimName;
    if (pendingTitle && pendingTitle.title !== profile.userTitle?.title)
      payload.userTitle = pendingTitle;
    const trimGravEmail = gravEmailDraft.trim();
    if (gravEmailEditing && trimGravEmail !== (profile.gravEmail ?? ""))
      payload.gravEmail = trimGravEmail;
    if (!Object.keys(payload).length) return;
    setSaving(true);
    setSaveError(null);
    try {
      await api.updateUserData(auth, payload);
      setProfile((prev) => (prev ? { ...prev, ...payload } : prev));
      setGravEmailEditing(false);
      onUserUpdated?.(payload as Partial<V2User>);
    } catch (err) {
      console.error("[v2] PlayerProfilePage: saveProfile failed", err);
      setSaveError("Update failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  // ── Match expand ─────────────────────────────────────────────────────────────

  const toggleMatchExpand = async (matchId: string) => {
    if (expandedMatchId === matchId) {
      setExpandedMatchId(null);
      return;
    }
    setExpandedMatchId(matchId);
    if (matchDetailCache[matchId]) return;
    setFetchingMatchId(matchId);
    try {
      const result = await (api.getGlobalSet as any)(auth, profileUid, matchId);
      if (result?.globalSet) {
        setMatchDetailCache((prev) => ({ ...prev, [matchId]: result.globalSet }));
      }
    } finally {
      setFetchingMatchId(null);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────────


  return (
    <div className="h-full overflow-y-scroll">
      <div className="max-w-3xl mx-auto p-6 space-y-5">
        {/* Nav */}
        <div className="flex items-center justify-between">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm transition-colors"
            style={{ color: "var(--v2-muted)" }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.color = "var(--v2-text)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.color = "var(--v2-muted)")
            }
          >
            <ArrowLeft size={14} /> Back to profiles
          </button>
          <button
            onClick={() => void loadProfile()}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded border transition-colors"
            style={{
              borderColor: "var(--v2-border)",
              color: "var(--v2-muted)",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "var(--v2-hover)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "transparent")
            }
          >
            <RefreshCcw size={12} /> Refresh
          </button>
        </div>

        {/* Profile card */}
        <div
          className="rounded-lg border p-5"
          style={{
            background: "var(--v2-surface)",
            borderColor: "var(--v2-border)",
          }}
        >
          {profileLoading ? (
            <div className="flex justify-center py-10">
              <div
                className="w-7 h-7 rounded-full border-2 border-t-transparent animate-spin"
                style={{
                  borderColor: "var(--v2-accent)",
                  borderTopColor: "transparent",
                }}
              />
            </div>
          ) : profile ? (
            <div className="space-y-5">
              {/* Avatar + identity */}
              <div className="flex gap-5 flex-wrap">
                <Avatar user={profile} />
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1
                      className="text-xl font-bold"
                      style={{ color: "var(--v2-text)" }}
                    >
                      {profile.userName}
                    </h1>
                    <CountryFlag code={profile.countryCode} />
                    {isSelf && (
                      <span
                        className="text-xs"
                        style={{ color: "var(--v2-muted)" }}
                      >
                        (you)
                      </span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: "var(--v2-muted)" }}>
                    Joined {profile.createdAt ? new Date(profile.createdAt).toLocaleDateString() : "unknown"}
                  </p>
                  <UserTitle title={profile.userTitle} size="sm" />
                  <div
                    className="flex items-center gap-3 text-xs"
                    style={{ color: "var(--v2-muted)" }}
                  >
                    {displayElo !== null && <span>ELO {displayElo}</span>}
                    {(profile.winStreak ?? 0) > 0 && (
                      <span>🔥 {profile.winStreak} win streak</span>
                    )}
                  </div>
                  {Array.isArray(profile.knownAliases) &&
                    profile.knownAliases.length > 0 && (
                      <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--v2-muted)" }}>
                        aka {profile.knownAliases[profile.knownAliases.length - 1]}
                        {profile.knownAliases.length > 1 && (
                          <span
                            className="text-xs px-1 py-0.5 rounded border"
                            style={{
                              borderColor: "var(--v2-border)",
                              color: "var(--v2-muted)",
                              cursor: "default",
                            }}
                            title={profile.knownAliases.slice(0, -1).join(", ")}
                          >
                            +{profile.knownAliases.length - 1}
                          </span>
                        )}
                      </p>
                    )}
                </div>

                {/* Edit panel (self only) */}
                {canEdit && (
                  <div className="w-full sm:w-64 space-y-3 pt-1">
                    <div>
                      <label
                        className="text-xs font-medium block mb-1"
                        style={{ color: "var(--v2-muted)" }}
                      >
                        Display name
                      </label>
                      <input
                        type="text"
                        value={nameDraft}
                        maxLength={16}
                        onChange={(e) => setNameDraft(e.target.value)}
                        className="w-full rounded px-3 py-1.5 text-sm border outline-none transition-colors"
                        style={{
                          background: "var(--v2-hover)",
                          borderColor: nameInvalid
                            ? "#f87171"
                            : "var(--v2-border)",
                          color: "var(--v2-text)",
                        }}
                        onFocus={(e) =>
                          (e.currentTarget.style.borderColor = nameInvalid
                            ? "#f87171"
                            : "var(--v2-accent)")
                        }
                        onBlur={(e) =>
                          (e.currentTarget.style.borderColor = nameInvalid
                            ? "#f87171"
                            : "var(--v2-border)")
                        }
                      />
                      {nameInvalid && nameError && (
                        <p
                          className="text-xs mt-0.5"
                          style={{ color: "#f87171" }}
                        >
                          {nameError}
                        </p>
                      )}
                    </div>

                    <div>
                      <label
                        className="text-xs font-medium block mb-1"
                        style={{ color: "var(--v2-muted)" }}
                      >
                        Gravatar email
                      </label>
                      {gravEmailEditing ? (
                        <input
                          type="email"
                          value={gravEmailDraft}
                          onChange={(e) => setGravEmailDraft(e.target.value)}
                          placeholder="you@example.com"
                          autoFocus
                          className="w-full rounded px-3 py-1.5 text-sm border outline-none transition-colors"
                          style={{
                            background: "var(--v2-hover)",
                            borderColor: "var(--v2-border)",
                            color: "var(--v2-text)",
                          }}
                          onFocus={(e) => (e.currentTarget.style.borderColor = "var(--v2-accent)")}
                          onBlur={(e) => (e.currentTarget.style.borderColor = "var(--v2-border)")}
                          onKeyDown={(e) => { if (e.key === "Escape") { setGravEmailDraft(profile?.gravEmail || ""); setGravEmailEditing(false); } }}
                        />
                      ) : (
                        <div
                          className="flex items-center justify-between gap-2 rounded px-3 py-1.5 border cursor-pointer"
                          style={{ background: "var(--v2-hover)", borderColor: "var(--v2-border)" }}
                          onClick={() => setGravEmailEditing(true)}
                        >
                          <span className="text-sm" style={{ color: profile?.gravEmail ? "var(--v2-text)" : "var(--v2-muted)" }}>
                            {profile?.gravEmail ? "••••••••••••" : "Not set"}
                          </span>
                          <span className="text-xs shrink-0" style={{ color: "var(--v2-muted)" }}>Edit</span>
                        </div>
                      )}
                    </div>

                    {titles.length > 0 && (
                      <div>
                        <label
                          className="text-xs font-medium block mb-1"
                          style={{ color: "var(--v2-muted)" }}
                        >
                          Title flair
                        </label>
                        <div className="flex items-center gap-2">
                          {pendingTitle?.title ? (
                            <UserTitle title={pendingTitle} size="sm" />
                          ) : (
                            <span
                              className="text-xs"
                              style={{ color: "var(--v2-muted)" }}
                            >
                              None
                            </span>
                          )}
                          <button
                            onClick={() => setTitlePickerOpen((p) => !p)}
                            className="text-xs px-2 py-0.5 rounded border transition-colors"
                            style={{
                              borderColor: "var(--v2-border)",
                              color: "var(--v2-muted)",
                            }}
                            onMouseEnter={(e) =>
                              (e.currentTarget.style.background =
                                "var(--v2-hover)")
                            }
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background = "transparent")
                            }
                          >
                            Change
                          </button>
                        </div>
                        {titlePickerOpen && (
                          <div
                            className="mt-2 rounded border p-2 space-y-1 max-h-40 overflow-y-auto"
                            style={{
                              background: "var(--v2-hover)",
                              borderColor: "var(--v2-border)",
                            }}
                          >
                            {titles.map((t) => (
                              <button
                                key={t.title}
                                onClick={() => {
                                  setPendingTitle(t);
                                  setTitlePickerOpen(false);
                                }}
                                className="w-full text-left px-2 py-1 rounded text-xs transition-colors"
                                style={{
                                  background:
                                    pendingTitle?.title === t.title
                                      ? t.bgColor
                                      : "transparent",
                                  color:
                                    pendingTitle?.title === t.title
                                      ? t.color
                                      : "var(--v2-text)",
                                  border: `1 px solid ${
                                    pendingTitle?.title === t.title
                                      ? t.color
                                      : "var(--v2-text)"
                                  }`,
                                }}
                                onMouseEnter={(e) => {
                                  if (pendingTitle?.title !== t.title)
                                    (
                                      e.currentTarget as HTMLElement
                                    ).style.background = "var(--v2-surface)";
                                }}
                                onMouseLeave={(e) => {
                                  if (pendingTitle?.title !== t.title)
                                    (
                                      e.currentTarget as HTMLElement
                                    ).style.background = "transparent";
                                }}
                              >
                                <UserTitle title={t} size="sm" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {saveError && (
                      <p className="text-xs" style={{ color: "#f87171" }}>
                        {saveError}
                      </p>
                    )}

                    <button
                      onClick={() => void saveProfile()}
                      disabled={saving || nameInvalid}
                      className="flex items-center gap-1.5 w-full justify-center py-1.5 rounded text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{
                        background: "var(--v2-accent)",
                        color: "var(--v2-accent-fg)",
                      }}
                      onMouseEnter={(e) => {
                        if (!saving)
                          (e.currentTarget as HTMLElement).style.background =
                            "var(--v2-accent-hover)";
                      }}
                      onMouseLeave={(e) =>
                        ((e.currentTarget as HTMLElement).style.background =
                          "var(--v2-accent)")
                      }
                    >
                      <Save size={13} />
                      {saving ? "Saving…" : "Save profile"}
                    </button>
                  </div>
                )}
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatCard label="Total games" value={winStats.totalGames} />
                <StatCard label="Wins" value={winStats.totalWins} />
                <StatCard label="Losses" value={winStats.totalLosses} />
                <StatCard label="Win rate" value={`${winStats.winRate}%`} />
              </div>
            </div>
          ) : (
            <p className="text-sm py-4" style={{ color: "var(--v2-muted)" }}>
              Profile unavailable.
            </p>
          )}
        </div>

        {/* Character usage */}
        <div
          className="rounded-lg border"
          style={{
            background: "var(--v2-surface)",
            borderColor: "var(--v2-border)",
          }}
        >
          <button
            onClick={() => setCharOpen((p) => !p)}
            className="w-full flex items-center justify-between px-5 py-3 text-left"
          >
            <span
              className="text-sm font-semibold"
              style={{ color: "var(--v2-text)" }}
            >
              Character usage
            </span>
            {charOpen ? (
              <ChevronUp size={14} style={{ color: "var(--v2-muted)" }} />
            ) : (
              <ChevronDown size={14} style={{ color: "var(--v2-muted)" }} />
            )}
          </button>
          {charOpen && (
            <div className="px-5 pb-5">
              {characterEntries.length === 0 ? (
                <p className="text-xs" style={{ color: "var(--v2-muted)" }}>
                  No character data available yet.
                </p>
              ) : (
                <>
                  {/* SA legend */}
                  <div className="flex gap-4 mb-4">
                    {(["SA1", "SA2", "SA3"] as const).map((sa, i) => (
                      <div key={sa} className="flex items-center gap-1.5">
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{ background: SA_COLORS[i] }}
                        />
                        <span
                          className="text-xs"
                          style={{ color: "var(--v2-muted)" }}
                        >
                          {sa}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {characterEntries.map(([name, stats]) => (
                      <CharSADonut key={name} name={name} stats={stats} />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Recent matches */}
        <div
          className="rounded-lg border"
          style={{
            background: "var(--v2-surface)",
            borderColor: "var(--v2-border)",
          }}
        >
          <div
            className="flex items-center justify-between px-5 py-3 border-b"
            style={{ borderColor: "var(--v2-border)" }}
          >
            <button
              onClick={() => setMatchesOpen((p) => !p)}
              className="flex items-center gap-2 text-sm font-semibold flex-1 text-left"
              style={{ color: "var(--v2-text)" }}
            >
              Recent matches
              {matchesOpen ? (
                <ChevronUp size={14} style={{ color: "var(--v2-muted)" }} />
              ) : (
                <ChevronDown size={14} style={{ color: "var(--v2-muted)" }} />
              )}
            </button>
            {matchesOpen && (
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    void fetchMatches(
                      "prev",
                      matchCursor.last,
                      matchCursor.first,
                    )
                  }
                  disabled={!matchCursor.first || matchesLoading}
                  className="text-xs px-2 py-1 rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    borderColor: "var(--v2-border)",
                    color: "var(--v2-muted)",
                  }}
                  onMouseEnter={(e) => {
                    if (!matchesLoading && matchCursor.first)
                      (e.currentTarget as HTMLElement).style.background =
                        "var(--v2-hover)";
                  }}
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "transparent")
                  }
                >
                  Newer
                </button>
                <button
                  onClick={() =>
                    void fetchMatches(
                      "next",
                      matchCursor.last,
                      matchCursor.first,
                    )
                  }
                  disabled={!matchCursor.last || matchesLoading}
                  className="text-xs px-2 py-1 rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    borderColor: "var(--v2-border)",
                    color: "var(--v2-muted)",
                  }}
                  onMouseEnter={(e) => {
                    if (!matchesLoading && matchCursor.last)
                      (e.currentTarget as HTMLElement).style.background =
                        "var(--v2-hover)";
                  }}
                  onMouseLeave={(e) =>
                    ((e.currentTarget as HTMLElement).style.background =
                      "transparent")
                  }
                >
                  Older
                </button>
              </div>
            )}
          </div>
          {matchesOpen && (
            <div className="p-4 space-y-2">
              {replayFrames && replayFrames.length > 0 && (
                <div
                  className="rounded border p-2 space-y-1"
                  style={{ borderColor: "var(--v2-border)" }}
                >
                  <p className="text-xs font-medium" style={{ color: "var(--v2-muted)" }}>Last game — position replay</p>
                  <MatchReplay frames={replayFrames} />
                </div>
              )}
              {matchesLoading ? (
                <div className="flex justify-center py-4">
                  <div
                    className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                    style={{
                      borderColor: "var(--v2-accent)",
                      borderTopColor: "transparent",
                    }}
                  />
                </div>
              ) : matches.length === 0 ? (
                <p
                  className="text-xs py-2"
                  style={{ color: "var(--v2-muted)" }}
                >
                  No matches recorded yet.
                </p>
              ) : (
                matches.map((match, i) => {
                  const matchKey = match.sessionId || match.id || `${i}`;
                  const date = match.timestamp
                    ? new Date(match.timestamp).toLocaleString()
                    : "Unknown";
                  const isExpanded = expandedMatchId === matchKey;
                  const isFetching = fetchingMatchId === matchKey;
                  const detail = matchDetailCache[matchKey];
                  return (
                    <div
                      key={match.id ?? `${match.sessionId}-${i}`}
                      className="rounded border overflow-hidden"
                      style={{ borderColor: "var(--v2-border)" }}
                    >
                      <button
                        className="w-full text-left p-3 transition-colors"
                        style={{ background: "transparent" }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = "var(--v2-hover)")}
                        onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        onClick={() => void toggleMatchExpand(matchKey)}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs" style={{ color: "var(--v2-muted)" }}>{date}</span>
                          {isExpanded
                            ? <ChevronUp size={12} style={{ color: "var(--v2-muted)" }} />
                            : <ChevronDown size={12} style={{ color: "var(--v2-muted)" }} />
                          }
                        </div>
                        <div className="flex items-center">
                          <div className="flex-1">
                            {match.player1Uid && onNavigateToProfile ? (
                              <button
                                className="text-sm font-semibold text-left hover:underline"
                                style={{ color: "var(--v2-accent)" }}
                                onClick={(e) => { e.stopPropagation(); onNavigateToProfile(match.player1Uid!); }}
                              >
                                {match.player1Name || "Player 1"}
                              </button>
                            ) : (
                              <p className="text-sm font-semibold" style={{ color: "var(--v2-text)" }}>
                                {match.player1Name || "Player 1"}
                              </p>
                            )}
                            {(() => {
                              const chars = (match.player1Chars?.length
                                ? match.player1Chars
                                : match.player1Char
                                  ? [{ char: match.player1Char, super: match.player1Super }]
                                  : []
                              ).filter((c) => c.char);
                              if (!chars.length) return null;
                              const first = chars[0];
                              const rest = chars.slice(1);
                              return (
                                <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--v2-accent)" }}>
                                  {first.char}{first.super != null ? ` SA${first.super + 1}` : ""}
                                  {rest.length > 0 && (
                                    <span
                                      className="text-xs px-1 py-0.5 rounded border"
                                      style={{ borderColor: "var(--v2-border)", color: "var(--v2-muted)", cursor: "default" }}
                                      title={rest.map((c) => `${c.char}${c.super != null ? ` SA${c.super + 1}` : ""}`).join(", ")}
                                    >
                                      +{rest.length}
                                    </span>
                                  )}
                                </p>
                              );
                            })()}
                            <p className="text-xs" style={{ color: "var(--v2-muted)" }}>
                              Wins: {match.p1Wins ?? 0}
                            </p>
                          </div>
                          <span className="w-8 text-center text-xs shrink-0" style={{ color: "var(--v2-muted)" }}>
                            vs
                          </span>
                          <div className="flex-1 text-right">
                            {match.player2Uid && onNavigateToProfile ? (
                              <button
                                className="text-sm font-semibold w-full text-right hover:underline"
                                style={{ color: "var(--v2-accent)" }}
                                onClick={(e) => { e.stopPropagation(); onNavigateToProfile(match.player2Uid!); }}
                              >
                                {match.player2Name || "Player 2"}
                              </button>
                            ) : (
                              <p className="text-sm font-semibold" style={{ color: "var(--v2-text)" }}>
                                {match.player2Name || "Player 2"}
                              </p>
                            )}
                            {(() => {
                              const chars = (match.player2Chars?.length
                                ? match.player2Chars
                                : match.player2Char
                                  ? [{ char: match.player2Char, super: match.player2Super }]
                                  : []
                              ).filter((c) => c.char);
                              if (!chars.length) return null;
                              const first = chars[0];
                              const rest = chars.slice(1);
                              return (
                                <p className="text-xs flex items-center gap-1.5 justify-end" style={{ color: "var(--v2-accent)" }}>
                                  {first.char}{first.super != null ? ` SA${first.super + 1}` : ""}
                                  {rest.length > 0 && (
                                    <span
                                      className="text-xs px-1 py-0.5 rounded border"
                                      style={{ borderColor: "var(--v2-border)", color: "var(--v2-muted)", cursor: "default" }}
                                      title={rest.map((c) => `${c.char}${c.super != null ? ` SA${c.super + 1}` : ""}`).join(", ")}
                                    >
                                      +{rest.length}
                                    </span>
                                  )}
                                </p>
                              );
                            })()}
                            <p className="text-xs" style={{ color: "var(--v2-muted)" }}>
                              Wins: {match.p2Wins ?? 0}
                            </p>
                          </div>
                        </div>
                      </button>
                      {isExpanded && (
                        <div
                          className="border-t px-3 py-3 space-y-2"
                          style={{ borderColor: "var(--v2-border)", background: "var(--v2-hover)" }}
                        >
                          <p className="text-xs font-medium" style={{ color: "var(--v2-muted)" }}>
                            Session {match.sessionId || "unknown"}
                          </p>
                          {isFetching ? (
                            <div className="flex justify-center py-3">
                              <div
                                className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin"
                                style={{ borderColor: "var(--v2-accent)", borderTopColor: "transparent" }}
                              />
                            </div>
                          ) : detail ? (
                            <>
                              {Array.isArray(detail.matches) && detail.matches.map((m: any, i: number) => {
                                let parsed: any = null;
                                try { parsed = JSON.parse(m.matchData?.raw ?? ""); } catch { /* unparseable */ }
                                const toArr = (v: any): number[] =>
                                  Array.isArray(v) ? v : typeof v === "number" ? [v] : [];
                                const p1Meter = toArr(parsed?.["p1-meter-gained"]);
                                const p2Meter = toArr(parsed?.["p2-meter-gained"]);
                                const p1Wins = m.result === "1";
                                const p1Super = m.player1Super != null ? ` SA${m.player1Super + 1}` : "";
                                const p2Super = m.player2Super != null ? ` SA${m.player2Super + 1}` : "";
                                const p1Knockdowns = parsed?.["p1-knockdowns"] ?? null;
                                const p2Knockdowns = parsed?.["p2-knockdowns"] ?? null;
                                const p1FastWakeups = parsed?.["p1-fast-wakeups"] ?? null;
                                const p2FastWakeups = parsed?.["p2-fast-wakeups"] ?? null;
                                const p1Parries = parsed?.["p1-parries"] ?? null;
                                const p2Parries = parsed?.["p2-parries"] ?? null;
                                const p1Throws = parsed?.["p1-throws"] ?? null;
                                const p2Throws = parsed?.["p2-throws"] ?? null;
                                const p1SupersUsed = parsed?.["p1-supers-used"] ?? null;
                                const p2SupersUsed = parsed?.["p2-supers-used"] ?? null;
                                const p1ThrowTechs = parsed?.["p1-throw-techs"] ?? null;
                                const p2ThrowTechs = parsed?.["p2-throw-techs"] ?? null;
                                const p1ThrowWhiffs = parsed?.["p1-throw-whiffs"] ?? null;
                                const p2ThrowWhiffs = parsed?.["p2-throw-whiffs"] ?? null;
                                const hasKdData = p1Knockdowns !== null || p2Knockdowns !== null;
                                const hasFwData = p1FastWakeups !== null || p2FastWakeups !== null;
                                const hasParryData = p1Parries !== null || p2Parries !== null;
                                const hasThrowData = p1Throws !== null || p2Throws !== null;
                                const hasSuperData = p1SupersUsed !== null || p2SupersUsed !== null;
                                const hasTechData = p1ThrowTechs !== null || p2ThrowTechs !== null;
                                const hasWhiffData = p1ThrowWhiffs !== null || p2ThrowWhiffs !== null;
                                return (
                                  <div
                                    key={i}
                                    className="rounded border p-2 space-y-1"
                                    style={{ borderColor: "var(--v2-border)" }}
                                  >
                                    <div className="flex items-center justify-between text-xs">
                                      <span style={{ color: "var(--v2-muted)" }}>Game {i + 1}</span>
                                      <div className="flex items-center gap-3">
                                        <span style={{ color: p1Wins ? "var(--v2-accent)" : "var(--v2-muted)" }}>
                                          {m.player1Char || "?"}{p1Super}
                                        </span>
                                        <span style={{ color: "var(--v2-muted)" }}>vs</span>
                                        <span style={{ color: !p1Wins ? "var(--v2-accent)" : "var(--v2-muted)" }}>
                                          {m.player2Char || "?"}{p2Super}
                                        </span>
                                      </div>
                                    </div>
                                    {(p1Meter.length >= 2 || p2Meter.length >= 2) && (
                                      <div>
                                        <p className="text-xs mb-0.5" style={{ color: "var(--v2-muted)" }}>Meter build</p>
                                        <MeterChart
                                          p1Samples={p1Meter}
                                          p2Samples={p2Meter}
                                          p1Color={p1Wins ? "var(--v2-accent)" : "var(--v2-muted)"}
                                          p2Color={!p1Wins ? "var(--v2-accent)" : "var(--v2-muted)"}
                                        />
                                        <div className="flex gap-3 mt-0.5">
                                          <span className="text-xs flex items-center gap-1">
                                            <span className="inline-block w-2 h-0.5 rounded" style={{ background: p1Wins ? "var(--v2-accent)" : "var(--v2-muted)" }} />
                                            <span style={{ color: "var(--v2-muted)" }}>{detail.player1Name || "P1"} ({parsed?.["p1-total-meter-gained"] ?? "—"})</span>
                                          </span>
                                          <span className="text-xs flex items-center gap-1">
                                            <span className="inline-block w-2 h-0.5 rounded" style={{ background: !p1Wins ? "var(--v2-accent)" : "var(--v2-muted)" }} />
                                            <span style={{ color: "var(--v2-muted)" }}>{detail.player2Name || "P2"} ({parsed?.["p2-total-meter-gained"] ?? "—"})</span>
                                          </span>
                                        </div>
                                      </div>
                                    )}
                                    {(hasKdData || hasFwData) && (
                                      <div
                                        className="grid grid-cols-2 gap-x-4 gap-y-0.5 pt-1 mt-1 border-t text-xs"
                                        style={{ borderColor: "var(--v2-border)" }}
                                      >
                                        {hasKdData && (
                                          <>
                                            <span style={{ color: "var(--v2-muted)" }}>
                                              Times knocked down
                                            </span>
                                            <span className="text-right" style={{ color: "var(--v2-muted)" }}>
                                              <span style={{ color: p1Wins ? "var(--v2-accent)" : "var(--v2-muted)" }}>{p1Knockdowns ?? "—"}</span>
                                              <span className="mx-1">·</span>
                                              <span style={{ color: !p1Wins ? "var(--v2-accent)" : "var(--v2-muted)" }}>{p2Knockdowns ?? "—"}</span>
                                            </span>
                                          </>
                                        )}
                                        {hasFwData && (
                                          <>
                                            <span style={{ color: "var(--v2-muted)" }}>
                                              Quick rises
                                            </span>
                                            <span className="text-right" style={{ color: "var(--v2-muted)" }}>
                                              <span style={{ color: p1Wins ? "var(--v2-accent)" : "var(--v2-muted)" }}>{p1FastWakeups ?? "—"}</span>
                                              <span className="mx-1">·</span>
                                              <span style={{ color: !p1Wins ? "var(--v2-accent)" : "var(--v2-muted)" }}>{p2FastWakeups ?? "—"}</span>
                                            </span>
                                          </>
                                        )}
                                        {hasParryData && (
                                          <>
                                            <span style={{ color: "var(--v2-muted)" }}>Parries</span>
                                            <span className="text-right" style={{ color: "var(--v2-muted)" }}>
                                              <span style={{ color: p1Wins ? "var(--v2-accent)" : "var(--v2-muted)" }}>{p1Parries ?? "—"}</span>
                                              <span className="mx-1">·</span>
                                              <span style={{ color: !p1Wins ? "var(--v2-accent)" : "var(--v2-muted)" }}>{p2Parries ?? "—"}</span>
                                            </span>
                                          </>
                                        )}
                                        {hasThrowData && (
                                          <>
                                            <span style={{ color: "var(--v2-muted)" }}>Throws</span>
                                            <span className="text-right" style={{ color: "var(--v2-muted)" }}>
                                              <span style={{ color: p1Wins ? "var(--v2-accent)" : "var(--v2-muted)" }}>{p1Throws ?? "—"}</span>
                                              <span className="mx-1">·</span>
                                              <span style={{ color: !p1Wins ? "var(--v2-accent)" : "var(--v2-muted)" }}>{p2Throws ?? "—"}</span>
                                            </span>
                                          </>
                                        )}
                                        {hasWhiffData && (
                                          <>
                                            <span style={{ color: "var(--v2-muted)" }}>Throw whiffs</span>
                                            <span className="text-right" style={{ color: "var(--v2-muted)" }}>
                                              <span style={{ color: p1Wins ? "var(--v2-accent)" : "var(--v2-muted)" }}>{p1ThrowWhiffs ?? "—"}</span>
                                              <span className="mx-1">·</span>
                                              <span style={{ color: !p1Wins ? "var(--v2-accent)" : "var(--v2-muted)" }}>{p2ThrowWhiffs ?? "—"}</span>
                                            </span>
                                          </>
                                        )}
                                        {hasTechData && (
                                          <>
                                            <span style={{ color: "var(--v2-muted)" }}>Throw techs</span>
                                            <span className="text-right" style={{ color: "var(--v2-muted)" }}>
                                              <span style={{ color: p1Wins ? "var(--v2-accent)" : "var(--v2-muted)" }}>{p1ThrowTechs ?? "—"}</span>
                                              <span className="mx-1">·</span>
                                              <span style={{ color: !p1Wins ? "var(--v2-accent)" : "var(--v2-muted)" }}>{p2ThrowTechs ?? "—"}</span>
                                            </span>
                                          </>
                                        )}
                                        {hasSuperData && (
                                          <>
                                            <span style={{ color: "var(--v2-muted)" }}>Supers used</span>
                                            <span className="text-right" style={{ color: "var(--v2-muted)" }}>
                                              <span style={{ color: p1Wins ? "var(--v2-accent)" : "var(--v2-muted)" }}>{p1SupersUsed ?? "—"}</span>
                                              <span className="mx-1">·</span>
                                              <span style={{ color: !p1Wins ? "var(--v2-accent)" : "var(--v2-muted)" }}>{p2SupersUsed ?? "—"}</span>
                                            </span>
                                          </>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                              <pre
                                className="text-xs overflow-auto max-h-64 whitespace-pre-wrap break-all"
                                style={{ color: "var(--v2-text)" }}
                              >
                                {JSON.stringify(detail, null, 2)}
                              </pre>
                            </>
                          ) : (
                            <p className="text-xs" style={{ color: "var(--v2-muted)" }}>No data available.</p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
