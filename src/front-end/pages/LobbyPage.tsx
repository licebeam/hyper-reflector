import ChatWindow from '../components/ChatWindow'
import ChatBar from '../components/ChatBar'
import UsersChat from '../components/UsersChat'

export default function LobbyPage() {
    return (
        <div style={{ display: 'flex' }}>
            <div>
                <ChatWindow />
                <ChatBar />
            </div>
            <div>
                Users:
                <UsersChat />
            </div>
        </div>
    )
}
