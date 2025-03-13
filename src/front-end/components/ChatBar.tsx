import { useState } from 'react'
import { useLoginStore } from '../state/store'
import { Button, Stack, Input, Flex } from '@chakra-ui/react'

export default function ChatBar() {
    const [message, setMessage] = useState('')
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)

    const sendMessage = () => {
        if (message.length >= 1) {
            window.api.sendMessage(message)
        }
        setMessage('')
    }

    return (
        <Stack>
            {isLoggedIn && (
                <Flex gap="12px" padding='8px'>
                    <Input
                        maxW='300px'
                        autoFocus
                        onChange={(e) => setMessage(e.target.value)}
                        type="text"
                        value={message}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                sendMessage()
                            }
                        }}
                    />
                    <Button id="message-send-btn" onClick={sendMessage}>
                        send message
                    </Button>
                </Flex>
            )}
        </Stack>
    )
}
