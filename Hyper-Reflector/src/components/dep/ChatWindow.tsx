import { useRef, useEffect } from 'react'
import { Stack, Box } from '@chakra-ui/react'
import { useLoginStore, useMessageStore } from '../../state/deprecated_store'
import UserChallengeMessage from './chat/UserChallengeMessage'
import {
    RegExpMatcher,
    TextCensor,
    englishDataset,
    englishRecommendedTransformers,
} from 'obscenity'

const matcher = new RegExpMatcher({
    ...englishDataset.build(),
    ...englishRecommendedTransformers,
})

export default function ChatWindow() {
    const messageState = useMessageStore((state) => state.messageState)
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)
    const pushMessage = useMessageStore((state) => state.pushMessage)

    const chatEndRef = useRef<null | HTMLDivElement>(null)

    const scrollToBottom = () => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }

    const handleRoomMessage = (messageObject) => {
        // console.log(messageObject)
        // censor words before sending to BE
        const censor = new TextCensor()
        const input = messageObject.message
        const matches = matcher.getAllMatches(input)
        const censoredMessage = censor.applyTo(input, matches)
        const getSender = () => {
            // I think this is incorrect
            if (typeof messageObject.sender === 'string') {
                return messageObject.sender
            } else {
                return messageObject.sender.name
            }
        }
        // hey hey test new origin
        pushMessage({
            sender: getSender(),
            message: censoredMessage,
            type: messageObject.type || 'sendMessage',
            declined: false,
            accepted: messageObject.accepted || false,
            id: Date.now(), // TODO this is not a long lasting solution
        })
    }

    // get message from websockets
    useEffect(() => {
        window.api.removeAllListeners('sendRoomMessage', handleRoomMessage)
        window.api.on('sendRoomMessage', handleRoomMessage)

        return () => {
            window.api.removeListener('sendRoomMessage', handleRoomMessage)
        }
    }, [])

    useEffect(() => {
        scrollToBottom()
    }, [messageState])

    return (
        <Stack height="100%" key={'chat'} overflowY="auto" scrollbarWidth={'thin'} id="chatbox-id">
            {isLoggedIn && (
                <Box paddingLeft="8px" paddingRight="8px">
                    {messageState.map((message, index) => {
                        return (
                            <UserChallengeMessage
                                key={`challenge-message-${index}`}
                                message={message}
                            />
                        )
                    })}
                    <Box ref={chatEndRef} />
                </Box>
            )}
        </Stack>
    )
}
