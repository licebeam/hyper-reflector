import { ChatPanel } from "../components/ChatPanel";
import { PlayerList } from "../components/PlayerList";
import type { V2User, V2Message } from "../types";

type LobbyPageProps = {
  messages: V2Message[];
  lobbyUsers: V2User[];
  currentUser: V2User | null;
  lobbyGame?: string;
  lobbyPassword?: string;
  onSendMessage: (text: string) => boolean;
  onViewProfile?: (uid: string) => void;
  onChallenge?: (uid: string) => void;
  onAcceptChallenge?: (messageId: string) => void;
  onDeclineChallenge?: (messageId: string) => void;
  challengeDisabled?: boolean;
  measuringUids?: ReadonlySet<string>;
  unreachableUids?: ReadonlySet<string>;
  onMeasurePing?: (uid: string) => void;
  // Dev/test tool — see startMockSpectateMatch (../match). The "Spectate" button on an
  // in-match pair only renders when this is provided; AppV2 only provides it in the debug
  // lobby, where the mock opponents are always shown paired up (useWebSocket/injectMockUsers).
  onSpectateMatch?: (matchId: string) => void;
};

export function LobbyPage({
  messages,
  lobbyUsers,
  currentUser,
  lobbyGame,
  lobbyPassword,
  onSendMessage,
  onViewProfile,
  onChallenge,
  onAcceptChallenge,
  onDeclineChallenge,
  challengeDisabled,
  measuringUids,
  unreachableUids,
  onMeasurePing,
  onSpectateMatch,
}: LobbyPageProps) {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Chat panel — takes remaining width */}
      <div className="flex-1 min-w-0">
        <ChatPanel
          messages={messages}
          currentUserUid={currentUser?.uid}
          currentUserName={currentUser?.userName}
          users={lobbyUsers}
          lobbyGame={lobbyGame}
          lobbyPassword={lobbyPassword}
          onSend={onSendMessage}
          onAcceptChallenge={onAcceptChallenge}
          onDeclineChallenge={onDeclineChallenge}
        />
      </div>

      {/* Player list sidebar */}
      <div className="w-80 shrink-0">
        <PlayerList
          users={lobbyUsers}
          currentUser={currentUser}
          lobbyGame={lobbyGame}
          onViewProfile={onViewProfile}
          onChallenge={onChallenge}
          challengeDisabled={challengeDisabled}
          measuringUids={measuringUids}
          unreachableUids={unreachableUids}
          onMeasurePing={onMeasurePing}
          onSpectateMatch={onSpectateMatch}
        />
      </div>
    </div>
  );
}
