import type { MiniGameChoice } from "../../mini-games/types";
import type { MatchSummary } from "../../types/match";
import type { TUser } from "../../types/user";
import { DEFAULT_LOBBY_ID } from "../../state/store";
import {
  DEBUG_MOCK_MATCH_ID,
  FALLBACK_USER_TITLE,
  MOCK_CHALLENGE_USER,
  MOCK_CHALLENGE_USER_TWO,
} from "./mockUsers";

const MINI_GAME_CHOICES: MiniGameChoice[] = ["rock", "paper", "scissors"];

const createDebugPlayer = (
  uid: string,
  userName: string,
  countryCode: string,
  accountElo: number,
  title: string
): TUser => ({
  uid,
  userName,
  accountElo,
  countryCode,
  gravEmail: "",
  knownAliases: [],
  pingLat: undefined,
  pingLon: undefined,
  userEmail: `${uid}@mock.local`,
  userProfilePic: "",
  userTitle: { ...FALLBACK_USER_TITLE, title },
  role: "user",
  winStreak: 0,
  rpsElo: 1200,
  sidePreferences: {},
});

const DEBUG_MATCH_PLAYER_PROFILES: TUser[] = [
  MOCK_CHALLENGE_USER,
  MOCK_CHALLENGE_USER_TWO,
  createDebugPlayer("mock-apollo", "Apollo Bot", "BR", 1780, "Solar Ace"),
  createDebugPlayer("mock-luna", "Luna Bot", "CA", 1650, "Moonlit Duelist"),
  createDebugPlayer("mock-rico", "Rico Bot", "MX", 1820, "Border King"),
  createDebugPlayer("mock-sora", "Sora Bot", "JP", 1900, "Wind Walker"),
  createDebugPlayer("mock-iris", "Iris Bot", "FR", 1725, "Arcane Bloom"),
];

const DEBUG_MATCH_BLUEPRINTS: Array<{
  id: string;
  gameName: string;
  players: Array<{ uid: string; playerSlot: 0 | 1 }>;
}> = [
  {
    id: `${DEBUG_MOCK_MATCH_ID}-alpha`,
    gameName: "Training Match",
    players: [
      { uid: "mock-opponent", playerSlot: 0 },
      { uid: "mock-opponent-2", playerSlot: 1 },
    ],
  },
  {
    id: `${DEBUG_MOCK_MATCH_ID}-beta`,
    gameName: "First to 5",
    players: [
      { uid: "mock-apollo", playerSlot: 0 },
      { uid: "mock-luna", playerSlot: 1 },
    ],
  },
  {
    id: `${DEBUG_MOCK_MATCH_ID}-gamma`,
    gameName: "Gauntlet Prep",
    players: [
      { uid: "mock-rico", playerSlot: 0 },
      { uid: "mock-sora", playerSlot: 1 },
    ],
  },
  {
    id: `${DEBUG_MOCK_MATCH_ID}-delta`,
    gameName: "Arcade Classics",
    players: [
      { uid: "mock-iris", playerSlot: 0 },
      { uid: "mock-apollo", playerSlot: 1 },
    ],
  },
  {
    id: `${DEBUG_MOCK_MATCH_ID}-epsilon`,
    gameName: "Lunch Break Sets",
    players: [
      { uid: "mock-luna", playerSlot: 0 },
      { uid: "mock-rico", playerSlot: 1 },
    ],
  },
];

const MAX_METER_EVENTS = 200;

export const resolveMockDisplayName = (
  uid?: string | null,
  fallback = "Mock Opponent"
) => {
  if (!uid) return fallback;
  if (uid === MOCK_CHALLENGE_USER.uid) return MOCK_CHALLENGE_USER.userName;
  if (uid === MOCK_CHALLENGE_USER_TWO.uid)
    return MOCK_CHALLENGE_USER_TWO.userName;
  return fallback;
};

export const formatMiniGameChoice = (choice?: MiniGameChoice | null) => {
  if (!choice) return "—"; // matches legacy placeholder
  return choice.charAt(0).toUpperCase() + choice.slice(1);
};

export const randomMiniGameChoice = (): MiniGameChoice =>
  MINI_GAME_CHOICES[Math.floor(Math.random() * MINI_GAME_CHOICES.length)];

export const normalizeMatchSummary = (raw: any): MatchSummary | null => {
  if (!raw || typeof raw !== "object") return null;
  const id = typeof raw.id === "string" ? raw.id : undefined;
  if (!id) return null;
  const lobbyId =
    typeof raw.lobbyId === "string" && raw.lobbyId.length
      ? raw.lobbyId
      : DEFAULT_LOBBY_ID;
  const startedAt =
    typeof raw.startedAt === "number" ? raw.startedAt : Date.now();
  const gameName =
    typeof raw.gameName === "string" || raw.gameName === null
      ? raw.gameName
      : undefined;
  const players = Array.isArray(raw.players)
    ? raw.players
        .map((player: any) => {
          if (!player || typeof player !== "object") return null;
          const uid = typeof player.uid === "string" ? player.uid : undefined;
          if (!uid) return null;
          const slot =
            player.playerSlot === 1 || player.playerSlot === "1" ? 1 : 0;
          return {
            uid,
            playerSlot: slot as 0 | 1,
            userName:
              typeof player.userName === "string" ? player.userName : undefined,
            userProfilePic:
              typeof player.userProfilePic === "string"
                ? player.userProfilePic
                : undefined,
            countryCode:
              typeof player.countryCode === "string"
                ? player.countryCode
                : undefined,
            userTitle: player.userTitle,
            accountElo:
              typeof player.accountElo === "number"
                ? player.accountElo
                : undefined,
          };
        })
        .filter(
          (
            entry: MatchSummary["players"][number] | null
          ): entry is MatchSummary["players"][number] => Boolean(entry)
        )
    : [];
  return {
    id,
    lobbyId,
    startedAt,
    gameName,
    players,
  };
};

const buildMockMatchPlayer = (
  source: TUser,
  playerSlot: 0 | 1
): MatchSummary["players"][number] => ({
  uid: source.uid,
  userName: source.userName,
  userProfilePic: source.userProfilePic,
  countryCode: source.countryCode,
  userTitle: source.userTitle,
  accountElo: source.accountElo,
  playerSlot,
});

const findDebugMatchPlayer = (uid: string): TUser => {
  const candidate = DEBUG_MATCH_PLAYER_PROFILES.find(
    (player) => player.uid === uid
  );
  return candidate ?? MOCK_CHALLENGE_USER;
};

export const buildDebugMockMatches = (lobbyId: string): MatchSummary[] => {
  const now = Date.now();
  return DEBUG_MATCH_BLUEPRINTS.map((blueprint, index) => ({
    id: blueprint.id,
    lobbyId,
    startedAt: now - index * 90_000,
    gameName: blueprint.gameName,
    players: blueprint.players.map(({ uid, playerSlot }) =>
      buildMockMatchPlayer(findDebugMatchPlayer(uid), playerSlot)
    ),
  }));
};

const coerceBooleanFlag = (value: unknown): boolean | undefined => {
  if (typeof value === "boolean") {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined;
    return value !== 0;
  }
  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized.length) return undefined;
    return normalized === "true" || normalized === "1";
  }
  return undefined;
};

const coerceNumber = (value: unknown): number | undefined => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const num = Number(value);
    return Number.isFinite(num) ? num : undefined;
  }
  return undefined;
};

const coerceString = (value: unknown): string | undefined => {
  if (typeof value === "string" && value.trim().length) {
    return value.trim();
  }
  if (typeof value === "number") {
    return String(value);
  }
  return undefined;
};

const limitArray = (value: unknown, limit = MAX_METER_EVENTS) => {
  if (!Array.isArray(value)) return [];
  const mapped = value
    .map((entry) => coerceNumber(entry))
    .filter((entry): entry is number => typeof entry === "number");
  if (mapped.length <= limit) return mapped;
  return mapped.slice(mapped.length - limit);
};

export const buildCondensedMatchPayload = (
  source: Record<string, unknown>
) => {
  const matchUuid = coerceString(source["match-uuid"]);
  const createdAt = coerceNumber(source["created-at"]) ?? Date.now();
  const explicitP1Win = coerceBooleanFlag(source["p1-win"]);
  const explicitP2Win = coerceBooleanFlag(source["p2-win"]);

  let resolvedWinner: "player1" | "player2";
  if (explicitP1Win === true) {
    resolvedWinner = "player1";
  } else if (explicitP2Win === true) {
    resolvedWinner = "player2";
  } else {
    const fallbackWinner =
      coerceString(source["winner"]) ||
      (coerceBooleanFlag(source["p1-win"]) ? "player1" : "player2");
    resolvedWinner = fallbackWinner === "player2" ? "player2" : "player1";
  }

  const p1WinFinal = resolvedWinner === "player1";
  const p2WinFinal = !p1WinFinal;

  const safeNumber = (value: unknown) => coerceNumber(value) ?? 0;

  return {
    matchUuid,
    createdAt,
    winner: resolvedWinner,
    "p1-win": p1WinFinal,
    "p2-win": p2WinFinal,
    "player1-char": safeNumber(source["player1-char"]),
    "player2-char": safeNumber(source["player2-char"]),
    "player1-super": safeNumber(source["player1-super"]),
    "player2-super": safeNumber(source["player2-super"]),
    "p1-total-meter-gained": safeNumber(source["p1-total-meter-gained"]),
    "p2-total-meter-gained": safeNumber(source["p2-total-meter-gained"]),
    "p1-meter-gained": limitArray(source["p1-meter-gained"]),
    "p2-meter-gained": limitArray(source["p2-meter-gained"]),
    participants: {
      player1: {
        char: safeNumber(source["player1-char"]),
        super: safeNumber(source["player1-super"]),
        totalMeter: safeNumber(source["p1-total-meter-gained"]),
      },
      player2: {
        char: safeNumber(source["player2-char"]),
        super: safeNumber(source["player2-super"]),
        totalMeter: safeNumber(source["p2-total-meter-gained"]),
      },
    },
    meterSamples: {
      player1: limitArray(source["p1-meter-gained"]),
      player2: limitArray(source["p2-meter-gained"]),
    },
  };
};
