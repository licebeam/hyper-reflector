import * as React from 'react'
import styled from 'styled-components'
import { useLoginStore, useMessageStore } from '../state/store'

export default function ChatWindow() {
    const messageState = useMessageStore((state) => state.messageState)
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)
    const pushMessage = useMessageStore((state) => state.pushMessage)

    const chatEndRef = React.useRef<null | HTMLDivElement>(null)

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
    }


    // get message from websockets
    React.useEffect(() => {
        const handleMessage = (messageObject) => {
            pushMessage({ sender: messageObject.sender, message: messageObject.message });
        };

        window.api.on('room-message', handleMessage);

        return () => {
            window.api.removeListener('room-message', handleMessage);
        };
    }, []);

    // show our own message, but probably need to have the server handle this too
    React.useEffect(() => {
        const handleMessage = (text: string) => {
            const currentUser = useLoginStore.getState().userState;
            pushMessage({ sender: currentUser.email, message: text });
        };

        window.api.on('user-message', handleMessage);

        return () => {
            window.api.removeListener('user-message', handleMessage);
        };
    }, []);

    React.useEffect(() => {
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
        <div style={{ display: 'flex', flexDirection: 'column' }}>
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