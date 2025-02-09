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
            console.log('clean up room message event listeners')
            window.api.removeListener('room-message', handleRoomMessage);
        };
    }, []);

    const handleMessage = (text: string) => {
        const currentUser = useLoginStore.getState().userState;
        console.log("Adding message to store:", { sender: currentUser.email, message: text });
        pushMessage({ sender: currentUser.email, message: text });
    };

    // show our own message, but probably need to have the server handle this too
    useEffect(() => {
        window.api.removeExtraListeners('user-message', handleMessage);
        console.log('is this firing off how much')
        window.api.on('user-message', handleMessage);

        return () => {
            console.log("Cleaning up 'user-message' listener");
            window.api.removeListener('user-message', handleMessage);
        };
    }, []);

    useEffect(() => {
        console.log('new messages')
        scrollToBottom()
    }, [messageState])

    const renderMessages = () => {
        console.log('rendering messages')
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