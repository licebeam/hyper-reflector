import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Award,
  ArrowRight,
  Search,
  Trophy,
  RefreshCcw,
  User,
} from "lucide-react";
import api from "../external-api/requests";
import { auth } from "../utils/firebase";
import type { V2User } from "../types";
import { CountryFlag } from "../components/CountryFlag";
import { UserTitle } from "../components/UserTitle";

// ── Types ──────────────────────────────────────────────────────────────────────

type SearchUser = {
  uid?: string;
  userName?: string;
  accountElo?: number;
  countryCode?: string;
  userTitle?: { bgColor: string; border: string; color: string; title: string };
  userProfilePic?: string;
  knownAliases?: string[];
};

type LeaderboardEntry = {
  user: SearchUser;
  stats?: { accountElo?: number; totalWins?: number; totalGames?: number };
};

type LeaderboardState = {
  entries: LeaderboardEntry[];
  cursor: number | null;
  loading: boolean;
  initialized: boolean;
};

type LeaderboardMap = { elo: LeaderboardState; wins: LeaderboardState };

const INIT_BOARD: LeaderboardState = {
  entries: [],
  cursor: null,
  loading: false,
  initialized: false,
};

// ── Avatar chip ────────────────────────────────────────────────────────────────

function MiniAvatar({ user }: { user: SearchUser }) {
  const [failed, setFailed] = useState(false);
  const show = !!user.userProfilePic && !failed;
  return (
    <div
      className="w-9 h-9 rounded-full overflow-hidden shrink-0 flex items-center justify-center text-xs font-bold"
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

// ── User card ──────────────────────────────────────────────────────────────────

function UserCard({
  user,
  rank,
  statLine,
  onView,
}: {
  user: SearchUser;
  rank?: number;
  statLine?: string;
  onView?: (uid: string) => void;
}) {
  const clickable = !!user.uid && !!onView;

  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors"
      style={{
        background: "var(--v2-surface)",
        borderColor: "var(--v2-border)",
      }}
    >
      {rank !== undefined && (
        <span
          className="text-xs w-6 text-right shrink-0 font-mono"
          style={{ color: "var(--v2-muted)" }}
        >
          #{rank}
        </span>
      )}
      <MiniAvatar user={user} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="text-sm font-medium truncate"
            style={{ color: "var(--v2-text)" }}
          >
            {user.userName || "Unknown player"}
          </span>
          <CountryFlag code={user.countryCode} />
          <UserTitle title={user.userTitle} />
        </div>
        {statLine && (
          <p className="text-xs mt-0.5" style={{ color: "var(--v2-muted)" }}>
            {statLine}
          </p>
        )}
      </div>
      {clickable && (
        <button
          onClick={() => onView!(user.uid!)}
          className="shrink-0 flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors"
          style={{ color: "var(--v2-accent)" }}
          onMouseEnter={(e) =>
            (e.currentTarget.style.background = "var(--v2-hover)")
          }
          onMouseLeave={(e) =>
            (e.currentTarget.style.background = "transparent")
          }
        >
          View <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

type ProfilesPageProps = {
  currentUser: V2User | null;
  onViewProfile: (uid: string) => void;
};

export function ProfilesPage({
  currentUser,
  onViewProfile,
}: ProfilesPageProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [searchCursor, setSearchCursor] = useState<string | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [boards, setBoards] = useState<LeaderboardMap>({
    elo: INIT_BOARD,
    wins: INIT_BOARD,
  });

  const trimmed = useMemo(() => searchTerm.trim(), [searchTerm]);

  // Cursor is passed explicitly so this callback is stable (no closing over state)
  const performSearch = useCallback(
    async (term: string, reset: boolean, cursor: string | null) => {
      if (!auth.currentUser || !term) return;
      setSearchLoading(true);
      setSearchError(null);
      try {
        const res = await api.searchUsers(auth, term, reset ? null : cursor);
        const users = (res?.users ?? []) as SearchUser[];
        setSearchResults((prev) => (reset ? users : [...prev, ...users]));
        setSearchCursor(res?.nextCursor ?? null);
      } catch {
        setSearchError("Unable to search right now. Please try again soon.");
      } finally {
        setSearchLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (!trimmed) {
      setSearchResults([]);
      setSearchCursor(null);
      setSearchError(null);
      return;
    }
    const t = setTimeout(() => void performSearch(trimmed, true, null), 350);
    return () => clearTimeout(t);
  }, [trimmed, performSearch]);

  const fetchBoard = useCallback(
    async (kind: "elo" | "wins", reset: boolean, cursor: number | null) => {
      if (!auth.currentUser) return;
      setBoards((prev) => ({
        ...prev,
        [kind]: { ...prev[kind], loading: true, initialized: true },
      }));
      try {
        const res = await api.getLeaderboard(auth, {
          sortBy: kind === "elo" ? "elo" : "wins",
          cursor: reset ? null : cursor,
        });
        const entries = (res?.entries ?? []) as LeaderboardEntry[];
        setBoards((prev) => ({
          ...prev,
          [kind]: {
            entries: reset ? entries : [...prev[kind].entries, ...entries],
            cursor: res?.nextCursor ?? null,
            loading: false,
            initialized: true,
          },
        }));
      } catch {
        setBoards((prev) => ({
          ...prev,
          [kind]: { ...prev[kind], loading: false, initialized: true },
        }));
      }
    },
    [],
  );

  useEffect(() => {
    if (!currentUser?.uid) return;
    if (!boards.elo.initialized) void fetchBoard("elo", true, null);
    if (!boards.wins.initialized) void fetchBoard("wins", true, null);
  }, [
    currentUser?.uid,
    boards.elo.initialized,
    boards.wins.initialized,
    fetchBoard,
  ]);

  if (!currentUser) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm" style={{ color: "var(--v2-muted)" }}>
          Sign in to browse profiles.
        </p>
      </div>
    );
  }

  const renderBoard = (
    kind: "elo" | "wins",
    icon: React.ReactNode,
    title: string,
    desc: string,
  ) => {
    const board = boards[kind];
    return (
      <div
        className="rounded-lg border"
        style={{
          background: "var(--v2-surface)",
          borderColor: "var(--v2-border)",
        }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: "var(--v2-border)" }}
        >
          <div>
            <div className="flex items-center gap-2">
              <span style={{ color: "var(--v2-accent)" }}>{icon}</span>
              <h2
                className="text-sm font-semibold"
                style={{ color: "var(--v2-text)" }}
              >
                {title}
              </h2>
            </div>
            <p className="text-xs mt-0.5" style={{ color: "var(--v2-muted)" }}>
              {desc}
            </p>
          </div>
          <button
            onClick={() => void fetchBoard(kind, true, null)}
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
        <div className="p-3 space-y-2">
          {board.entries.length === 0 && !board.loading && (
            <p
              className="text-xs text-center py-4"
              style={{ color: "var(--v2-muted)" }}
            >
              No players yet.
            </p>
          )}
          {board.loading && board.entries.length === 0 && (
            <div className="flex justify-center py-4">
              <div
                className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                style={{
                  borderColor: "var(--v2-accent)",
                  borderTopColor: "transparent",
                }}
              />
            </div>
          )}
          {board.entries.map((entry, i) => {
            const statLine =
              kind === "elo"
                ? `ELO ${entry.stats?.accountElo ?? "—"}`
                : `Wins ${entry.stats?.totalWins ?? 0} · Games ${entry.stats?.totalGames ?? 0}`;
            return (
              <UserCard
                key={`${kind}-${entry.user.uid ?? i}`}
                user={entry.user}
                rank={i + 1}
                statLine={statLine}
                onView={onViewProfile}
              />
            );
          })}
          {board.entries.length > 0 && (
            <button
              onClick={() => void fetchBoard(kind, false, board.cursor)}
              disabled={!board.cursor || board.loading}
              className="w-full text-xs py-2 rounded border transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                borderColor: "var(--v2-border)",
                color: "var(--v2-muted)",
              }}
              onMouseEnter={(e) => {
                if (!board.loading && board.cursor)
                  (e.currentTarget as HTMLElement).style.background =
                    "var(--v2-hover)";
              }}
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background =
                  "transparent")
              }
            >
              {board.cursor ? "Load more" : "End of list"}
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="h-full overflow-y-scroll">
      <div className="max-w-5xl mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1
              className="text-lg font-semibold"
              style={{ color: "var(--v2-text)" }}
            >
              Player profiles
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--v2-muted)" }}>
              Search players, browse leaderboards, or view your own profile.
            </p>
          </div>
          {/* TEMP DISABLE */}
          {/* {currentUser.uid && (
            <button
              onClick={() => onViewProfile(currentUser.uid)}
              className="flex items-center gap-1.5 text-sm px-3 py-1.5 rounded transition-colors"
              style={{
                background: "var(--v2-accent)",
                color: "var(--v2-accent-fg)",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--v2-accent-hover)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "var(--v2-accent)")
              }
            >
              <User size={14} /> My profile
            </button>
          )} */}
        </div>

        {/* Search */}
        <div
          className="rounded-lg border p-4 space-y-3"
          style={{
            background: "var(--v2-surface)",
            borderColor: "var(--v2-border)",
          }}
        >
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--v2-muted)" }}
            />
            <input
              type="text"
              placeholder="Search by player name…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 pr-3 py-2 rounded border text-sm outline-none transition-colors"
              style={{
                background: "var(--v2-hover)",
                borderColor: "var(--v2-border)",
                color: "var(--v2-text)",
              }}
              onFocus={(e) =>
                (e.currentTarget.style.borderColor = "var(--v2-accent)")
              }
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = "var(--v2-border)")
              }
            />
          </div>
          {searchError && (
            <p className="text-xs" style={{ color: "#f87171" }}>
              {searchError}
            </p>
          )}
          {trimmed && (
            <div className="flex items-center justify-between">
              <span className="text-xs" style={{ color: "var(--v2-muted)" }}>
                {searchResults.length} result
                {searchResults.length !== 1 ? "s" : ""}
              </span>
              <button
                onClick={() => setSearchTerm("")}
                className="text-xs transition-colors"
                style={{ color: "var(--v2-muted)" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.color = "var(--v2-text)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.color = "var(--v2-muted)")
                }
              >
                Clear
              </button>
            </div>
          )}
          {searchLoading && searchResults.length === 0 && (
            <div className="flex justify-center py-3">
              <div
                className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin"
                style={{
                  borderColor: "var(--v2-accent)",
                  borderTopColor: "transparent",
                }}
              />
            </div>
          )}
          {!searchLoading && trimmed && searchResults.length === 0 && (
            <p className="text-xs py-2" style={{ color: "var(--v2-muted)" }}>
              No players found for "{trimmed}".
            </p>
          )}
          <div className="space-y-2">
            {searchResults.map((user) => (
              <UserCard
                key={user.uid ?? user.userName}
                user={user}
                statLine={
                  user.accountElo !== undefined
                    ? `ELO ${user.accountElo}`
                    : undefined
                }
                onView={onViewProfile}
              />
            ))}
          </div>
          {searchResults.length > 0 && searchCursor && (
            <button
              onClick={() => void performSearch(trimmed, false, searchCursor)}
              disabled={searchLoading}
              className="w-full text-xs py-2 rounded border transition-colors disabled:opacity-40"
              style={{
                borderColor: "var(--v2-border)",
                color: "var(--v2-muted)",
              }}
              onMouseEnter={(e) =>
                ((e.currentTarget as HTMLElement).style.background =
                  "var(--v2-hover)")
              }
              onMouseLeave={(e) =>
                ((e.currentTarget as HTMLElement).style.background =
                  "transparent")
              }
            >
              Load more results
            </button>
          )}
        </div>

        {/* Leaderboards */}
        <div>
          <h2
            className="text-sm font-semibold mb-3"
            style={{ color: "var(--v2-text)" }}
          >
            Leaderboards
          </h2>
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            {renderBoard(
              "elo",
              <Award size={15} />,
              "Highest ELO",
              "Top rated competitors",
            )}
            {renderBoard(
              "wins",
              <Trophy size={15} />,
              "Most wins",
              "Players with the most recorded wins",
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
