import { useRef, useEffect } from 'react'
import { Flex, Stack, Tabs, Box, Text, Button } from '@chakra-ui/react'
import { useLoginStore, useMessageStore } from '../state/store'
import UserChallengMEssage from './chat/UserChallengeMessage'
import UserChallengeMessage from './chat/UserChallengeMessage'

export default function ChatWindow() {
    const messageState = useMessageStore((state) => state.messageState)
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)
    const pushMessage = useMessageStore((state) => state.pushMessage)

    const callData = useMessageStore((state) => state.callData)
    const clearCallData = useMessageStore((state) => state.clearCallData)

    useEffect(() => {
        if (callData && callData.length) {
            console.log('call data', callData)
            const newestCaller = callData[callData.length - 1]
            pushMessage({
                sender: newestCaller.callerId,
                message: 'got a challenge',
                type: 'challenge',
            })
        }
    }, [callData])

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

    return (
        <Stack height="100%" key={'chat'} overflowY="auto" id="chatbox-id">
            {isLoggedIn && (
                <Box paddingLeft="8px" paddingRight="8px">
                    {messageState.map((message, index) => {
                        return <UserChallengeMessage message={message} />
                    })}
                    <Box ref={chatEndRef} />
                </Box>
            )}
        </Stack>
    )
}
