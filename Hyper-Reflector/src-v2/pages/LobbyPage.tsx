import { ChatPanel } from '../components/ChatPanel'
import { PlayerList } from '../components/PlayerList'
import type { V2User, V2Message } from '../types'

type LobbyPageProps = {
  messages: V2Message[]
  lobbyUsers: V2User[]
  currentUser: V2User | null
  onSendMessage: (text: string) => boolean
}

export function LobbyPage({ messages, lobbyUsers, currentUser, onSendMessage }: LobbyPageProps) {
  return (
    <div className="flex h-full overflow-hidden">
      {/* Chat panel — takes remaining width */}
      <div className="flex-1 min-w-0">
        <ChatPanel
          messages={messages}
          currentUserUid={currentUser?.uid}
          onSend={onSendMessage}
        />
      </div>

      {/* Player list sidebar */}
      <div className="w-56 shrink-0">
        <PlayerList
          users={lobbyUsers}
          currentUserUid={currentUser?.uid}
        />
      </div>
    </div>
  )
}
