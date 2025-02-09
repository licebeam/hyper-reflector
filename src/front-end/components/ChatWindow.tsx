import { useRef, useEffect } from 'react'
import styled from 'styled-components'
import { useLoginStore, useMessageStore } from '../state/store'

export default function ChatWindow() {
    const messageState = useMessageStore((state) => state.messageState)
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)
    const pushMessage = useMessageStore((state) => state.pushMessage)

    const chatEndRef = useRef<null | HTMLDivElement>(null)

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }

    const handleRoomMessage = (messageObject) => {
        pushMessage({ sender: messageObject.sender, message: messageObject.message });
    };

    // get message from websockets
    useEffect(() => {
        window.api.removeAllListeners('room-message', handleRoomMessage);
        window.api.on('room-message', handleRoomMessage);
        return () => {
            window.api.removeListener('room-message', handleRoomMessage);
        };
    }, []);

    const handleMessage = (text: string) => {
        const currentUser = useLoginStore.getState().userState;
        // console.log("Adding message to store:", { sender: currentUser.email, message: text });
        pushMessage({ sender: currentUser.email, message: text });
    };

    // show our own message, but probably need to have the server handle this too
    useEffect(() => {
        window.api.removeExtraListeners('user-message', handleMessage);
        window.api.on('user-message', handleMessage);
        return () => {
            window.api.removeListener('user-message', handleMessage);
        };
    }, []);

    useEffect(() => {
        scrollToBottom()
    }, [messageState])

    const renderMessages = () => {
        return messageState.map((message, index) => {
            var timestamp = new Date
            // really simple chat display
            return (<div key={index + timestamp + message.message}>{message.sender}: {message.message}</div>)
        })
    }

    return (
        <div key={'my-chatroom'} style={{ display: 'flex', flexDirection: 'column' }}>
            {isLoggedIn &&
                <div id='chatbox-id' style={{ height: 300, overflowY: 'scroll' }}>
                    <p> messages</p>
                    {renderMessages()}
                    <div ref={chatEndRef} />
                </div>
            }
        </div>
    )
}