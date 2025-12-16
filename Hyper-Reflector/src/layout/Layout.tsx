import {
  ReactElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
//@ts-ignore // keys exists
import keys from "../private/keys";
import { useNavigate } from "@tanstack/react-router";
import {
  Box,
  Stack,
  IconButton,
  Image,
  Text,
  Flex,
  Drawer,
  useDisclosure,
  VStack,
  HStack,
  Button,
  Switch,
  Float,
  Circle,
} from "@chakra-ui/react";
import { keyframes } from "@emotion/react";
import {
  DEFAULT_LOBBY_ID,
  useMessageStore,
  useSettingsStore,
  useUserStore,
} from "../state/store";
import type { LobbySummary, TMessage } from "../state/store";
import type { MatchSummary } from "../types/match";
import type { TUser } from "../types/user";
import { useTranslation } from "react-i18next";
import { useActiveThemeDefinition } from "../theme/hooks";
import bgImage from "../assets/bgImage.svg";
import hrLogo from "../assets/logo.svg";
import {
  Bell,
  BellOff,
  FlaskConical,
  LucideHome,
  MessageCircle,
  Settings,
  ShieldHalf,
  Swords,
  UserRound,
} from "lucide-react";
import UserCard from "../components/UserCard/UserCard";
import { LobbyManagerDialog } from "./components/LobbyManagerDialog";
import { useTauriSoundPlayer } from "../utils/useTauriSoundPlayer";
import { buildMentionRegexes } from "../utils/chatFormatting";
import { toaster } from "../components/chakra/ui/toaster";
import {
  RegExpMatcher,
  englishDataset,
  englishRecommendedTransformers,
} from "obscenity";
import {
  cancelPendingChallengesForChallenger,
  cancelPendingChallengesInvolving,
  normalizeChallengeParticipants,
} from "./helpers/challenges";
import {
  appendMockUsers,
  buildMockForLobby,
  DEBUG_MOCK_MATCH_ID,
  FALLBACK_USER_TITLE,
  MOCK_ACTION_INTERVAL_MS,
  MOCK_CHALLENGE_LINES,
  MOCK_CHALLENGE_USER,
  MOCK_CHALLENGE_USER_TWO,
  MOCK_CHAT_LINES,
  normalizeSocketUser,
} from "./helpers/mockUsers";
import { formatTimestamp } from "./helpers/time";
import { STATUS_COLOR_MAP, STATUS_LABEL_MAP } from "./helpers/status";
import {
  AUTO_DECLINE_RESPONDER,
  AUTO_RESOLVE_RESPONDER,
  CHALLENGE_ACCEPT_LABEL,
  CHALLENGE_DECLINE_LABEL,
  LOBBY_NAME_MAX_LENGTH,
  LOBBY_NAME_MIN_LENGTH,
  NOTIFICATIONS_TITLE,
  NO_NOTIFICATIONS_MESSAGE,
} from "./helpers/constants";

import {
  initWebRTC,
  startCall,
  answerCall,
  declineCall as webrtcDeclineCall,
  closeConnectionWithUser,
} from "../webRTC/WebPeer";
import { isMockUserId, startMockMatch, startProxyMatch } from "../match";
import MiniGameArena from "../mini-games/MiniGameArena";
import type {
  MiniGameChoice,
  MiniGameResultPayload,
  MiniGameUiState,
} from "../mini-games/types";
import { evaluateRps } from "../mini-games/rps";
import {
  SOCKET_STATE_EVENT,
  type SocketStateUpdateDetail,
} from "./helpers/socketBridge";
import { auth } from "../utils/firebase";
import api from "../external-api/requests";
import {
  clearMatchCommandFile,
  clearMatchStatsFile,
  readMatchCommandFile,
  readMatchStatsFile,
} from "../utils/matchFiles";
import { parseMatchData } from "../utils/matchParser";
import { isTauriEnv } from "../utils/pathSettings";
import { peerLatencyManager } from "../webRTC/peerLatencyManager";

const DEV_MATCH_ID = "dev-matches-and-bugs";

const lobbyNameMatcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

const DEFAULT_RPS_ELO = 1200;
const MOCK_RPS_ELO_DELTA = 15;

function resolveMockDisplayName(
  uid?: string | null,
  fallback = "Mock Opponent"
) {
  if (!uid) return fallback;
  if (uid === MOCK_CHALLENGE_USER.uid) return MOCK_CHALLENGE_USER.userName;
  if (uid === MOCK_CHALLENGE_USER_TWO.uid)
    return MOCK_CHALLENGE_USER_TWO.userName;
  return fallback;
}

const formatMiniGameChoice = (choice?: MiniGameChoice | null) => {
  if (!choice) return "—";
  return choice.charAt(0).toUpperCase() + choice.slice(1);
};

const MINI_GAME_CHOICES: MiniGameChoice[] = ["rock", "paper", "scissors"];
const randomMiniGameChoice = (): MiniGameChoice =>
  MINI_GAME_CHOICES[Math.floor(Math.random() * MINI_GAME_CHOICES.length)];

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

const normalizeMatchSummary = (raw: any): MatchSummary | null => {
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

const buildDebugMockMatches = (lobbyId: string): MatchSummary[] => {
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

const MAX_METER_EVENTS = 200;
const MAX_RAW_PAYLOAD_LENGTH = 450_000;

function coerceBooleanFlag(value: unknown): boolean | undefined {
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
}

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

const buildCondensedMatchPayload = (source: Record<string, unknown>) => {
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
    // legacy keys to keep backend parser happy
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

type SendMessageEventDetail = {
  text: string;
  onSuccess?: () => void;
  onError?: (message: string) => void;
};

type ChallengeEventDetail = {
  targetUid: string;
};

type NotificationEntry = {
  message: TMessage;
  kind: "challenge" | "mention";
};

type ChallengeResponseDetail = {
  messageId: string;
  accepted: boolean;
  responderName?: string;
  kind?: "match" | "rps";
};

type MiniGameInviteMeta = {
  sessionId: string;
  challengerId: string;
  opponentId: string;
  expiresAt: number;
};

export default function Layout({ children }: { children: ReactElement[] }) {
  const navigate = useNavigate();
  const globalLoggedIn = useUserStore((s) => s.globalLoggedIn);
  const globalUser = useUserStore((s) => s.globalUser);
  const isAdmin = globalUser?.role === "admin";
  const signalStatus = useUserStore((s) => s.signalStatus);
  const setSignalStatus = useUserStore((s) => s.setSignalStatus);
  const chatMessages = useMessageStore((s) => s.chatMessages);
  const clearChatMessages = useMessageStore((s) => s.clear);
  const currentLobbyId = useUserStore((s) => s.currentLobbyId);
  const setCurrentLobbyId = useUserStore((s) => s.setCurrentLobbyId);
  const lobbyList = useUserStore((s) => s.lobbies);
  const setLobbyList = useUserStore((s) => s.setLobbies);
  const lobbyUsers = useUserStore((s) => s.lobbyUsers);
  const setCurrentMatches = useUserStore((s) => s.setCurrentMatches);
  const setLobbyUsers = useUserStore((s) => s.setLobbyUsers);
  const theme = useSettingsStore((s) => s.theme);
  const activeThemeDefinition = useActiveThemeDefinition();
  const semanticColors = activeThemeDefinition?.semanticColors;
  const notificationsMuted = useSettingsStore((s) => s.notificationsMuted);
  const setNotificationsMuted = useSettingsStore(
    (s) => s.setNotificationsMuted
  );
  const notifChallengeSoundEnabled = useSettingsStore(
    (s) => s.notifChallengeSound
  );
  const notifChallengeSoundPath = useSettingsStore(
    (s) => s.notifChallengeSoundPath
  );
  const notifMentionSoundEnabled = useSettingsStore((s) => s.notifiAtSound);
  const notifMentionSoundPath = useSettingsStore((s) => s.notifAtSoundPath);
  const winSoundEnabled = useSettingsStore((s) => s.winSound);
  const winSoundPath = useSettingsStore((s) => s.winSoundPath);
  const mutedUsers = useSettingsStore((s) => s.mutedUsers);
  const accentColor = theme?.colorPalette ?? "hyperOrange";
  const withAlpha = useCallback((color: string | undefined, alpha: number) => {
    if (!color) {
      return `rgba(0,0,0,${alpha})`;
    }
    const hex = color.replace("#", "");
    if (hex.length === 3) {
      const [r, g, b] = hex.split("").map((ch) => parseInt(ch + ch, 16));
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    if (hex.length === 6) {
      const r = parseInt(hex.slice(0, 2), 16);
      const g = parseInt(hex.slice(2, 4), 16);
      const b = parseInt(hex.slice(4, 6), 16);
      return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    return color;
  }, []);
  const layoutBackground = useMemo(() => {
    if (!semanticColors) {
      return { bg: "bg.canvas" as const, overlay: undefined as string | undefined };
    }
    const canvas = semanticColors.canvas ?? semanticColors.background;
    const surface = withAlpha(semanticColors.surface ?? canvas, 0.7);
    const background = withAlpha(semanticColors.background ?? canvas, 0.95);
    const overlay = `radial-gradient(circle at top, ${surface} 0%, ${background} 80%)`;
    return { bg: canvas ?? "bg.canvas", overlay };
  }, [semanticColors, withAlpha]);
  const borderColorValue = semanticColors?.border ?? "border";
  const popoverBgValue = semanticColors?.popover ?? "bg.popover";
  const mutedBgValue = semanticColors?.muted ?? "bg.muted";
  const popoverSurfaceStyles = useMemo(
    () => ({
      bg: popoverBgValue,
      borderColor: borderColorValue,
      borderWidth: "1px",
      borderRadius: "xl",
    }),
    [popoverBgValue, borderColorValue]
  );
  const navPanelStyles = useMemo(
    () => ({
      bg: popoverBgValue,
      borderWidth: "1px",
      borderColor: borderColorValue,
      borderRadius: "xl",
      borderRightWidth: "1px",
    }),
    [popoverBgValue, borderColorValue]
  );
  const headerStyles = useMemo(
    () => ({
      bg: mutedBgValue,
      borderBottom: "1px solid",
      borderColor: borderColorValue,
    }),
    [mutedBgValue, borderColorValue]
  );
  const footerStyles = useMemo(
    () => ({
      bg: mutedBgValue,
      borderColor: borderColorValue,
    }),
    [mutedBgValue, borderColorValue]
  );
  const mutedLabelColor = semanticColors?.textMuted ?? "fg.muted";
  const scrollBackgroundAnimation = useMemo(
    () =>
      keyframes`
        from { background-position: center center, 0 0; }
        to { background-position: center center, -800px 800px; }
      `,
    []
  );
  const backgroundImageValue = useMemo(() => {
    if (layoutBackground.overlay) {
      return `${layoutBackground.overlay}, url(${bgImage})`;
    }
    return `url(${bgImage})`;
  }, [layoutBackground.overlay]);
  const { t } = useTranslation();
  const {
    open: notificationsOpen,
    onOpen: openNotifications,
    onClose: closeNotifications,
  } = useDisclosure();
  const {
    open: lobbyManagerOpen,
    onOpen: openLobbyManager,
    onClose: closeLobbyManager,
  } = useDisclosure();
  const signalSocketRef = useRef<WebSocket | null>(null);
  const { playSound: playSoundFile } = useTauriSoundPlayer();

  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const opponentUidRef = useRef<string | null>(null);
  const mockActionIndexRef = useRef(0);
  const globalUserRef = useRef<TUser | undefined>(globalUser);
  const sentMatchRequestRef = useRef<Set<string>>(new Set());
  const pendingChallengeOffersRef = useRef<
    Map<string, { from: string; offer: RTCSessionDescriptionInit }>
  >(new Map());
  const pendingChallengeByUserRef = useRef<Map<string, string>>(new Map());
  const pendingIceCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(
    new Map()
  );
  const pendingMiniGameInvitesRef = useRef<Map<string, MiniGameInviteMeta>>(
    new Map()
  );
  const mutedUsersRef = useRef<string[]>(mutedUsers || []);
  const matchUploadPendingRef = useRef(false);
  const serverMatchesRef = useRef<MatchSummary[]>([]);
  const activeMatchIdRef = useRef<string | null>(null);
  const localPlayerSlotRef = useRef<0 | 1>(0);
  const pendingPreferredSlotRef = useRef<0 | 1 | null>(null);
  const lastMatchUuidRef = useRef<string | null>(null);
  const debugMockMatchesRef = useRef<MatchSummary[]>([]);
  const [isInMatch, setIsInMatch] = useState(false);
  const [miniGameState, setMiniGameState] = useState<MiniGameUiState | null>(
    null
  );
  const miniGameStateRef = useRef<MiniGameUiState | null>(null);
  const [miniGameSideLoading, setMiniGameSideLoading] = useState(false);
  const mockMiniGameTimers = useRef<Map<string, number>>(new Map());
  const isInMatchRef = useRef(false);
  const currentMatchModeRef = useRef<"live" | "mock" | null>(null);
  const declineChallengeWithSocket = useCallback(
    (targetId: string, challengerId: string) => {
      const socket = signalSocketRef.current;
      if (!socket) {
        return;
      }
      webrtcDeclineCall(socket, targetId, challengerId).catch((error) => {
        console.error("Failed to auto-decline challenge:", error);
      });
    },
    [signalSocketRef]
  );

  useEffect(() => {
    globalUserRef.current = globalUser || undefined;
    peerLatencyManager.setViewer(globalUser);
  }, [globalUser]);

  useEffect(() => {
    isInMatchRef.current = isInMatch;
    peerLatencyManager.setInMatch(isInMatch);
  }, [isInMatch]);

  useEffect(() => {
    peerLatencyManager.setPeers(lobbyUsers);
  }, [lobbyUsers]);

  useEffect(() => {
    miniGameStateRef.current = miniGameState;
  }, [miniGameState]);

  useEffect(() => {
    return () => {
      mockMiniGameTimers.current.forEach((id) => window.clearTimeout(id));
      mockMiniGameTimers.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!globalLoggedIn) {
      setMiniGameState(null);
    }
  }, [globalLoggedIn]);

  const applySidePreferenceLocally = useCallback(
    (
      entry: {
        side: "player1" | "player2";
        ownerUid: string;
        opponentUid: string;
        expiresAt: number;
      } | null,
      opponentUid: string
    ) => {
      const store = useUserStore.getState();
      const viewer = store.globalUser;
      if (!viewer) return;
      const nextPreferences = { ...(viewer.sidePreferences || {}) };
      if (!entry) {
        delete nextPreferences[opponentUid];
      } else {
        nextPreferences[opponentUid] = entry;
      }
      store.setGlobalUser({ ...viewer, sidePreferences: nextPreferences });
    },
    []
  );

  const resolveActiveSidePreference = useCallback(
    (viewer: TUser | undefined, opponentUid: string) => {
      if (!viewer?.sidePreferences) return undefined;
      const entry = viewer.sidePreferences[opponentUid];
      if (!entry) return undefined;
      if (entry.expiresAt <= Date.now()) {
        applySidePreferenceLocally(null, opponentUid);
        return undefined;
      }
      return entry;
    },
    [applySidePreferenceLocally]
  );

  const resolvePreferredSlot = useCallback(
    (viewer: TUser | undefined, opponentUid: string): 0 | 1 | null => {
      const entry = resolveActiveSidePreference(viewer, opponentUid);
      if (!entry) return null;
      return entry.side === "player2" ? 1 : 0;
    },
    [resolveActiveSidePreference]
  );

  const resolveUserName = useCallback(
    (uid: string | undefined) => {
      const fallback = t("Layout.notifications.unknownPlayer");
      const selfLabel = t("Layout.notifications.self");
      if (!uid) return fallback;
      const store = useUserStore.getState();
      if (store.globalUser?.uid === uid) {
        return store.globalUser.userName || selfLabel;
      }
      const entry = store.lobbyUsers.find((user) => user.uid === uid);
      return entry?.userName || fallback;
    },
    [t]
  );

  const applyDebugMatchInjection = useCallback(
    (matches: MatchSummary[]): MatchSummary[] => {
      const activeLobby = currentLobbyIdRef.current?.trim().toLowerCase();
      const sanitized = matches.filter(
        (entry) => !entry.id.startsWith(DEBUG_MOCK_MATCH_ID)
      );
      if (activeLobby !== "debug") {
        debugMockMatchesRef.current = [];
        return sanitized;
      }
      if (!debugMockMatchesRef.current.length) {
        debugMockMatchesRef.current = buildDebugMockMatches(
          currentLobbyIdRef.current || "Debug"
        );
      }
      return [...sanitized, ...debugMockMatchesRef.current];
    },
    []
  );

  const clearMockMiniGameTimer = useCallback((sessionId: string) => {
    const timer = mockMiniGameTimers.current.get(sessionId);
    if (timer) {
      window.clearTimeout(timer);
      mockMiniGameTimers.current.delete(sessionId);
    }
  }, []);

  const sendSocketMessage = useCallback((payload: Record<string, unknown>) => {
    const socket = signalSocketRef.current;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      console.warn("Signal socket not ready for payload", payload);
      return false;
    }

    try {
      socket.send(JSON.stringify(payload));
      return true;
    } catch (error) {
      console.error("Failed to send payload to signal server:", error);
      return false;
    }
  }, []);

  const notifyMatchStatus = useCallback((status: "start" | "end") => {
    const viewer = globalUserRef.current;
    const socket = signalSocketRef.current;
    const matchId = activeMatchIdRef.current;
    const opponentId = opponentUidRef.current;
    if (
      !viewer?.uid ||
      !socket ||
      socket.readyState !== WebSocket.OPEN ||
      !matchId ||
      !opponentId
    ) {
      return;
    }
    const lobbyId = currentLobbyIdRef.current || DEFAULT_LOBBY_ID;
    try {
      socket.send(
        JSON.stringify({
          type: "match-status",
          status,
          matchId,
          opponentId,
          lobbyId,
        })
      );
    } catch (error) {
      console.error("Failed to send match status update:", error);
    }
  }, []);

  const markMatchEnded = useCallback(() => {
    isInMatchRef.current = false;
    setIsInMatch(false);
    sentMatchRequestRef.current.clear();
    lastMatchUuidRef.current = null;
    activeMatchIdRef.current = null;
    localPlayerSlotRef.current = 0;
    pendingPreferredSlotRef.current = null;
    currentMatchModeRef.current = null;
  }, [setIsInMatch]);

  const markMatchStarted = useCallback(
    (
      opponentUid?: string | null,
      options?: { matchId?: string; playerSlot?: 0 | 1; mode?: "live" | "mock" }
    ) => {
      if (opponentUid) {
        opponentUidRef.current = opponentUid;
      }
      if (options?.matchId) {
        activeMatchIdRef.current = options.matchId;
      }
      if (typeof options?.playerSlot === "number") {
        localPlayerSlotRef.current = options.playerSlot;
      }
      currentMatchModeRef.current = options?.mode ?? "live";
      isInMatchRef.current = true;
      setIsInMatch(true);

      const challengerId = globalUser?.uid;
      const participantIds = [challengerId, opponentUid].filter(
        (id): id is string => Boolean(id)
      );

      if (participantIds.length) {
        cancelPendingChallengesInvolving({
          participantIds,
          excludeMessageIds: [],
          reason: AUTO_RESOLVE_RESPONDER,
          currentUserId: globalUser?.uid,
          declineChallenge: declineChallengeWithSocket,
        });

        const participantSet = new Set(participantIds);
        pendingChallengeOffersRef.current.forEach((pending, messageId) => {
          if (pending && participantSet.has(pending.from)) {
            pendingChallengeOffersRef.current.delete(messageId);
            pendingChallengeByUserRef.current.delete(pending.from);
            pendingIceCandidatesRef.current.delete(pending.from);
          }
        });
      }
    },
    [
      cancelPendingChallengesInvolving,
      declineChallengeWithSocket,
      globalUser?.uid,
      setIsInMatch,
    ]
  );

  const handleChallengeResponse = useCallback(
    (messageId: string, accepted: boolean, responderName?: string) => {
      void (async () => {
        const viewerSnapshot = globalUserRef.current;
        const responder =
          responderName && responderName.trim().length
            ? responderName.trim()
            : viewerSnapshot?.userName || t("Layout.notifications.self");
        const status = accepted ? "accepted" : "declined";

        const { chatMessages, updateMessage } = useMessageStore.getState();
        const targetMessage = chatMessages.find(
          (message) => message.id === messageId
        );
        const { challengerId, opponentId } = normalizeChallengeParticipants(
          targetMessage,
          globalUser?.uid
        );

        updateMessage(messageId, {
          challengeStatus: status,
          challengeResponder: responder,
          challengeChallengerId: challengerId,
          challengeOpponentId: opponentId,
        });

        const pendingOffer = pendingChallengeOffersRef.current.get(messageId);
        if (pendingOffer) {
          const socket = signalSocketRef.current;
          if (!socket || !globalUser?.uid) {
            pendingChallengeOffersRef.current.delete(messageId);
            pendingChallengeByUserRef.current.delete(pendingOffer.from);
            pendingIceCandidatesRef.current.delete(pendingOffer.from);
            toaster.error({
              title: t("Layout.toast.signalUnavailable.title"),
              description: t("Layout.toast.signalUnavailable.description"),
            });
            return;
          }

          if (accepted) {
            try {
              if (peerConnectionRef.current) {
                try {
                  peerConnectionRef.current.close();
                } catch (error) {
                  console.error(
                    "Failed to close existing peer connection:",
                    error
                  );
                }
                peerConnectionRef.current = null;
              }

              const peer = await initWebRTC(
                globalUser.uid,
                pendingOffer.from,
                socket
              );
              peerConnectionRef.current = peer;
              opponentUidRef.current = pendingOffer.from;
              await peer.setRemoteDescription(
                new RTCSessionDescription(pendingOffer.offer)
              );
              const queuedCandidates =
                pendingIceCandidatesRef.current.get(pendingOffer.from) || [];
              for (const candidate of queuedCandidates) {
                try {
                  await peer.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (error) {
                  console.warn("Failed to add queued ICE candidate:", error);
                }
              }
              pendingIceCandidatesRef.current.delete(pendingOffer.from);
              await answerCall(peer, socket, pendingOffer.from, globalUser.uid);
            } catch (error) {
              console.error("Failed to accept incoming challenge:", error);
              const fallbackDescription = t(
                "Layout.toast.acceptChallengeError.unknown"
              );
              const description =
                error instanceof Error && error.message
                  ? error.message
                  : fallbackDescription;
              toaster.error({
                title: t("Layout.toast.acceptChallengeError.title"),
                description,
              });
            } finally {
              pendingChallengeOffersRef.current.delete(messageId);
              pendingChallengeByUserRef.current.delete(pendingOffer.from);
            }
          } else {
            try {
              await webrtcDeclineCall(
                socket,
                pendingOffer.from,
                globalUser.uid
              );
            } catch (error) {
              console.error("Failed to send decline signal:", error);
            } finally {
              pendingChallengeOffersRef.current.delete(messageId);
              pendingChallengeByUserRef.current.delete(pendingOffer.from);
              pendingIceCandidatesRef.current.delete(pendingOffer.from);
            }
          }
          return;
        }

        if (accepted) {
          toaster.success({
            title: t("Layout.toast.challengeAccepted.title"),
            description: t("Layout.toast.challengeAccepted.description", {
              name: responder,
            }),
          });

          const participantIds = [challengerId, opponentId].filter(
            (id): id is string => Boolean(id)
          );

          if (participantIds.length) {
            cancelPendingChallengesInvolving({
              participantIds,
              excludeMessageIds: [messageId],
              reason: AUTO_RESOLVE_RESPONDER,
              currentUserId: viewerSnapshot?.uid,
              declineChallenge: declineChallengeWithSocket,
            });
          }

          const activeLobbyId = currentLobbyIdRef.current || DEFAULT_LOBBY_ID;
          const normalizedLobby = activeLobbyId.trim().toLowerCase();
          const inferredGameName =
            normalizedLobby === "vampire" ? "vsavj" : undefined;

          const involvesMock =
            isMockUserId(challengerId) || isMockUserId(opponentId);

          if (involvesMock) {
            const mockUid = isMockUserId(challengerId)
              ? challengerId
              : opponentId;
            const mockName = resolveMockDisplayName(
              mockUid,
              t("Layout.mock.defaultOpponent")
            );
            const localPlayerSlot: 0 | 1 =
              globalUser?.uid && globalUser.uid === challengerId ? 0 : 1;

            markMatchStarted(mockUid, {
              matchId: messageId,
              playerSlot: localPlayerSlot,
              mode: "mock",
            });
            void startMockMatch({
              matchId: messageId,
              opponentName: mockName,
              gameName: inferredGameName ?? null,
              playerSlot: localPlayerSlot,
            }).catch((error) => {
              console.error("Failed to start mock match:", error);
              markMatchEnded();
              toaster.error({
                title: t("Layout.toast.matchStartError.title"),
                description: t("Layout.toast.matchStartError.description"),
              });
            });
          } else if (
            viewerSnapshot?.uid &&
            opponentId &&
            viewerSnapshot.uid === opponentId
          ) {
            const preferenceTarget =
              typeof challengerId === "string" ? challengerId : undefined;
            let preferredSlot: 0 | 1 | null = null;
            if (viewerSnapshot && preferenceTarget) {
              preferredSlot = resolvePreferredSlot(
                viewerSnapshot,
                preferenceTarget
              );
            }
            sendSocketMessage({
              type: "request-match",
              challengerId,
              opponentId,
              requestedBy: viewerSnapshot.uid,
              lobbyId: activeLobbyId,
              gameName: inferredGameName,
              preferredSlot:
                typeof preferredSlot === "number" ? preferredSlot : undefined,
            });
          }
        } else {
          toaster.info({
            title: t("Layout.toast.challengeDeclined.title"),
            description: t("Layout.toast.challengeDeclined.description", {
              name: responder,
            }),
          });
        }
      })();
    },
    [
      cancelPendingChallengesInvolving,
      declineChallengeWithSocket,
      globalUser?.uid,
      globalUser?.userName,
      markMatchEnded,
      markMatchStarted,
      resolvePreferredSlot,
      sendSocketMessage,
      t,
    ]
  );

  const sendMiniGameMessage = useCallback(
    (payload: Record<string, unknown>) => {
      const socket = signalSocketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return;
      }
      try {
        socket.send(JSON.stringify(payload));
      } catch (error) {
        console.error("Failed to send mini-game message", error);
      }
    },
    []
  );

  const handleMiniGameInviteResponse = useCallback(
    (messageId: string, accepted: boolean, responderName?: string) => {
      const viewer = globalUserRef.current;
      if (!viewer?.uid) {
        toaster.error({
          title: t("Layout.toast.authRequiredRespond.title"),
          description: t("Layout.toast.authRequiredRespond.description"),
        });
        return;
      }
      const invite = pendingMiniGameInvitesRef.current.get(messageId);
      if (!invite) {
        toaster.error({
          title: t("Layout.toast.inviteExpired.title"),
          description: t("Layout.toast.inviteExpired.description"),
        });
        return;
      }
      const responder =
        responderName && responderName.trim().length
          ? responderName.trim()
          : viewer.userName || t("Layout.notifications.self");
      const status = accepted ? "accepted" : "declined";
      const { updateMessage } = useMessageStore.getState();
      updateMessage(messageId, {
        challengeStatus: status,
        challengeResponder: responder,
        challengeChallengerId: invite.challengerId,
        challengeOpponentId: invite.opponentId,
      });
      pendingMiniGameInvitesRef.current.delete(messageId);
      if (accepted) {
        sendMiniGameMessage({
          type: "mini-game-accept",
          sessionId: invite.sessionId,
          playerId: viewer.uid,
        });
        toaster.success({
          title: t("Layout.toast.duelAccepted.title"),
          description: t("Layout.toast.duelAccepted.description"),
        });
      } else {
        sendMiniGameMessage({
          type: "mini-game-decline",
          sessionId: invite.sessionId,
          playerId: viewer.uid,
          reason: "decline",
        });
      }
    },
    [sendMiniGameMessage, t]
  );

  const mentionHandles = useMemo(() => {
    const handles = new Set<string>();
    const username = globalUser?.userName?.trim();
    if (username) handles.add(username);

    const aliases = Array.isArray(globalUser?.knownAliases)
      ? (globalUser?.knownAliases as string[])
      : [];

    aliases.forEach((alias) => {
      if (typeof alias === "string" && alias.trim()) {
        handles.add(alias.trim());
      }
    });

    return Array.from(handles);
  }, [globalUser?.userName, globalUser?.knownAliases]);

  const mentionMatchers = useMemo(
    () => buildMentionRegexes(mentionHandles, "i"),
    [mentionHandles]
  );

  const [dismissedNotificationIds, setDismissedNotificationIds] = useState<
    Set<string>
  >(() => new Set());

  const hasRealOpponent = useMemo(() => {
    if (!Array.isArray(lobbyUsers) || !lobbyUsers.length) {
      return false;
    }

    return lobbyUsers.some((user) => {
      if (!user || !user.uid || user.uid === globalUser?.uid) {
        return false;
      }

      if (user.uid === MOCK_CHALLENGE_USER.uid) {
        return false;
      }

      return !user.uid.startsWith("mock-");
    });
  }, [globalUser?.uid, lobbyUsers]);

  const availableLobbies = useMemo(() => {
    const entries = new Map<string, LobbySummary>();

    lobbyList.forEach((lobby) => {
      if (!lobby?.name) return;
      entries.set(lobby.name, lobby);
    });

    if (!entries.has(DEFAULT_LOBBY_ID)) {
      entries.set(DEFAULT_LOBBY_ID, { name: DEFAULT_LOBBY_ID, users: 0 });
    }

    return Array.from(entries.values()).sort((a, b) => {
      const aUsers = a.users ?? 0;
      const bUsers = b.users ?? 0;
      if (bUsers !== aUsers) {
        return bUsers - aUsers;
      }
      return a.name.localeCompare(b.name);
    });
  }, [lobbyList]);

  const currentLobbyIdRef = useRef(currentLobbyId || DEFAULT_LOBBY_ID);

  useEffect(() => {
    currentLobbyIdRef.current = currentLobbyId || DEFAULT_LOBBY_ID;
  }, [currentLobbyId]);

  useEffect(() => {
    setCurrentMatches(applyDebugMatchInjection(serverMatchesRef.current));
  }, [currentLobbyId, applyDebugMatchInjection, setCurrentMatches]);

  const sendSocketStateUpdate = useCallback(
    (update: SocketStateUpdateDetail) => {
      const socket = signalSocketRef.current;
      const viewer = globalUserRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN || !viewer?.uid) {
        return;
      }
      const lobbyId = currentLobbyIdRef.current || DEFAULT_LOBBY_ID;
      try {
        socket.send(
          JSON.stringify({
            type: "updateSocketState",
            data: {
              lobbyId,
              uid: viewer.uid,
              stateToUpdate: update,
            },
          })
        );
      } catch (error) {
        console.error("Failed to send socket state update:", error);
      }
    },
    []
  );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<SocketStateUpdateDetail>).detail;
      if (!detail) return;
      sendSocketStateUpdate(detail);
    };
    window.addEventListener(SOCKET_STATE_EVENT, handler as EventListener);
    return () =>
      window.removeEventListener(SOCKET_STATE_EVENT, handler as EventListener);
  }, [sendSocketStateUpdate]);

  useEffect(() => {
    mutedUsersRef.current = mutedUsers || [];
  }, [mutedUsers]);

  useEffect(() => {
    if (!mutedUsers) return;
    sendSocketStateUpdate({ key: "mutedUsers", value: mutedUsers });
  }, [mutedUsers, sendSocketStateUpdate]);

  const finalizeMockMiniGame = useCallback(
    (sessionId: string, viewerChoice: MiniGameChoice | null) => {
      clearMockMiniGameTimer(sessionId);
      let chatMessage: TMessage | null = null;
      setMiniGameState((prev) => {
        if (!prev || prev.sessionId !== sessionId) return prev;
        if (prev.mode !== "mock") return prev;
        const viewerUid = globalUserRef.current?.uid || prev.challengerId;
        const viewerIsChallenger = viewerUid === prev.challengerId;
        const challengerChoice = viewerIsChallenger
          ? viewerChoice
          : randomMiniGameChoice();
        const opponentChoice = viewerIsChallenger
          ? randomMiniGameChoice()
          : viewerChoice;
        let outcome: "win" | "draw" | "forfeit" | "declined" = "draw";
        let winnerUid: string | undefined;
        let loserUid: string | undefined;
        if (challengerChoice && !opponentChoice) {
          outcome = "forfeit";
          winnerUid = prev.challengerId;
          loserUid = prev.opponentId;
        } else if (!challengerChoice && opponentChoice) {
          outcome = "forfeit";
          winnerUid = prev.opponentId;
          loserUid = prev.challengerId;
        } else if (!challengerChoice && !opponentChoice) {
          outcome = "draw";
        } else {
          const evaluation = evaluateRps(challengerChoice, opponentChoice);
          if (evaluation === "draw") {
            outcome = "draw";
          } else if (evaluation === "a") {
            outcome = "win";
            winnerUid = prev.challengerId;
            loserUid = prev.opponentId;
          } else if (evaluation === "b") {
            outcome = "win";
            winnerUid = prev.opponentId;
            loserUid = prev.challengerId;
          }
        }
        const result: MiniGameResultPayload = {
          sessionId: prev.sessionId,
          challengerId: prev.challengerId,
          opponentId: prev.opponentId,
          gameType: prev.gameType,
          choices: {
            [prev.challengerId]: challengerChoice || null,
            [prev.opponentId]: opponentChoice || null,
          },
          winnerUid,
          loserUid,
          outcome,
        };
        const viewerChoiceForState = viewerIsChallenger
          ? challengerChoice
          : opponentChoice;
        const challengerLabel = resolveUserName(prev.challengerId);
        const opponentLabel = resolveUserName(prev.opponentId);
        const mockOutcomeText =
          outcome === "draw"
            ? t("Layout.chat.rpsOutcomeDraw")
            : winnerUid
            ? t("Layout.chat.rpsOutcomeWon", {
                name: resolveUserName(winnerUid),
              })
            : t("Layout.chat.rpsOutcomeConcluded");
        chatMessage = {
          id: `mock-mini-game-${prev.sessionId}`,
          role: "system",
          text: t("Layout.chat.rpsResult", {
            challenger: challengerLabel,
            challengerChoice: formatMiniGameChoice(challengerChoice),
            opponent: opponentLabel,
            opponentChoice: formatMiniGameChoice(opponentChoice),
            outcome: mockOutcomeText,
          }),
          timeStamp: Date.now(),
        };
        const store = useUserStore.getState();
        const viewerSnapshot = store.globalUser;
        const opponentUid =
          viewerUid === prev.challengerId ? prev.opponentId : prev.challengerId;
        const opponentSnapshot = store.lobbyUsers.find(
          (entry) => entry.uid === opponentUid
        );
        const baseViewerElo = viewerSnapshot?.rpsElo ?? DEFAULT_RPS_ELO;
        const baseOpponentElo = opponentSnapshot?.rpsElo ?? DEFAULT_RPS_ELO;
        let viewerDelta = 0;
        let opponentDelta = 0;
        if (outcome === "win" && winnerUid && loserUid) {
          if (winnerUid === viewerUid) {
            viewerDelta = MOCK_RPS_ELO_DELTA;
            opponentDelta = -MOCK_RPS_ELO_DELTA;
          } else if (loserUid === viewerUid) {
            viewerDelta = -MOCK_RPS_ELO_DELTA;
            opponentDelta = MOCK_RPS_ELO_DELTA;
          }
        }
        const ratings: Record<string, number> = {};
        const ratingChanges: Record<string, number> = {};
        ratings[viewerUid] = baseViewerElo + viewerDelta;
        ratingChanges[viewerUid] = viewerDelta;
        if (opponentUid) {
          ratings[opponentUid] = baseOpponentElo + opponentDelta;
          ratingChanges[opponentUid] = opponentDelta;
        }
        result.ratings = ratings;
        result.ratingChanges = ratingChanges;
        if (viewerSnapshot) {
          store.setGlobalUser({
            ...viewerSnapshot,
            rpsElo: ratings[viewerUid],
          });
        }
        if (opponentUid && opponentSnapshot) {
          store.setLobbyUsers(
            store.lobbyUsers.map((entry) =>
              entry.uid === opponentUid
                ? { ...entry, rpsElo: ratings[opponentUid] }
                : entry
            )
          );
        }
        return {
          ...prev,
          status: "resolved",
          viewerChoice: viewerChoiceForState || undefined,
          result,
        };
      });
      if (chatMessage) {
        useMessageStore.getState().addChatMessage(chatMessage);
      }
    },
    [clearMockMiniGameTimer, resolveUserName, t]
  );

  const startMockMiniGame = useCallback(
    (opponentUid: string) => {
      const viewer = globalUserRef.current;
      if (!viewer?.uid) return;
      const sessionId = `mock-rps-${Date.now()}`;
      const expiresAt = Date.now() + 10_000;
      setMiniGameState({
        sessionId,
        challengerId: viewer.uid,
        opponentId: opponentUid,
        gameType: "rps",
        expiresAt,
        phase: "active",
        isInitiator: true,
        status: "pending",
        mode: "mock",
      });
      const timerId = window.setTimeout(() => {
        finalizeMockMiniGame(sessionId, null);
      }, expiresAt - Date.now());
      mockMiniGameTimers.current.set(sessionId, timerId);
      const opponentName = resolveUserName(opponentUid);
      toaster.info({
        title: t("Layout.toast.mockDuelStarted.title"),
        description: t("Layout.toast.mockDuelStarted.description", {
          name: opponentName,
        }),
      });
    },
    [finalizeMockMiniGame, resolveUserName, t]
  );

  useEffect(() => {
    if (!globalLoggedIn) {
      setCurrentLobbyId(DEFAULT_LOBBY_ID);
      setLobbyList([]);
      setLobbyUsers([]);
      clearChatMessages();
      closeLobbyManager();
      pendingMiniGameInvitesRef.current.clear();
    }
  }, [
    clearChatMessages,
    globalLoggedIn,
    closeLobbyManager,
    setCurrentLobbyId,
    setLobbyList,
    setLobbyUsers,
  ]);

  const handleLobbyManagerOpen = useCallback(() => {
    openLobbyManager();
  }, [openLobbyManager]);

  const handleMiniGameChallenge = useCallback(
    (targetUid: string) => {
      const viewer = globalUserRef.current;
      if (!viewer?.uid) {
        toaster.error({
          title: t("Layout.toast.authRequiredDuel.title"),
          description: t("Layout.toast.authRequiredDuel.description"),
        });
        return;
      }
      if (viewer.uid === targetUid) {
        return;
      }
      if (isMockUserId(targetUid)) {
        startMockMiniGame(targetUid);
        return;
      }
      const socket = signalSocketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        toaster.error({
          title: t("Layout.toast.signalDisconnectedDuel.title"),
          description: t("Layout.toast.signalDisconnectedDuel.description"),
        });
        return;
      }
      sendMiniGameMessage({
        type: "mini-game-challenge",
        challengerId: viewer.uid,
        opponentId: targetUid,
        gameType: "rps",
      });
      const targetUser = useUserStore
        .getState()
        .lobbyUsers.find((entry) => entry.uid === targetUid);
      const waitingLabel = targetUser
        ? t("Layout.toast.duelInviteSent.waitingForName", {
            name: targetUser.userName,
          })
        : t("Layout.toast.duelInviteSent.waiting");
      toaster.success({
        title: t("Layout.toast.duelInviteSent.title"),
        description: waitingLabel,
      });
    },
    [sendMiniGameMessage, startMockMiniGame, t]
  );

  const handleMatchStats = useCallback(async (rawData: string) => {
    if (!rawData?.trim()) {
      return;
    }

    matchUploadPendingRef.current = true;
    try {
      const parsed = parseMatchData(rawData);
      if (!parsed) return;

      const pickValue = (entry: unknown): string | number | undefined => {
        if (Array.isArray(entry)) {
          const last = entry[entry.length - 1];
          return typeof last === "string" || typeof last === "number"
            ? last
            : undefined;
        }
        return typeof entry === "string" || typeof entry === "number"
          ? entry
          : undefined;
      };

      const matchUuidEntry = parsed["match-uuid"];
      const rawMatchUuid = pickValue(matchUuidEntry);
      const matchUuid =
        rawMatchUuid !== undefined ? String(rawMatchUuid) : undefined;
      if (matchUuid && lastMatchUuidRef.current === matchUuid) {
        return;
      }
      if (matchUuid) {
        lastMatchUuidRef.current = matchUuid;
      }

      const viewer = globalUserRef.current;
      if (!viewer?.uid) return;

      const isPlayerOne = localPlayerSlotRef.current === 0;
      if (!auth.currentUser) {
        return;
      }
      const opponentUid = opponentUidRef.current;
      const involvesMockOpponent = opponentUid ? isMockUserId(opponentUid) : false;
      if (!isPlayerOne && opponentUid && !involvesMockOpponent) {
        console.info(
          "[match-tracker] skipping upload because this client is not the designated uploader",
          {
            slot: localPlayerSlotRef.current,
            opponent: opponentUid,
          }
        );
        return;
      }

      const resolvedOpponentUid = opponentUid || "unknown-opponent";
      const shouldUseDevMatch =
        !activeMatchIdRef.current || isMockUserId(opponentUidRef.current || "");
      const matchId =
        (shouldUseDevMatch ? DEV_MATCH_ID : activeMatchIdRef.current) ||
        matchUuid ||
        `local-${viewer.uid}-${Date.now()}`;

      const condensed = buildCondensedMatchPayload(parsed);
      const limitedRaw = JSON.stringify(condensed);
      await api.uploadMatchData(auth, {
        matchId,
        player1: isPlayerOne ? viewer.uid : resolvedOpponentUid,
        player2: isPlayerOne ? resolvedOpponentUid : viewer.uid,
        matchData: { raw: limitedRaw },
      });
    } catch (error) {
      console.error("Failed to upload match data", error);
    } finally {
      matchUploadPendingRef.current = false;
    }
  }, []);

  useEffect(() => {
    if (!isTauriEnv()) {
      return;
    }

    let cancelled = false;
    let busy = false;

    if (import.meta.env.DEV) {
      console.info("[match-tracker] poller armed");
    }

    const poll = async () => {
      if (cancelled || busy) return;
      if (matchUploadPendingRef.current) {
        return;
      }
      busy = true;
      try {
        const command = await readMatchCommandFile();
        if (!command || !command.trim().length) {
          return;
        }
        await clearMatchCommandFile();

        console.debug("[match-tracker] command contents:", command);

        if (!command.toLowerCase().includes("read-tracking-file")) {
          return;
        }

        if (winSoundEnabled && winSoundPath) {
          void playSoundFile(winSoundPath);
        }

        const rawStats = await readMatchStatsFile();
        await clearMatchStatsFile();
        if (rawStats && rawStats.trim()) {
          console.info("[match-tracker] received stats payload; uploading…");
          await handleMatchStats(rawStats);
        }
      } catch (error) {
        console.error("Failed to process match tracking data", error);
      } finally {
        busy = false;
      }
    };

    const intervalId = window.setInterval(() => {
      void poll();
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [
    globalLoggedIn,
    globalUser?.uid,
    handleMatchStats,
    playSoundFile,
    winSoundEnabled,
    winSoundPath,
  ]);

  const handleLobbyManagerClose = useCallback(() => {
    closeLobbyManager();
  }, [closeLobbyManager]);

  const handleJoinLobby = useCallback(
    (lobby: LobbySummary, pass: string): string | null => {
      if (!globalUser) {
        const description = t(
          "Layout.toast.authRequiredLobbyChange.description"
        );
        toaster.error({
          title: t("Layout.toast.authRequiredLobbyChange.title"),
          description,
        });
        return description;
      }

      const trimmedPass = lobby.isPrivate ? pass.trim() : "";
      if (lobby.isPrivate && !trimmedPass.length) {
        return t("Layout.errors.lobbyPasswordRequired");
      }

      const payloadUser = { ...globalUser, lobbyId: lobby.name };
      const sent = sendSocketMessage({
        type: "changeLobby",
        newLobbyId: lobby.name,
        pass: trimmedPass,
        isPrivate: lobby.isPrivate,
        user: payloadUser,
      });

      if (!sent) {
        return t("Layout.errors.lobbyServerUnavailable");
      }

      setCurrentLobbyId(lobby.name);
      clearChatMessages();
      setLobbyUsers([]);
      toaster.success({
        title: t("Layout.toast.lobbyJoined.title"),
        description: t("Layout.toast.lobbyJoined.description", {
          name: lobby.name,
        }),
      });
      return null;
    },
    [
      clearChatMessages,
      globalUser,
      sendSocketMessage,
      setCurrentLobbyId,
      setLobbyUsers,
      t,
    ]
  );

  const startChallenge = useCallback(
    async (targetUid: string) => {
      const viewer = globalUserRef.current;
      if (isInMatchRef.current) {
        toaster.info({
          title: t("Layout.toast.alreadyInMatch.title"),
          description: t("Layout.toast.alreadyInMatch.description"),
        });
        return;
      }

      if (!viewer?.uid) {
        toaster.error({
          title: t("Layout.toast.authRequiredChallenge.title"),
          description: t("Layout.toast.authRequiredChallenge.description"),
        });
        return;
      }

      cancelPendingChallengesForChallenger({
        challengerId: viewer.uid,
        reason: AUTO_DECLINE_RESPONDER,
        currentUserId: viewer.uid,
        declineChallenge: declineChallengeWithSocket,
      });

      if (isMockUserId(targetUid)) {
        const lobbyId = currentLobbyIdRef.current || DEFAULT_LOBBY_ID;
        const normalizedLobby = lobbyId.trim().toLowerCase();
        const inferredGameName =
          normalizedLobby === "vampire" ? "vsavj" : undefined;
        const mockName = resolveMockDisplayName(
          targetUid,
          t("Layout.mock.defaultOpponent")
        );

        const mockMatchId = `mock-${Date.now()}`;
        markMatchStarted(targetUid, {
          matchId: mockMatchId,
          playerSlot: 0,
          mode: "mock",
        });
        try {
          await startMockMatch({
            matchId: mockMatchId,
            opponentName: mockName,
            gameName: inferredGameName ?? null,
            playerSlot: 0,
          });
        } catch (error) {
          console.error("Failed to start mock challenge:", error);
          markMatchEnded();
          toaster.error({
            title: t("Layout.toast.matchStartError.title"),
            description: t("Layout.toast.matchStartError.description"),
          });
        }
        return;
      }

      const socket = signalSocketRef.current;
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        toaster.error({
          title: t("Layout.toast.signalDisconnectedChallenge.title"),
          description: t("Layout.toast.signalDisconnectedChallenge.description"),
        });
        return;
      }

      try {
        if (opponentUidRef.current) {
          closeConnectionWithUser(opponentUidRef.current);
          opponentUidRef.current = null;
        }
        if (peerConnectionRef.current) {
          try {
            peerConnectionRef.current.close();
          } catch (error) {
            console.error("Failed to close previous peer connection:", error);
          }
          peerConnectionRef.current = null;
        }

        const peer = await initWebRTC(viewer.uid, targetUid, socket);
        peerConnectionRef.current = peer;
        opponentUidRef.current = targetUid;
        pendingPreferredSlotRef.current = null;
        const preferredSlot = viewer
          ? resolvePreferredSlot(viewer, targetUid)
          : null;
        pendingPreferredSlotRef.current = preferredSlot;
        sentMatchRequestRef.current.delete(targetUid);
        await startCall(peer, socket, targetUid, viewer.uid, true);
        toaster.success({
          title: t("Layout.toast.challengeSent.title"),
          description: t("Layout.toast.challengeSent.description"),
        });
      } catch (error) {
        console.error("Failed to initiate challenge:", error);
        pendingPreferredSlotRef.current = null;
        toaster.error({
          title: t("Layout.toast.challengeFailed.title"),
          description: t("Layout.toast.challengeFailed.description"),
        });
      }
    },
    [
      declineChallengeWithSocket,
      globalUser?.uid,
      markMatchEnded,
      markMatchStarted,
      resolvePreferredSlot,
      t,
    ]
  );

  const submitMiniGameChoice = useCallback(
    (choice: MiniGameChoice) => {
      const viewer = globalUserRef.current;
      const session = miniGameStateRef.current;
      if (!viewer?.uid || !session || session.status !== "pending") {
        return;
      }
      if (session.mode === "mock") {
        setMiniGameState((prev) =>
          prev && prev.sessionId === session.sessionId
            ? { ...prev, viewerChoice: choice, status: "submitted" }
            : prev
        );
        window.setTimeout(
          () => finalizeMockMiniGame(session.sessionId, choice),
          600
        );
        return;
      }
      setMiniGameState((prev) =>
        prev && prev.sessionId === session.sessionId
          ? { ...prev, viewerChoice: choice, status: "submitted" }
          : prev
      );
      sendMiniGameMessage({
        type: "mini-game-choice",
        sessionId: session.sessionId,
        playerId: viewer.uid,
        choice,
      });
    },
    [finalizeMockMiniGame, sendMiniGameMessage]
  );

  const declineMiniGame = useCallback(() => {
    const viewer = globalUserRef.current;
    const session = miniGameStateRef.current;
    if (!viewer?.uid || !session) return;
    if (session.mode === "mock") {
      clearMockMiniGameTimer(session.sessionId);
      setMiniGameState(null);
      return;
    }
    sendMiniGameMessage({
      type: "mini-game-decline",
      sessionId: session.sessionId,
      playerId: viewer.uid,
      reason: "decline",
    });
    setMiniGameState(null);
  }, [clearMockMiniGameTimer, sendMiniGameMessage]);

  const closeMiniGame = useCallback(() => {
    setMiniGameState((prev) => {
      if (!prev) return prev;
      if (prev.status === "resolved" || prev.status === "declined") {
        if (prev.mode === "mock") {
          clearMockMiniGameTimer(prev.sessionId);
        }
        return null;
      }
      return prev;
    });
  }, [clearMockMiniGameTimer]);

  const activeMiniGameOpponentName = useMemo(() => {
    if (!miniGameState) return undefined;
    const viewerUid = globalUser?.uid;
    if (!viewerUid) return undefined;
    const opponentUid =
      viewerUid === miniGameState.challengerId
        ? miniGameState.opponentId
        : miniGameState.challengerId;
    return resolveUserName(opponentUid);
  }, [globalUser?.uid, miniGameState, resolveUserName]);

  const handleMiniGameSideSelection = useCallback(
    async (side: "player1" | "player2") => {
      const viewer = globalUserRef.current;
      const session = miniGameStateRef.current;
      if (!viewer?.uid || !session) {
        return;
      }
      const opponentUid =
        viewer.uid === session.challengerId
          ? session.opponentId
          : session.challengerId;
      if (!opponentUid) return;

      if (session.mode === "mock") {
        const entry = {
          side,
          ownerUid: viewer.uid,
          opponentUid,
          expiresAt: Date.now() + 60 * 60 * 1000,
        };
        applySidePreferenceLocally(entry, opponentUid);
        setMiniGameState((prev) =>
          prev && prev.sessionId === session.sessionId
            ? { ...prev, sidePreferenceSubmitted: true }
            : prev
        );
        toaster.success({
          title: t("Layout.toast.sidePreferenceSavedMock.title"),
          description: t(
            "Layout.toast.sidePreferenceSavedMock.description",
            {
              side: t(
                side === "player1"
                  ? "Layout.sides.player1"
                  : "Layout.sides.player2"
              ),
              name: resolveUserName(opponentUid),
            }
          ),
        });
        return;
      }

      if (!auth.currentUser) {
        toaster.error({
          title: t("Layout.toast.authRequiredSidePreference.title"),
          description: t(
            "Layout.toast.authRequiredSidePreference.description"
          ),
        });
        return;
      }

      setMiniGameSideLoading(true);
      try {
        const payload = await api.setSidePreference(auth, {
          opponentUid,
          side,
        });
        if (payload?.ownerEntry) {
          applySidePreferenceLocally(payload.ownerEntry, opponentUid);
          if (payload.opponentEntry) {
            sendMiniGameMessage({
              type: "mini-game-side-lock",
              ownerEntry: payload.ownerEntry,
              opponentEntry: payload.opponentEntry,
            });
          }
          toaster.success({
            title: t("Layout.toast.sidePreferenceSaved.title"),
            description: t("Layout.toast.sidePreferenceSaved.description", {
              side: t(
                side === "player1"
                  ? "Layout.sides.player1"
                  : "Layout.sides.player2"
              ),
            }),
          });
          setMiniGameState((prev) =>
            prev && prev.sessionId === session.sessionId
              ? { ...prev, sidePreferenceSubmitted: true }
              : prev
          );
        } else {
          toaster.error({
            title: t("Layout.toast.sidePreferenceSaveError.title"),
            description: t("Layout.toast.sidePreferenceSaveError.description"),
          });
        }
      } catch (error) {
        console.error("Failed to set side preference", error);
        toaster.error({
          title: t("Layout.toast.sidePreferenceSaveError.title"),
          description: t("Layout.toast.sidePreferenceSaveError.description"),
        });
      } finally {
        setMiniGameSideLoading(false);
      }
    },
    [
      applySidePreferenceLocally,
      clearMockMiniGameTimer,
      resolveUserName,
      sendMiniGameMessage,
      t,
    ]
  );

  const handleCreateLobby = useCallback(
    (input: {
      name: string;
      isPrivate: boolean;
      pass: string;
    }): string | null => {
      if (!globalUser) {
        const description = t(
          "Layout.toast.authRequiredLobbyCreate.description"
        );
        toaster.error({
          title: t("Layout.toast.authRequiredLobbyCreate.title"),
          description,
        });
        return description;
      }

      const trimmedName = input.name.trim();
      if (!trimmedName.length) {
        return t("Layout.errors.lobbyNameRequired");
      }
      if (
        trimmedName.length < LOBBY_NAME_MIN_LENGTH ||
        trimmedName.length > LOBBY_NAME_MAX_LENGTH
      ) {
        return t("Layout.errors.lobbyNameLength", {
          min: LOBBY_NAME_MIN_LENGTH,
          max: LOBBY_NAME_MAX_LENGTH,
        });
      }

      if (trimmedName === DEFAULT_LOBBY_ID) {
        return t("Layout.errors.lobbyNameDefault");
      }

      if (lobbyNameMatcher.hasMatch(trimmedName)) {
        return t("Layout.errors.lobbyNameInappropriate");
      }

      const trimmedPass = input.isPrivate ? input.pass.trim() : "";
      if (input.isPrivate && !trimmedPass.length) {
        return t("Layout.errors.privateLobbyPasswordRequired");
      }

      if (input.isPrivate && trimmedPass.length > 150) {
        return t("Layout.errors.passwordMaxLength");
      }

      const exists = availableLobbies.some(
        (lobby) => lobby.name.toLowerCase() === trimmedName.toLowerCase()
      );
      if (exists) {
        return t("Layout.errors.lobbyNameExists");
      }

      const payloadUser = { ...globalUser, lobbyId: trimmedName };
      const sent = sendSocketMessage({
        type: "createLobby",
        lobbyId: trimmedName,
        pass: trimmedPass,
        isPrivate: input.isPrivate,
        user: payloadUser,
      });

      if (!sent) {
        return t("Layout.errors.lobbyServerUnavailable");
      }

      const optimisticLobby: LobbySummary = {
        name: trimmedName,
        users: 1,
        isPrivate: input.isPrivate,
      };

      const current = useUserStore.getState().lobbies;
      const next = [
        ...current.filter((lobby) => lobby.name !== trimmedName),
        optimisticLobby,
      ];
      setLobbyList(next);
      setCurrentLobbyId(trimmedName);
      clearChatMessages();
      setLobbyUsers([]);
      toaster.success({
        title: t("Layout.toast.lobbyCreated.title"),
        description: t("Layout.toast.lobbyCreated.description", {
          name: trimmedName,
        }),
      });
      return null;
    },
    [
      availableLobbies,
      clearChatMessages,
      globalUser,
      sendSocketMessage,
      setCurrentLobbyId,
      setLobbyList,
      setLobbyUsers,
      t,
    ]
  );

  const notificationEntries: NotificationEntry[] = useMemo(() => {
    if (!Array.isArray(chatMessages)) return [];

    const entries: NotificationEntry[] = [];
    const dismissed = dismissedNotificationIds;

    chatMessages.forEach((msg) => {
      if (!msg?.id || dismissed.has(msg.id)) {
        return;
      }

      const senderId =
        msg.senderUid ||
        msg.challengeChallengerId ||
        (typeof (msg as any).senderId === "string"
          ? (msg as any).senderId
          : undefined);

      if (senderId && mutedUsers.includes(senderId)) {
        return;
      }

      if (msg.role === "challenge") {
        entries.push({ message: msg, kind: "challenge" });
        return;
      }

      if (!msg.text || !mentionMatchers.length) {
        return;
      }

      const text = msg.text ?? "";
      const hasMention = mentionMatchers.some((matcher) => {
        matcher.lastIndex = 0;
        return matcher.test(text);
      });

      if (hasMention) {
        entries.push({ message: msg, kind: "mention" });
      }
    });

    return entries.sort((a, b) => {
      const aTime = a.message.timeStamp ?? 0;
      const bTime = b.message.timeStamp ?? 0;
      return bTime - aTime;
    });
  }, [chatMessages, mentionMatchers, dismissedNotificationIds, mutedUsers]);

  const handleClearNotifications = useCallback(() => {
    if (!notificationEntries.length) {
      return;
    }

    const ids = notificationEntries.map((entry) => entry.message.id);
    if (!ids.length) {
      return;
    }

    setDismissedNotificationIds((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => next.add(id));
      return next;
    });

    const socket = signalSocketRef.current;
    if (socket && globalUser?.uid) {
      const challengeTargets = notificationEntries
        .filter((entry) => entry.kind === "challenge")
        .map((entry) => {
          const sender = (entry.message as any).sender || {};
          return (
            entry.message.challengeChallengerId ||
            sender.uid ||
            sender.userUID ||
            sender.id ||
            null
          );
        })
        .filter(
          (uid): uid is string => typeof uid === "string" && uid.length > 0
        );

      challengeTargets.forEach((uid) => {
        webrtcDeclineCall(socket, uid, globalUser.uid).catch((error) => {
          console.error("Failed to decline challenge for", uid, error);
        });
      });
    }

    closeNotifications();
    toaster.success({
      title: t("Layout.toast.notificationsCleared.title"),
    });
  }, [closeNotifications, globalUser?.uid, notificationEntries, t]);

  const unreadCount = notificationEntries.length;
  const seenNotificationIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const seen = seenNotificationIdsRef.current;
    const nextSeen = new Set(
      notificationEntries.map((entry) => entry.message.id)
    );

    if (!notificationsMuted) {
      const newEntries = notificationEntries.filter(
        (entry) => !seen.has(entry.message.id)
      );

      newEntries.forEach((entry) => {
        if (entry.kind === "challenge") {
          if (!notifChallengeSoundEnabled || !notifChallengeSoundPath) return;
          void playSoundFile(notifChallengeSoundPath);
        } else {
          if (!notifMentionSoundEnabled || !notifMentionSoundPath) return;
          void playSoundFile(notifMentionSoundPath);
        }
      });
    }

    seenNotificationIdsRef.current = nextSeen;
  }, [
    notificationEntries,
    notificationsMuted,
    notifChallengeSoundEnabled,
    notifChallengeSoundPath,
    notifMentionSoundEnabled,
    notifMentionSoundPath,
    playSoundFile,
  ]);

  useEffect(() => {
    if (!globalLoggedIn || !globalUser?.uid || hasRealOpponent) {
      return;
    }

    const viewerSnapshot = globalUserRef.current;
    const activeLobbyId = currentLobbyIdRef.current || DEFAULT_LOBBY_ID;
    if (activeLobbyId.toLowerCase() !== "debug") {
      return;
    }

    const runMockInteraction = () => {
      const mockUser =
        buildMockForLobby(activeLobbyId, mockActionIndexRef.current) ||
        MOCK_CHALLENGE_USER;
      const now = Date.now();
      const addChatMessage = useMessageStore.getState().addChatMessage;
      const shouldChallenge = Math.random() < 0.4;

      if (shouldChallenge && MOCK_CHALLENGE_LINES.length) {
        const challengeLine =
          MOCK_CHALLENGE_LINES[
            mockActionIndexRef.current % MOCK_CHALLENGE_LINES.length
          ];
        const challengeText = t("Layout.chat.mockChallengeDescription", {
          name: mockUser.userName,
          line: challengeLine,
        });
        const challengeMessage: TMessage & { sender: TUser } = {
          id: `mock-challenge-${now}`,
          role: "challenge",
          text: challengeText,
          timeStamp: now,
          userName: mockUser.userName,
          sender: mockUser,
          senderUid: mockUser.uid,
          challengeChallengerId: mockUser.uid,
          challengeOpponentId: viewerSnapshot?.uid,
        };
        addChatMessage(challengeMessage);
        if (!mutedUsers.includes(mockUser.uid)) {
          toaster.info({
            title: t("Layout.toast.mockChallengeIncoming.title"),
            description: t("Layout.toast.mockChallengeIncoming.description", {
              name: mockUser.userName,
              line: challengeLine,
            }),
          });
        }
        mockActionIndexRef.current += 1;
        return;
      }

      if (!MOCK_CHAT_LINES.length) {
        return;
      }

      const chatTemplate =
        MOCK_CHAT_LINES[mockActionIndexRef.current % MOCK_CHAT_LINES.length];
      const friendFallback = t("Layout.chat.friendFallback");
      const playerName =
        (viewerSnapshot?.userName ?? friendFallback).trim() || friendFallback;
      const chatMessage: TMessage = {
        id: `mock-message-${now}`,
        role: "user",
        text: chatTemplate.replace("{player}", playerName),
        timeStamp: now,
        userName: mockUser.userName,
        senderUid: mockUser.uid,
      };
      addChatMessage(chatMessage);
      mockActionIndexRef.current += 1;
    };

    runMockInteraction();
    const intervalId = window.setInterval(
      runMockInteraction,
      MOCK_ACTION_INTERVAL_MS
    );
    return () => window.clearInterval(intervalId);
  }, [
    globalLoggedIn,
    globalUser?.uid,
    currentLobbyId,
    hasRealOpponent,
    mutedUsers,
    t,
  ]);

  const statusColor =
    STATUS_COLOR_MAP[signalStatus] ?? STATUS_COLOR_MAP.disconnected;
  const statusLabel =
    STATUS_LABEL_MAP[signalStatus] ?? STATUS_LABEL_MAP.disconnected;

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<SendMessageEventDetail>).detail;
      if (!detail) return;

      const trimmed = detail.text?.trim();
      if (!trimmed) {
        detail.onError?.(t("Layout.errors.messageEmpty"));
        return;
      }

      if (!globalUser?.uid) {
        detail.onError?.(t("Layout.errors.loginRequiredChat"));
        return;
      }

      const messageId = `${globalUser.uid ?? "message"}-${Date.now()}`;
      const payload = {
        type: "sendMessage",
        message: trimmed,
        messageId,
        sender: {
          ...globalUser,
          lobbyId: currentLobbyIdRef.current || DEFAULT_LOBBY_ID,
        },
      };

      const sent = sendSocketMessage(payload);
      if (!sent) {
        detail.onError?.(t("Layout.errors.messageServer"));
        return;
      }

      detail.onSuccess?.();
    };

    window.addEventListener("ws:send-message", handler as EventListener);
    return () =>
      window.removeEventListener("ws:send-message", handler as EventListener);
  }, [globalUser, sendSocketMessage, t]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ChallengeResponseDetail>).detail;
      if (!detail?.messageId) return;

      if (detail.kind === "rps") {
        handleMiniGameInviteResponse(
          detail.messageId,
          detail.accepted,
          detail.responderName
        );
        return;
      }

      handleChallengeResponse(
        detail.messageId,
        detail.accepted,
        detail.responderName
      );
    };

    window.addEventListener(
      "lobby:challenge-response",
      handler as EventListener
    );
    return () =>
      window.removeEventListener(
        "lobby:challenge-response",
        handler as EventListener
      );
  }, [handleChallengeResponse, handleMiniGameInviteResponse]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<ChallengeEventDetail>).detail;
      if (!detail?.targetUid) return;

      void startChallenge(detail.targetUid);
    };

    window.addEventListener("lobby:challenge-user", handler as EventListener);
    return () =>
      window.removeEventListener(
        "lobby:challenge-user",
        handler as EventListener
      );
  }, [startChallenge]);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<{ targetUid: string }>).detail;
      if (!detail?.targetUid) return;
      handleMiniGameChallenge(detail.targetUid);
    };
    window.addEventListener("lobby:rps-duel", handler as EventListener);
    return () =>
      window.removeEventListener("lobby:rps-duel", handler as EventListener);
  }, [handleMiniGameChallenge]);

  const handleForceCloseMatch = useCallback(
    async (options?: { notifyServer?: boolean; silent?: boolean }) => {
      const shouldNotifyServer = options?.notifyServer ?? true;
      const silent = options?.silent ?? false;
      const hadActiveMatch = isInMatchRef.current;
      const previousMode = currentMatchModeRef.current;

      if (shouldNotifyServer && previousMode === "live") {
        notifyMatchStatus("end");
        const viewer = globalUserRef.current;
        if (viewer?.uid) {
          sendSocketMessage({
            type: "matchEnd",
            userUID: viewer.uid,
          });
        }
      }

      const runTeardown = async () => {
        if (!isTauriEnv()) return;
        await Promise.all([
          invoke("kill_emulator_only").catch(() => {}),
          invoke("kill_mock_emulators").catch(() => {}),
          invoke("stop_proxy").catch(() => {}),
        ]);
      };

      try {
        await runTeardown();
        if (!silent && hadActiveMatch) {
          toaster.info({
            title: t("Layout.toast.forceClosingMatch.title"),
            description: t("Layout.toast.forceClosingMatch.description"),
          });
        }
      } catch (error) {
        console.error("Failed to force close emulator", error);
        if (!silent && hadActiveMatch) {
          toaster.error({
            title: t("Layout.toast.forceCloseFailed.title"),
            description: t("Layout.toast.forceCloseFailed.description"),
          });
        }
      } finally {
        markMatchEnded();
      }
    },
    [markMatchEnded, notifyMatchStatus, sendSocketMessage, t]
  );

  const handleEndMatch = useCallback(() => {
    void handleForceCloseMatch({ notifyServer: true, silent: true });
  }, [handleForceCloseMatch]);

  useEffect(() => {
    if (!isTauriEnv()) return;

    let tauriUnsubscribers: Array<() => void> = [];

    const attachTauriListeners = async () => {
      try {
        const unlistenEndMatch = await listen("endMatch", handleEndMatch);
        tauriUnsubscribers.push(unlistenEndMatch);
      } catch (error) {
        console.error("Failed to attach endMatch listener", error);
      }

      try {
        const unlistenEndMatchUi = await listen("endMatchUI", handleEndMatch);
        tauriUnsubscribers.push(unlistenEndMatchUi);
      } catch (error) {
        console.error("Failed to attach endMatchUI listener", error);
      }
    };

    void attachTauriListeners();

    return () => {
      tauriUnsubscribers.forEach((unsub) => {
        try {
          unsub();
        } catch (_) {
          // ignore
        }
      });
    };
  }, [handleEndMatch]);

  const changeRoute = (route: string) => {
    navigate({ to: route });
  };

  useEffect(() => {
    const userSnapshot = globalUserRef.current;

    if (!globalLoggedIn || !userSnapshot) {
      setSignalStatus("disconnected");
      setCurrentMatches([]);
      if (signalSocketRef.current) {
        signalSocketRef.current.close();
        signalSocketRef.current = null;
      }
      return;
    }

    setSignalStatus("connecting");
    const socketUrl = `ws://${keys.COTURN_IP}:${keys.SIGNAL_PORT ?? "3003"}`;
    const socket = new WebSocket(socketUrl);
    signalSocketRef.current = socket;
    peerLatencyManager.attachSocket(socket);
    let didError = false;

    socket.onopen = () => {
      setSignalStatus("connected");
      const latestUser = globalUserRef.current;
      if (!latestUser) {
        console.warn("Socket opened but no user snapshot available");
        socket.close();
        return;
      }

      const lobbyToJoin = currentLobbyIdRef.current || DEFAULT_LOBBY_ID;
      setCurrentLobbyId(lobbyToJoin);
      try {
        socket.send(
          JSON.stringify({
            type: "join",
            user: { ...latestUser, lobbyId: lobbyToJoin },
          })
        );
      } catch (error) {
        console.error("Failed to send join message to signal server:", error);
      }
    };

    socket.onerror = (event) => {
      didError = true;
      console.error("Signal server websocket error:", event);
      setSignalStatus("error");
      markMatchEnded();
    };

    socket.onclose = () => {
      signalSocketRef.current = null;
      if (peerConnectionRef.current) {
        try {
          peerConnectionRef.current.close();
        } catch (error) {
          console.error("Failed to close peer connection:", error);
        }
        peerConnectionRef.current = null;
        opponentUidRef.current = null;
      }
      markMatchEnded();
      if (!didError) {
        setSignalStatus("disconnected");
      }
    };

    socket.onmessage = async (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (!payload || typeof payload.type !== "string") return;

        const currentUserSnapshot = globalUserRef.current;

        switch (payload.type) {
          case "connected-users":
            if (Array.isArray(payload.users)) {
              const normalizedUsers = payload.users
                .map((entry: unknown) => normalizeSocketUser(entry))
                .filter((user: any): user is TUser => Boolean(user)); // TODO this typing is strange
              const activeLobbyId =
                currentLobbyIdRef.current || DEFAULT_LOBBY_ID;
              const injections = appendMockUsers(
                normalizedUsers,
                activeLobbyId,
                currentUserSnapshot
              );
              setLobbyUsers(injections.users);
              const store = useUserStore.getState();
              const prevViewer = store.globalUser;
              const injectedViewer =
                injections.viewer &&
                (!currentUserSnapshot ||
                  injections.viewer.uid !== currentUserSnapshot.uid)
                  ? injections.viewer
                  : null;
              const socketViewer =
                injectedViewer ||
                normalizedUsers.find(
                  (entry: TUser) =>
                    entry.uid && entry.uid === currentUserSnapshot?.uid
                );
              if (socketViewer) {
                const mergedViewer =
                  prevViewer && prevViewer.uid === socketViewer.uid
                    ? { ...prevViewer, ...socketViewer }
                    : socketViewer;
                const nextStreak =
                  typeof socketViewer.winStreak === "number"
                    ? socketViewer.winStreak
                    : typeof mergedViewer.winStreak === "number"
                    ? mergedViewer.winStreak
                    : typeof prevViewer?.winStreak === "number"
                    ? prevViewer.winStreak
                    : 0;
                const normalizedViewer = {
                  ...mergedViewer,
                  winStreak: nextStreak,
                };
                const prevStreak =
                  typeof prevViewer?.winStreak === "number"
                    ? prevViewer.winStreak
                    : 0;
                const streakChanged = prevStreak !== nextStreak;
                const roleChanged = prevViewer?.role !== mergedViewer.role;
                const eloChanged =
                  (prevViewer?.accountElo ?? null) !==
                  (mergedViewer.accountElo ?? null);
                const titleChanged =
                  (prevViewer?.userTitle?.title || "") !==
                  (mergedViewer.userTitle?.title || "");
                const viewerChanged =
                  !prevViewer ||
                  prevViewer.uid !== mergedViewer.uid ||
                  streakChanged ||
                  roleChanged ||
                  eloChanged ||
                  titleChanged;
                if (viewerChanged) {
                  store.setGlobalUser(normalizedViewer);
                }
              }
            }
            break;
          case "getRoomMessage": {
            if (typeof payload.message === "undefined") {
              break;
            }

            const textMessage = String(payload.message);
            const sender = payload.sender || {};
            const normalizedSender = normalizeSocketUser(sender);
            const timeStamp =
              typeof payload.timeStamp === "number"
                ? payload.timeStamp
                : Date.now();
            const messageId =
              typeof payload.id === "string" && payload.id.length
                ? payload.id
                : normalizedSender?.uid
                ? `${normalizedSender.uid}-${timeStamp}`
                : `message-${timeStamp}`;
            const message: TMessage = {
              id: messageId,
              role: "user",
              text: textMessage,
              timeStamp,
              senderUid: normalizedSender?.uid,
              userName:
                normalizedSender?.userName ||
                sender.userName ||
                sender.name ||
                sender.uid ||
                t("Layout.notifications.unknownUser"),
            };

            useMessageStore.getState().addChatMessage(message);
            break;
          }
          case "update-user-pinged": {
            const data = payload.data;
            if (!data || typeof data !== "object") {
              break;
            }

            const userStore = useUserStore.getState();
            const currentGlobal = userStore.globalUser;

            if (data.isNewPing) {
              const peerId =
                typeof data.id === "string"
                  ? data.id
                  : typeof data.id === "number"
                  ? String(data.id)
                  : undefined;
              if (peerId && currentGlobal) {
                const existingPings = Array.isArray(
                  currentGlobal.lastKnownPings
                )
                  ? currentGlobal.lastKnownPings
                  : [];
                const filtered = existingPings.filter(
                  (entry) => entry.id !== peerId
                );
                const rawPing = data.ping;
                const numericPing =
                  typeof rawPing === "number"
                    ? rawPing
                    : typeof rawPing === "string"
                    ? Number(rawPing)
                    : undefined;
                const nextViewer = {
                  ...currentGlobal,
                  lastKnownPings: [
                    ...filtered,
                    {
                      id: peerId,
                      ping:
                        typeof numericPing === "number" &&
                        Number.isFinite(numericPing)
                          ? numericPing
                          : rawPing ?? 0,
                      isUnstable: Boolean(data.isUnstable),
                      countryCode:
                        typeof data.countryCode === "string"
                          ? data.countryCode
                          : undefined,
                    },
                  ],
                };
                userStore.setGlobalUser(nextViewer);
              }
              break;
            }

            if (currentGlobal) {
              const updatedGlobal = {
                ...currentGlobal,
                pingLat:
                  typeof (data as any).pingLat === "number"
                    ? (data as any).pingLat
                    : currentGlobal.pingLat,
                pingLon:
                  typeof (data as any).pingLon === "number"
                    ? (data as any).pingLon
                    : currentGlobal.pingLon,
                countryCode:
                  typeof (data as any).countryCode === "string" &&
                  (data as any).countryCode.length
                    ? (data as any).countryCode
                    : currentGlobal.countryCode,
                lastKnownPings: Array.isArray((data as any).lastKnownPings)
                  ? (data as any).lastKnownPings
                  : currentGlobal.lastKnownPings,
              };
              userStore.setGlobalUser(updatedGlobal);

              const updatedLobbyUsers = userStore.lobbyUsers.map((entry) => {
                if (entry.uid !== updatedGlobal.uid) {
                  return entry;
                }
                return {
                  ...entry,
                  pingLat: updatedGlobal.pingLat,
                  pingLon: updatedGlobal.pingLon,
                  countryCode: updatedGlobal.countryCode,
                  lastKnownPings: updatedGlobal.lastKnownPings,
                };
              });
              userStore.setLobbyUsers(updatedLobbyUsers);
            }
            break;
          }
          case "lobby-user-counts": {
            const updates = Array.isArray(payload.updates)
              ? payload.updates
              : [];
            const lobbyMap = new Map<string, LobbySummary>();

            updates
              .filter((item: any) => item && typeof item.name === "string")
              .forEach((item: any) => {
                const name = String(item.name).trim();
                if (!name.length) return;

                const normalized: LobbySummary = {
                  name,
                  users: typeof item.users === "number" ? item.users : 0,
                  pass:
                    typeof item.pass === "string" && item.pass.length
                      ? item.pass
                      : undefined,
                  isPrivate:
                    typeof item.isPrivate === "boolean"
                      ? item.isPrivate
                      : Boolean(item.pass && item.pass.length),
                };

                lobbyMap.set(name, normalized);
              });

            if (!lobbyMap.has(DEFAULT_LOBBY_ID)) {
              lobbyMap.set(DEFAULT_LOBBY_ID, {
                name: DEFAULT_LOBBY_ID,
                users: 0,
              });
            }

            setLobbyList(Array.from(lobbyMap.values()));
            break;
          }
          case "lobby-joined":
            if (
              typeof payload.lobbyId === "string" &&
              payload.lobbyId.trim().length
            ) {
              setCurrentLobbyId(payload.lobbyId.trim());
              clearChatMessages();
            }
            break;
          case "lobby-closed":
            if (typeof payload.lobbyId === "string") {
              const lobbyId = payload.lobbyId.trim();
              const current = useUserStore.getState().lobbies;
              const next = current.filter((lobby) => lobby.name !== lobbyId);
              if (!next.some((lobby) => lobby.name === DEFAULT_LOBBY_ID)) {
                next.push({ name: DEFAULT_LOBBY_ID, users: 0 });
              }
              setLobbyList(next);
              if (currentLobbyIdRef.current === lobbyId) {
                setCurrentLobbyId(DEFAULT_LOBBY_ID);
                clearChatMessages();
                setLobbyUsers([]);
              }
            }
            break;
          case "mini-game-challenge": {
            const viewerId = globalUserRef.current?.uid;
            if (
              !viewerId ||
              !payload?.sessionId ||
              payload.gameType !== "rps" ||
              (payload.challengerId !== viewerId &&
                payload.opponentId !== viewerId)
            ) {
              break;
            }
            const phase = payload.phase === "invite" ? "invite" : "active";
            const existing = miniGameStateRef.current;
            if (
              existing &&
              existing.sessionId !== payload.sessionId &&
              existing.mode === "live" &&
              existing.status !== "resolved" &&
              existing.status !== "declined"
            ) {
              sendMiniGameMessage({
                type: "mini-game-decline",
                sessionId: payload.sessionId,
                playerId: viewerId,
                reason: "busy",
              });
              break;
            }
            if (phase === "invite") {
              if (payload.opponentId === viewerId) {
                const mutedList = mutedUsersRef.current || [];
                if (mutedList.includes(payload.challengerId)) {
                  sendMiniGameMessage({
                    type: "mini-game-decline",
                    sessionId: payload.sessionId,
                    playerId: viewerId,
                    reason: "muted",
                  });
                  break;
                }
                pendingMiniGameInvitesRef.current.set(payload.sessionId, {
                  sessionId: payload.sessionId,
                  challengerId: payload.challengerId,
                  opponentId: payload.opponentId,
                  expiresAt: payload.expiresAt,
                });
                const challengerName = resolveUserName(payload.challengerId);
                const { chatMessages, addChatMessage, updateMessage } =
                  useMessageStore.getState();
                const existingMessage = chatMessages.find(
                  (message) => message.id === payload.sessionId
                );
                const baseMessage: TMessage = {
                  id: payload.sessionId,
                  role: "challenge",
                  text: t("Layout.chat.sideSelectChallengePrompt", {
                    name: challengerName,
                  }),
                  timeStamp: Date.now(),
                  userName: challengerName,
                  senderUid: payload.challengerId,
                  challengeChallengerId: payload.challengerId,
                  challengeOpponentId: viewerId,
                  challengeKind: "rps",
                };
                if (existingMessage) {
                  updateMessage(payload.sessionId, {
                    ...baseMessage,
                    challengeStatus: undefined,
                    challengeResponder: undefined,
                  });
                } else {
                  addChatMessage(baseMessage);
                }
                toaster.info({
                  title: t("Layout.toast.sideSelectRequest.title"),
                  description: t(
                    "Layout.toast.sideSelectRequest.description",
                    { name: challengerName }
                  ),
                });
              } else {
                setMiniGameState({
                  sessionId: payload.sessionId,
                  challengerId: payload.challengerId,
                  opponentId: payload.opponentId,
                  gameType: payload.gameType,
                  expiresAt: payload.expiresAt,
                  phase: "invite",
                  isInitiator: true,
                  status: "pending",
                  mode: "live",
                });
              }
              break;
            }

            pendingMiniGameInvitesRef.current.delete(payload.sessionId);
            setMiniGameState({
              sessionId: payload.sessionId,
              challengerId: payload.challengerId,
              opponentId: payload.opponentId,
              gameType: payload.gameType,
              expiresAt: payload.expiresAt,
              phase: "active",
              isInitiator: payload.challengerId === viewerId,
              status: "pending",
              mode: "live",
            });
            break;
          }
          case "mini-game-challenge-denied": {
            const viewerId = globalUserRef.current?.uid;
            if (!viewerId || payload?.challengerId !== viewerId) {
              break;
            }
            let description = t("Layout.toast.duelNotSent.unknown");
            switch (payload.reason) {
              case "muted":
                description = t("Layout.toast.duelNotSent.muted");
                break;
              case "pending":
                description = t("Layout.toast.duelNotSent.pending");
                break;
              case "cooldown":
                if (typeof payload.retryInMs === "number") {
                  const seconds = Math.max(
                    1,
                    Math.ceil(payload.retryInMs / 1000)
                  );
                  description = t("Layout.toast.duelNotSent.cooldown", {
                    seconds,
                  });
                } else {
                  description = t("Layout.toast.duelNotSent.cooldownUnknown");
                }
                break;
              default:
                break;
            }
            toaster.error({
              title: t("Layout.toast.duelNotSent.title"),
              description,
            });
            break;
          }
          case "mini-game-result": {
            const viewerId = globalUserRef.current?.uid;
            if (
              !viewerId ||
              !payload?.sessionId ||
              (payload.challengerId !== viewerId &&
                payload.opponentId !== viewerId)
            ) {
              break;
            }
            const resultPayload = payload as MiniGameResultPayload;
            setMiniGameState((prev) =>
              prev && prev.sessionId === resultPayload.sessionId
                ? { ...prev, status: "resolved", result: resultPayload }
                : prev
            );
            const pendingInvite = pendingMiniGameInvitesRef.current.get(
              resultPayload.sessionId
            );
            if (pendingInvite) {
              pendingMiniGameInvitesRef.current.delete(resultPayload.sessionId);
              if (resultPayload.outcome === "declined") {
                useMessageStore
                  .getState()
                  .updateMessage(resultPayload.sessionId, {
                    challengeStatus: "declined",
                    challengeResponder:
                      resolveUserName(resultPayload.actorId) || "System",
                  });
              }
            }
            if (resultPayload.ratings && resultPayload.ratings[viewerId]) {
              const store = useUserStore.getState();
              const currentViewer = store.globalUser;
              if (currentViewer?.uid === viewerId) {
                store.setGlobalUser({
                  ...currentViewer,
                  rpsElo: resultPayload.ratings[viewerId],
                });
              }
            }
            const challengerName = resolveUserName(resultPayload.challengerId);
            const opponentName = resolveUserName(resultPayload.opponentId);
            const challengerChoice = formatMiniGameChoice(
              resultPayload.choices[resultPayload.challengerId]
            );
            const opponentChoice = formatMiniGameChoice(
              resultPayload.choices[resultPayload.opponentId]
            );
            const winnerName =
              resultPayload.winnerUid === resultPayload.challengerId
                ? challengerName
                : opponentName;
            const outcomeText =
              resultPayload.outcome === "draw"
                ? t("Layout.chat.rpsOutcomeDraw")
                : resultPayload.outcome === "declined"
                ? t("Layout.chat.rpsOutcomeDeclined")
                : t("Layout.chat.rpsOutcomeWon", { name: winnerName });
            useMessageStore.getState().addChatMessage({
              id: `mini-game-${resultPayload.sessionId}`,
              role: "system",
              text: t("Layout.chat.rpsResult", {
                challenger: challengerName,
                challengerChoice,
                opponent: opponentName,
                opponentChoice,
                outcome: outcomeText,
              }),
              timeStamp: Date.now(),
            });
            break;
          }
          case "mini-game-side-lock": {
            const viewerId = globalUserRef.current?.uid;
            if (!viewerId || !payload?.ownerEntry) {
              break;
            }
            if (payload.ownerEntry.ownerUid === viewerId) {
              applySidePreferenceLocally(
                payload.ownerEntry,
                payload.ownerEntry.opponentUid
              );
            } else if (
              payload.ownerEntry.opponentUid === viewerId &&
              payload.opponentEntry
            ) {
              applySidePreferenceLocally(
                payload.opponentEntry,
                payload.opponentEntry.opponentUid
              );
            }
            break;
          }
          case "peer-latency-offer":
          case "peer-latency-answer":
          case "peer-latency-candidate":
          case "peer-latency-decline": {
            peerLatencyManager.handleSignal(payload);
            break;
          }
          case "webrtc-ping-offer": {
            if (!currentUserSnapshot?.uid || !payload.from || !payload.offer) {
              break;
            }

            if (isInMatchRef.current) {
              try {
                webrtcDeclineCall(
                  socket,
                  payload.from,
                  currentUserSnapshot.uid
                );
              } catch (error) {
                console.error(
                  "Failed to auto-decline incoming challenge while in a match:",
                  error
                );
              }
              toaster.info({
                title: t("Layout.toast.incomingChallengeBusy.title"),
                description: t(
                  "Layout.toast.incomingChallengeBusy.description",
                  {
                    name: payload.from,
                  }
                ),
              });
              break;
            }

            const challengerUser = useUserStore
              .getState()
              .lobbyUsers.find((user) => user.uid === payload.from);
            const challengerName = challengerUser?.userName || payload.from;

            const existingMessageId = pendingChallengeByUserRef.current.get(
              payload.from
            );
            const messageId =
              existingMessageId ||
              `incoming-challenge-${payload.from}-${Date.now()}`;

            pendingChallengeOffersRef.current.set(messageId, {
              from: payload.from,
              offer: payload.offer,
            });
            pendingChallengeByUserRef.current.set(payload.from, messageId);
            pendingIceCandidatesRef.current.set(payload.from, []);

            const { addChatMessage, updateMessage } =
              useMessageStore.getState();
            if (existingMessageId) {
              updateMessage(existingMessageId, {
                timeStamp: Date.now(),
                text: t("Layout.chat.challengePrompt", {
                  name: challengerName,
                }),
                userName: challengerName,
                challengeStatus: undefined,
                challengeResponder: undefined,
              });
            } else {
              addChatMessage({
                id: messageId,
                role: "challenge",
                text: t("Layout.chat.challengePrompt", {
                  name: challengerName,
                }),
                timeStamp: Date.now(),
                userName: challengerName,
                senderUid: payload.from,
                challengeChallengerId: payload.from,
                challengeOpponentId: currentUserSnapshot?.uid,
              });
            }

            if (!mutedUsers.includes(payload.from)) {
              toaster.info({
                title: t("Layout.toast.incomingChallenge.title"),
                description: t("Layout.toast.incomingChallenge.description", {
                  name: challengerName,
                }),
              });
            }
            break;
          }
          case "webrtc-ping-answer": {
            if (!payload.from || !payload.answer) {
              break;
            }

            try {
              if (peerConnectionRef.current) {
                await peerConnectionRef.current.setRemoteDescription(
                  new RTCSessionDescription(payload.answer)
                );
                opponentUidRef.current = payload.from;
              }
            } catch (error) {
              console.error("Failed to handle answer:", error);
            }

            const activeLobbyId = currentLobbyIdRef.current || DEFAULT_LOBBY_ID;
            const normalizedLobby = activeLobbyId.trim().toLowerCase();
            const inferredGameName =
              normalizedLobby === "vampire" ? "vsavj" : undefined;
            const requesterUid = globalUserRef.current?.uid;

            if (
              requesterUid &&
              payload.from &&
              !isMockUserId(payload.from) &&
              !sentMatchRequestRef.current.has(payload.from)
            ) {
              const preferredSlot =
                typeof pendingPreferredSlotRef.current === "number"
                  ? pendingPreferredSlotRef.current
                  : undefined;
              pendingPreferredSlotRef.current = null;
              sendSocketMessage({
                type: "request-match",
                challengerId: requesterUid,
                opponentId: payload.from,
                requestedBy: requesterUid,
                lobbyId: activeLobbyId,
                gameName: inferredGameName,
                preferredSlot,
              });
              sentMatchRequestRef.current.add(payload.from);
            }
            break;
          }
          case "match-start": {
            const matchId =
              typeof payload.matchId === "string" ? payload.matchId : undefined;
            const opponentUid =
              typeof payload.opponentUid === "string"
                ? payload.opponentUid
                : undefined;
            const rawPlayerSlot =
              typeof payload.playerSlot === "number" ||
              typeof payload.playerSlot === "string"
                ? Number(payload.playerSlot)
                : undefined;

            if (!matchId || !opponentUid || rawPlayerSlot === undefined) {
              break;
            }

            const normalizedSlot: 0 | 1 = rawPlayerSlot === 0 ? 0 : 1;
            const serverHost =
              typeof payload.serverHost === "string" &&
              payload.serverHost.length
                ? payload.serverHost
                : undefined;
            const serverPort =
              typeof payload.serverPort === "number" ||
              typeof payload.serverPort === "string"
                ? Number(payload.serverPort)
                : undefined;
            const gameName =
              typeof payload.gameName === "string" && payload.gameName.length
                ? payload.gameName
                : undefined;

            try {
              markMatchStarted(opponentUid, {
                matchId,
                playerSlot: normalizedSlot,
                mode: "live",
              });
              await startProxyMatch({
                matchId,
                opponentUid,
                playerSlot: normalizedSlot,
                serverHost,
                serverPort,
                gameName,
              });
              sentMatchRequestRef.current.delete(opponentUid);
            } catch (error) {
              console.error("Failed to launch proxy match:", error);
              markMatchEnded();
              toaster.error({
                title: t("Layout.toast.matchStartError.title"),
                description: t("Layout.toast.matchStartError.description"),
              });
            }
            break;
          }
          case "match-force-close": {
            if (typeof payload?.opponentId === "string") {
              void closeConnectionWithUser(payload.opponentId);
            }
            void handleForceCloseMatch({
              notifyServer: false,
              silent: true,
            });
            toaster.info({
              title: t("Layout.toast.matchEnded.title"),
              description:
                typeof payload?.reason === "string"
                  ? payload.reason
                  : t("Layout.toast.matchEnded.opponentClosed"),
            });
            break;
          }
          case "matchEndedClose": {
            if (typeof payload?.userUID === "string") {
              void closeConnectionWithUser(payload.userUID);
            }
            void handleForceCloseMatch({ notifyServer: false, silent: true });
            break;
          }
          case "match-start-error": {
            markMatchEnded();
            if (typeof payload?.reason === "string") {
              toaster.error({
                title: t("Layout.toast.matchStartError.title"),
                description: payload.reason,
              });
            }
            if (typeof payload?.opponentId === "string") {
              sentMatchRequestRef.current.delete(payload.opponentId);
            }
            if (typeof payload?.challengerId === "string") {
              sentMatchRequestRef.current.delete(payload.challengerId);
            }
            break;
          }
          case "match-list": {
            if (Array.isArray(payload.matches)) {
              const normalizedMatches = payload.matches
                .map((entry: any) => normalizeMatchSummary(entry))
                .filter((entry): entry is MatchSummary => Boolean(entry));
              serverMatchesRef.current = normalizedMatches;
              setCurrentMatches(applyDebugMatchInjection(normalizedMatches));
            }
            break;
          }
          case "webrtc-ping-candidate": {
            if (!payload.candidate) {
              break;
            }

            try {
              if (
                peerConnectionRef.current &&
                payload.from &&
                opponentUidRef.current === payload.from
              ) {
                await peerConnectionRef.current.addIceCandidate(
                  new RTCIceCandidate(payload.candidate)
                );
              } else if (payload.from) {
                const queued =
                  pendingIceCandidatesRef.current.get(payload.from) || [];
                queued.push(payload.candidate);
                pendingIceCandidatesRef.current.set(payload.from, queued);
              }
            } catch (error) {
              console.error("Failed to add ICE candidate:", error);
            }
            break;
          }
          case "webrtc-ping-decline": {
            if (payload.from) {
              closeConnectionWithUser(payload.from);
              opponentUidRef.current = null;
              sentMatchRequestRef.current.delete(payload.from);
              toaster.info({
                title: t("Layout.toast.challengeDeclinedUnavailable.title"),
                description: t(
                  "Layout.toast.challengeDeclinedUnavailable.description",
                  { name: payload.from }
                ),
              });
            }
            break;
          }
          case "error":
            if (payload.message) {
              toaster.error({
                title: t("Layout.toast.lobbyServerError.title"),
                description: payload.message,
              });
            }
            break;
          default:
            break;
        }
      } catch (error) {
        console.error("Failed to process signal server payload:", error);
      }
    };

    return () => {
      socket.close();
      signalSocketRef.current = null;
      peerLatencyManager.attachSocket(null);
    };
  }, [
    clearChatMessages,
    globalLoggedIn,
    globalUser?.uid,
    markMatchEnded,
    markMatchStarted,
    setCurrentLobbyId,
    setLobbyList,
    setLobbyUsers,
    setCurrentMatches,
    setSignalStatus,
    resolveUserName,
    sendMiniGameMessage,
    applyDebugMatchInjection,
    t,
  ]);

  return (
    <>
      <Box
        display="flex"
        bg={layoutBackground.bg}
        bgImage={backgroundImageValue}
        bgRepeat={layoutBackground.overlay ? "no-repeat, repeat" : "repeat"}
        bgSize={layoutBackground.overlay ? "cover, 300% auto" : "300% auto"}
        color="fg.default"
        bgPosition={layoutBackground.overlay ? "center center, 0 0" : "0 0"}
        animation={`${scrollBackgroundAnimation} 60s linear infinite`}
      >
        <Stack gap="24px" padding={"12px"} {...navPanelStyles}>
          <Box height={"64px"} alignSelf={"center"} flex="1">
            <Image src={hrLogo} height={"64px"} />
          </Box>
          {globalLoggedIn ? (
            <Stack alignItems={"center"} gap="24px" flex="2">
              <IconButton
                colorPalette={accentColor}
                width={"40px"}
                height={"40px"}
                onClick={() => changeRoute("/home")}
                aria-label={t("Layout.aria.home")}
              >
                <LucideHome />
              </IconButton>
              <IconButton
                colorPalette={accentColor}
                width={"40px"}
                height={"40px"}
                onClick={() => changeRoute("/lobby")}
                aria-label={t("Layout.aria.lobby")}
              >
                <MessageCircle />
              </IconButton>
              <IconButton
                colorPalette={accentColor}
                width={"40px"}
                height={"40px"}
                onClick={() => changeRoute("/lab")}
                aria-label={t("Layout.aria.lab")}
              >
                <FlaskConical />
              </IconButton>
              <IconButton
                colorPalette={accentColor}
                width={"40px"}
                height={"40px"}
                onClick={() => changeRoute("/profile")}
                aria-label={t("Layout.aria.profile")}
              >
                <UserRound />
              </IconButton>
              {isAdmin ? (
                <IconButton
                  colorPalette={accentColor}
                  width={"40px"}
                  height={"40px"}
                  onClick={() => changeRoute("/admin")}
                  aria-label={t("Layout.aria.admin")}
                >
                  <ShieldHalf />
                </IconButton>
              ) : null}
            </Stack>
          ) : null}
          {globalLoggedIn ? (
            <Stack
              alignItems={"center"}
              flex="1"
              gap="24px"
              justifyContent={"flex-end"}
            >
              <IconButton
                colorPalette={accentColor}
                width={"40px"}
                height={"40px"}
                onClick={() => changeRoute("/settings")}
                aria-label={t("Layout.aria.settings")}
              >
                <Settings />
              </IconButton>
            </Stack>
          ) : null}
        </Stack>
        <Stack flex="1" height={"100vh"}>
          <Flex
            height={"48px"}
            {...headerStyles}
            alignItems={"center"}
            px="4"
            gap="3"
            justifyContent="space-between"
          >
            {globalLoggedIn ? (
              <Button
                size="sm"
                variant="outline"
                colorPalette={accentColor}
                onClick={handleLobbyManagerOpen}
              >
                {t("Layout.buttons.lobbyLabel", {
                  lobby: currentLobbyId || DEFAULT_LOBBY_ID,
                })}
              </Button>
            ) : null}
            <Flex display="flex" alignItems="center" gap="3">
              <UserCard />
              {globalLoggedIn ? (
                <Box position="relative">
                <IconButton
                  colorPalette={accentColor}
                  width={"40px"}
                  height={"40px"}
                  onClick={openNotifications}
                  aria-label={t("Layout.aria.notifications")}
                >
                  <Float placement="bottom-end">
                    <Circle size="5" bg="accent.default" color="fg.on-accent">
                      <Text fontSize="xs">
                        {unreadCount > 99
                          ? t("Layout.notifications.countOverflow")
                          : unreadCount}
                      </Text>
                    </Circle>
                  </Float>
                    {notificationsMuted ? <BellOff /> : <Bell />}
                  </IconButton>
                </Box>
              ) : // <Box>

              //   {unreadCount > 0 ? (
              //     <Float>
              //       <Box
              //       // position="absolute"
              //       // top="-4px"
              //       // right="-4px"
              //       // minWidth="18px"
              //       // height="18px"
              //       // borderRadius="full"
              //       // bg={`${accentColor}.500`}
              //       // color="white"
              //       // fontSize="xs"
              //       // display="flex"
              //       // alignItems="center"
              //       // justifyContent="center"
              //       // px="1"
              //       >
              //         {unreadCount > 99 ? "99+" : unreadCount}
              //       </Box>
              //     </Float>
              //   ) : null}
              // </Box>
              null}

              {isInMatch ? (
                <Button
                  size="sm"
                  variant="outline"
                  colorPalette="red"
                  onClick={handleForceCloseMatch}
                >
                  {t("Layout.buttons.forceCloseMatch")}
                </Button>
              ) : null}
            </Flex>
          </Flex>
          <Box
            flex="1"
            display="flex"
            flexDirection="column"
            height="calc(100vh - 120px)"
          >
            <Box flex="1" overflowY="auto" p="2" scrollbarWidth={"thin"}>
              {children}
            </Box>
          </Box>
          <Box
            h="24px"
            display="flex"
            justifyContent="space-between"
            alignItems="center"
            px="4"
            flexShrink={0}
            bg={footerStyles.bg}
            borderTop="1px solid"
            borderColor={footerStyles.borderColor}
          >
            {/* These links no longer work, needs to be resolved */}
            <Box display="flex" gap="8px">
              <a
                href="https://hyper-reflector.com/"
                target="_blank"
                rel="noreferrer"
              >
                <Text textStyle="xs">{t("Layout.footer.linksLabel")}</Text>
              </a>
              <a
                href="https://discord.gg/fsQEVzXwbt"
                target="_blank"
                rel="noreferrer"
              >
                <Text textStyle="xs">{t("Layout.footer.discord")}</Text>
              </a>
              <a
                href="https://github.com/Hyper-Reflector-Team"
                target="_blank"
                rel="noreferrer"
              >
                <Text textStyle="xs">{t("Layout.footer.github")}</Text>
              </a>
            </Box>

            <Flex alignItems="center" gap="3">
              <Box display="flex" alignItems="center" gap="2">
                <Box
                  width="10px"
                  height="10px"
                  borderRadius="9999px"
                  backgroundColor={statusColor}
                />
                <Text textStyle="xs" color={mutedLabelColor}>
                  {statusLabel}
                </Text>
              </Box>
              <Text textStyle="xs">{t("Layout.footer.version")}</Text>
            </Flex>
          </Box>
        </Stack>
      </Box>
      <LobbyManagerDialog
        isOpen={lobbyManagerOpen}
        onClose={handleLobbyManagerClose}
        accentColor={accentColor}
        currentLobbyId={currentLobbyId || DEFAULT_LOBBY_ID}
        availableLobbies={availableLobbies}
        lobbyNameMaxLength={LOBBY_NAME_MAX_LENGTH}
        onJoinLobby={handleJoinLobby}
        onCreateLobby={handleCreateLobby}
      />

      <MiniGameArena
        viewerId={globalUser?.uid}
        state={miniGameState}
        opponentName={activeMiniGameOpponentName}
        onSubmitChoice={submitMiniGameChoice}
        onDecline={declineMiniGame}
        onClose={closeMiniGame}
        onChooseSide={handleMiniGameSideSelection}
        sideSelectionPending={miniGameSideLoading}
      />

      <Drawer.Root
        open={notificationsOpen}
        onOpenChange={({ open }) => {
          if (!open) {
            closeNotifications();
          }
        }}
        size="sm"
      >
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content {...popoverSurfaceStyles} color="fg.default">
            <Drawer.CloseTrigger />
            <Drawer.Header>
              <Flex justify="space-between" align="center" gap="3">
                <Drawer.Title>{NOTIFICATIONS_TITLE}</Drawer.Title>
                <Button
                  size="xs"
                  variant="ghost"
                  onClick={() => handleClearNotifications()}
                  disabled={notificationEntries.length === 0}
                >
                  {t("Layout.buttons.clear")}
                </Button>
              </Flex>
              <Switch.Root
                colorPalette={accentColor}
                size="md"
                mt="2"
                display="flex"
                alignItems="center"
                justifyContent="space-between"
                gap="2"
                checked={notificationsMuted}
                onCheckedChange={(event) =>
                  setNotificationsMuted(event.checked)
                }
              >
                <Switch.HiddenInput />
                <Switch.Label fontSize="sm" color={mutedLabelColor}>
                  {t("Layout.notifications.mute")}
                </Switch.Label>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
              </Switch.Root>
            </Drawer.Header>
            <Drawer.Body>
              <VStack align="stretch">
                {notificationEntries.length === 0 ? (
                  <Text fontSize="sm" color={mutedLabelColor}>
                    {NO_NOTIFICATIONS_MESSAGE}
                  </Text>
                ) : (
                  notificationEntries.map(({ message: msg, kind }) => {
                    const isSelf = msg.userName === globalUser?.userName;
                    const isChallenge =
                      msg.role === "challenge" || kind === "challenge";
                    const challengeStatus = msg.challengeStatus;
                    const responderLabel =
                      msg.challengeResponder && msg.challengeResponder.length
                        ? msg.challengeResponder
                        : t("Layout.notifications.unknownPlayer");

                    return (
                      <Stack
                        key={msg.id}
                        borderWidth="1px"
                        borderRadius="md"
                        padding="3"
                        bg="bg.surface"
                        borderColor="border"
                      >
                        <Flex
                          justifyContent="space-between"
                          alignItems="center"
                        >
                          <Text
                            fontWeight="semibold"
                            color={isSelf ? `${accentColor}.500` : undefined}
                          >
                            {msg.userName ?? t("Layout.notifications.unknownUser")}
                          </Text>
                          <Text fontSize="xs" color={mutedLabelColor}>
                            {formatTimestamp(msg.timeStamp)}
                          </Text>
                        </Flex>
                        <Box height="1px" bg="border" />
                        <Flex alignItems="center" gap="2">
                          {isChallenge ? <Swords size={16} /> : null}
                          <Text fontSize="sm" whiteSpace="pre-wrap">
                            {msg.text || t("Layout.notifications.noMessage")}
                          </Text>
                        </Flex>
                        {isChallenge ? (
                          challengeStatus ? (
                            <Text
                              fontSize="xs"
                              color={
                                challengeStatus === "accepted"
                                  ? `${accentColor}.500`
                                  : "red.300"
                              }
                            >
                              {challengeStatus === "accepted"
                                ? t("Layout.notifications.challengeAccepted", {
                                    name: responderLabel,
                                  })
                                : t(
                                    "Layout.notifications.challengeDeclined",
                                    { name: responderLabel }
                                  )}
                            </Text>
                          ) : (
                            (() => {
                              const respondToNotification = (
                                accepted: boolean
                              ) => {
                                if (msg.challengeKind === "rps") {
                                  handleMiniGameInviteResponse(
                                    msg.id,
                                    accepted,
                                    globalUser?.userName
                                  );
                                } else {
                                  handleChallengeResponse(
                                    msg.id,
                                    accepted,
                                    globalUser?.userName
                                  );
                                }
                              };
                              return (
                                <HStack pt="1">
                                  <Button
                                    size="sm"
                                    colorPalette={accentColor}
                                    onClick={() => respondToNotification(true)}
                                  >
                                    {CHALLENGE_ACCEPT_LABEL}
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => respondToNotification(false)}
                                  >
                                    {CHALLENGE_DECLINE_LABEL}
                                  </Button>
                                </HStack>
                              );
                            })()
                          )
                        ) : null}
                      </Stack>
                    );
                  })
                )}
              </VStack>
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Drawer.Root>
    </>
  );
}
