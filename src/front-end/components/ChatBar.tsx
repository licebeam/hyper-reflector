import { useState } from 'react'
import { useLayoutStore, useLoginStore } from '../state/store'
import { Button, Stack, Input, Flex } from '@chakra-ui/react'
import { Send } from 'lucide-react'

export default function ChatBar() {
    const theme = useLayoutStore((state) => state.appTheme)
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)
    const userState = useLoginStore((state) => state.userState)
    const [message, setMessage] = useState('')

    const sendMessage = () => {
        if (message.length >= 1) {
            window.api.sendMessage({ text: message, user: userState })
        }
        setMessage('')
    }

    return (
        <Stack>
            {isLoggedIn && (
                <Flex gap="12px" padding="8px">
                    <Input
                        bg={theme.colors.main.text}
                        color={theme.colors.main.textDark}
                        placeholder="Type a message!"
                        maxW="300px"
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
                    <Button
                        id="message-send-btn"
                        onClick={sendMessage}
                        bg={theme.colors.main.secondary}
                        color={theme.colors.main.action}
                    >
                        <Send />
                    </Button>
                </Flex>
            )}
        </Stack>
    )
}
