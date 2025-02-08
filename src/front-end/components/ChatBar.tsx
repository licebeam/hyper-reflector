import * as React from 'react'
import styled from 'styled-components'
import { useLoginStore, useMessageStore } from '../state/store'

const Input = styled('input')(() => ({
    width: '100px'
}))

export default function ChatBar() {
    const [message, setMessage] = React.useState('')
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)

    const sendMessage = () => {
        if(message.length >= 1){
            window.api.sendMessage(message)
        }
        setMessage('')
    }

    return (
        <div style={{ display: 'flex' }}>
            {isLoggedIn &&
                <>
                    <Input onChange={(e) => setMessage(e.target.value)} type='text' value={message} onKeyDown={(e) => {
                        if (e.key === "Enter") {
                            sendMessage()
                        }
                    }} />
                    <button id='message-send-btn' onClick={sendMessage}>send message</button>
                </>
            }
        </div>
    )
}