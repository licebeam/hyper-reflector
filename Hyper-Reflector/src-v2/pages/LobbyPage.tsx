import { ChatPanel } from "../components/ChatPanel";
import { PlayerList } from "../components/PlayerList";
import type { V2User, V2Message } from "../types";

type LobbyPageProps = {
  messages: V2Message[];
  lobbyUsers: V2User[];
  currentUser: V2User | null;
  onSendMessage: (text: string) => boolean;
  onViewProfile?: (uid: string) => void;
  onChallenge?: (uid: string) => void;
  onAcceptChallenge?: (messageId: string) => void;
  onDeclineChallenge?: (messageId: string) => void;
};

export function LobbyPage({
  messages,
  lobbyUsers,
  currentUser,
  onSendMessage,
  onViewProfile,
  onChallenge,
  onAcceptChallenge,
  onDeclineChallenge,
}: LobbyPageProps) {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Chat panel — takes remaining width */}
      <div className="flex-1 min-w-0">
        <ChatPanel
          messages={messages}
          currentUserUid={currentUser?.uid}
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
          onViewProfile={onViewProfile}
          onChallenge={onChallenge}
        />
      </div>
    </div>
  );
}
