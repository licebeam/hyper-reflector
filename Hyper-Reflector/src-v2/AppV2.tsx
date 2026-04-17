import "./styles.css";
import { useEffect, useState } from "react";
import bgImage from "../src/assets/bgImage.svg";
import { onAuthStateChanged } from "firebase/auth";
import { ThemeProvider, useV2Theme } from "./ThemeContext";
import { NavRail, type Page } from "./components/NavRail";
import { Header } from "./components/Header";
import { LobbyPage } from "./pages/LobbyPage";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { SettingsPage } from "./pages/SettingsPage";
import { LabPage } from "./pages/LabPage";
import { DataPage } from "./pages/DataPage";
import { TournamentPage } from "./pages/TournamentPage";
import { HomePage } from "./pages/HomePage";
import { ProfilesPage } from "./pages/ProfilesPage";
import { PlayerProfilePage } from "./pages/PlayerProfilePage";
import { LobbySelector } from "./components/LobbySelector";
import { useWebSocket } from "./hooks/useWebSocket";
import { auth } from "../src/utils/firebase";
import api from "../src/external-api/requests";
import { useUserStore } from "../src/state/store";
import type { V2User } from "./types";

type AuthState = "loading" | "unauthenticated" | "authenticated";

function mapToV2User(data: any, fallbackEmail?: string | null): V2User {
  return {
    uid: data.uid || "",
    userName: data.userName || "Player",
    accountElo: typeof data.accountElo === "number" ? data.accountElo : 1200,
    countryCode: data.countryCode || "",
    userTitle: data.userTitle,
    lastKnownPings: Array.isArray(data.lastKnownPings)
      ? data.lastKnownPings
      : [],
    knownAliases: Array.isArray(data.knownAliases) ? data.knownAliases : [],
    userProfilePic: data.userProfilePic || "",
    gravEmail: data.gravEmail || "",
    userEmail: data.userEmail || fallbackEmail || "",
    isRankQueued: false,
  };
}

// ── Inner app — has access to ThemeContext ────────────────────────────────────

function AppV2Inner() {
  const { vars } = useV2Theme();

  const [authState, setAuthState] = useState<AuthState>("loading");
  const [authView, setAuthView] = useState<"login" | "signup">("login");
  const [user, setUser] = useState<V2User | null>(null);
  const [page, setPage] = useState<Page>("lobby");
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [lobbySelectorOpen, setLobbySelectorOpen] = useState(false);

  const {
    status,
    isReconnecting,
    lobbyUsers,
    messages,
    subscribedLobbyIds,
    activeLobbyId,
    setActiveLobbyId,
    lobbyList,
    selfPings,
    sendMessage,
    subscribeLobby,
    unsubscribeLobby,
    reorderLobbies,
    updateLobbyGame,
    createLobby,
    sendChallenge,
    acceptChallenge,
    declineChallenge,
    toggleRankQueue,
  } = useWebSocket(user);

  useEffect(() => {
    return onAuthStateChanged(auth, async (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setAuthState("unauthenticated");
        return;
      }

      try {
        await api.addLoggedInUser(auth);
        const userData = await api.getUserByAuth(auth);

        const FALLBACK_TITLE = { bgColor: '#1f1f24', border: '#37373f', color: '#f2f2f7', title: 'Contender' };

        if (userData && userData.uid) {
          const v2User = mapToV2User(userData, firebaseUser.email);
          setUser(v2User);
          useUserStore.getState().setGlobalUser({
            uid: v2User.uid,
            userName: v2User.userName,
            accountElo: v2User.accountElo,
            countryCode: v2User.countryCode,
            gravEmail: v2User.gravEmail,
            knownAliases: v2User.knownAliases,
            userEmail: v2User.userEmail,
            userProfilePic: v2User.userProfilePic,
            userTitle: v2User.userTitle ?? FALLBACK_TITLE,
            lastKnownPings: v2User.lastKnownPings,
            role: "user",
            winStreak: 0,
            rpsElo: 1200,
            sidePreferences: {},
          });
        } else {
          throw new Error("Empty profile from backend");
        }
      } catch (err) {
        console.warn("[v2] Backend unavailable, using Firebase identity", err);
        const FALLBACK_TITLE = { bgColor: '#1f1f24', border: '#37373f', color: '#f2f2f7', title: 'Contender' };
        const pendingName = sessionStorage.getItem("v2_pending_display_name");
        const fallbackUser: V2User = {
          uid: firebaseUser.uid,
          userName:
            pendingName ||
            firebaseUser.displayName ||
            firebaseUser.email?.split("@")[0] ||
            "Player",
          accountElo: 1200,
          countryCode: "",
          lastKnownPings: [],
          knownAliases: [],
          userProfilePic: "",
          gravEmail: "",
          userEmail: firebaseUser.email || "",
          isRankQueued: false,
        };
        setUser(fallbackUser);
        useUserStore.getState().setGlobalUser({
          uid: fallbackUser.uid,
          userName: fallbackUser.userName,
          accountElo: fallbackUser.accountElo,
          countryCode: fallbackUser.countryCode,
          gravEmail: fallbackUser.gravEmail,
          knownAliases: fallbackUser.knownAliases,
          userEmail: fallbackUser.userEmail,
          userProfilePic: fallbackUser.userProfilePic,
          userTitle: FALLBACK_TITLE,
          lastKnownPings: [],
          role: "user",
          winStreak: 0,
          rpsElo: 1200,
          sidePreferences: {},
        });
      } finally {
        setAuthState("authenticated");
      }
    });
  }, []);

  const handleLogout = () => {
    setUser(null);
    setAuthState("unauthenticated");
    setPage("lobby");
    setViewingProfileId(null);
  };

  const handleViewProfile = (uid: string) => {
    setViewingProfileId(uid);
    setPage("profiles");
  };

  const handleNavigate = (p: Page) => {
    if (p !== "profiles") setViewingProfileId(null);
    setPage(p);
  };

  const handleChallenge = (uid: string) => {
    void sendChallenge(uid);
  };

  const handleAcceptChallenge = (messageId: string) => {
    void acceptChallenge(messageId);
  };

  const handleDeclineChallenge = (messageId: string) => {
    void declineChallenge(messageId);
  };

  const handleSetIsRankQueued = (isQueue: boolean) => {
    toggleRankQueue(isQueue);
    setUser((prev) => (prev ? { ...prev, isRankQueued: isQueue } : prev));
  };


  // Merge live ping data from the websocket into the current user so PlayerList
  // can resolve viewer→target ping via resolvePing().
  const effectiveUser: V2User | null =
    user && selfPings.length > 0
      ? { ...user, lastKnownPings: selfPings }
      : user;

  // CSS vars applied here cascade to every child via inheritance
  return (
    <div
      className="relative h-screen overflow-hidden v2-animated-bg"
      style={
        {
          ...(vars as unknown as React.CSSProperties),
          "--v2-bg-image": `url(${bgImage})`,
          color: "var(--v2-text)",
        } as React.CSSProperties
      }
    >
      {authState === "loading" && (
        <div className="h-full flex items-center justify-center">
          <div className="text-center space-y-2">
            <p
              className="font-bold text-lg"
              style={{ color: "var(--v2-accent)" }}
            >
              Hyper Reflector
            </p>
            <p
              className="text-sm animate-pulse"
              style={{ color: "var(--v2-muted)" }}
            >
              Loading...
            </p>
          </div>
        </div>
      )}

      {authState === "unauthenticated" && (
        <div className="h-full">
          {authView === "signup" ? (
            <SignupPage onBack={() => setAuthView("login")} />
          ) : (
            <LoginPage onSignup={() => setAuthView("signup")} />
          )}
        </div>
      )}

      {authState === "authenticated" && (
        <div className="flex h-full">
          <NavRail currentPage={page} onNavigate={handleNavigate} />

          {/* Disconnection warning banner */}
          {(status === "disconnected" || status === "error") && (
            <div
              className="fixed top-0 left-0 right-0 z-50 flex items-center justify-center gap-2 py-1.5 text-xs font-medium"
              style={{ background: isReconnecting ? "#78350f" : "#7f1d1d", color: "#fef3c7" }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full"
                style={{ background: isReconnecting ? "#fbbf24" : "#f87171", animation: isReconnecting ? "pulse 1.5s infinite" : "none" }}
              />
              {isReconnecting
                ? "Disconnected — reconnecting…"
                : "Disconnected from server"}
            </div>
          )}

          <div className="flex-1 flex flex-col overflow-hidden">
            <Header
              onToggleRankQueued={handleSetIsRankQueued}
              subscribedLobbyIds={subscribedLobbyIds}
              activeLobbyId={activeLobbyId}
              onSelectLobby={setActiveLobbyId}
              onCloseLobby={unsubscribeLobby}
              onAddLobby={() => setLobbySelectorOpen(true)}
              onReorderLobbies={reorderLobbies}
              status={status}
              currentUser={effectiveUser}
              onViewProfile={handleViewProfile}
              activeLobbyGame={lobbyList.find(l => l.name === activeLobbyId)?.gameName}
              activeLobbyOwnerUid={lobbyList.find(l => l.name === activeLobbyId)?.ownerUid}
              onUpdateLobbyGame={updateLobbyGame}
            />

            <main className="flex-1 overflow-hidden">
              {page === "lobby" && (
                <LobbyPage
                  messages={messages}
                  lobbyUsers={lobbyUsers}
                  currentUser={effectiveUser}
                  lobbyGame={lobbyList.find(l => l.name === activeLobbyId)?.gameName}
                  onSendMessage={sendMessage}
                  onViewProfile={handleViewProfile}
                  onChallenge={handleChallenge}
                  onAcceptChallenge={handleAcceptChallenge}
                  onDeclineChallenge={handleDeclineChallenge}
                />
              )}
              {page === "home" && <HomePage currentUser={user} />}
              {page === "lab" && <LabPage />}
              {page === "data" && <DataPage />}
              {page === "settings" && user && (
                <SettingsPage user={user} onLogout={handleLogout} />
              )}
              {page === "profiles" &&
                (viewingProfileId ? (
                  <PlayerProfilePage
                    profileUid={viewingProfileId}
                    currentUser={user}
                    onBack={() => setViewingProfileId(null)}
                    onUserUpdated={(updated) =>
                      setUser((prev) => (prev ? { ...prev, ...updated } : prev))
                    }
                  />
                ) : (
                  <ProfilesPage
                    currentUser={user}
                    onViewProfile={handleViewProfile}
                  />
                ))}
              {page === "pools" && <TournamentPage />}
            </main>
          </div>
        </div>
      )}

      {/* Lobby selector modal */}
      {lobbySelectorOpen && (
        <LobbySelector
          lobbies={lobbyList}
          currentLobbyId={activeLobbyId}
          subscribedLobbyIds={subscribedLobbyIds}
          onJoin={(id, pass) => subscribeLobby(id, pass)}
          onCreate={createLobby}
          onClose={() => setLobbySelectorOpen(false)}
        />
      )}
    </div>
  );
}

// ── Root export — provides theme context ──────────────────────────────────────

export default function AppV2() {
  return (
    <ThemeProvider>
      <AppV2Inner />
    </ThemeProvider>
  );
}
