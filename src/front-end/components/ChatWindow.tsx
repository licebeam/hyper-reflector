import { useRef, useEffect } from 'react'
import { Flex, Stack, Tabs, Box, Text } from '@chakra-ui/react'
import { useLoginStore, useMessageStore } from '../state/store'

export default function ChatWindow() {
    const messageState = useMessageStore((state) => state.messageState)
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)
    const pushMessage = useMessageStore((state) => state.pushMessage)

    const chatEndRef = useRef<null | HTMLDivElement>(null)

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    const handleRoomMessage = (messageObject) => {
        pushMessage({ sender: messageObject.sender, message: messageObject.message })
    }

    // get message from websockets
    useEffect(() => {
        window.api.removeAllListeners('sendRoomMessage', handleRoomMessage)
        window.api.on('sendRoomMessage', handleRoomMessage)
        return () => {
            window.api.removeListener('sendRoomMessage', handleRoomMessage)
        }
    }, [])

    const handleMessage = (text: string) => {
        const currentUser = useLoginStore.getState().userState
        pushMessage({ sender: currentUser.name, message: text })
    }

    // show our own message, but probably need to have the server handle this too
    useEffect(() => {
        window.api.removeExtraListeners('user-message', handleMessage)
        window.api.on('user-message', handleMessage)
        return () => {
            window.api.removeListener('user-message', handleMessage)
        }
    }, [])

    useEffect(() => {
        scrollToBottom()
    }, [messageState])

    const renderMessages = () => {
        return messageState.map((message, index) => {
            var timestamp = new Date()
            // really simple chat display
            return (
                <Flex
                    key={index + timestamp + message.message}
                    flexDirection="column"
                    width="100%"
                    wordBreak="break-word" // Ensures words wrap properly
                    whiteSpace="pre-wrap" // Preserves line breaks
                    p="2"
                    bg="gray.100"
                    borderRadius="md"
                    mb="1"
                >
                    <Text fontWeight="bold">{message.sender}</Text>
                    <Text>{message.message}</Text>
                </Flex>
            )
        })
    }

    return (
        <Stack height="100%" key={'chat'} overflowY="auto" id="chatbox-id">
            {isLoggedIn && (
                <Box paddingLeft='8px' paddingRight='8px'>
                    {renderMessages()}
                    <Box ref={chatEndRef} />
                </Box>
            )}
        </Stack>
    )
}
