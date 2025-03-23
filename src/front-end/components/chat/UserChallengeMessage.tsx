import { useRef, useEffect, useState } from 'react'
import { Flex, Stack, Tabs, Box, Text, Button } from '@chakra-ui/react'
import { useLoginStore, useMessageStore } from '../../state/store'

export default function UserChallengeMessage({ message }) {
    // console.log('message', message)
    const [isDeclined, setIsDeclined] = useState(false)
    const [isAccepted, setIsAccepted] = useState(false)
    const callData = useMessageStore((state) => state.callData)
    const clearCallData = useMessageStore((state) => state.clearCallData)
    var timestamp = new Date()
    return (
        <Flex
            key={timestamp + message.message}
            flexDirection="column"
            width="100%"
            wordBreak="break-word" // Ensures words wrap properly
            whiteSpace="pre-wrap" // Preserves line breaks
            p="2"
            borderRadius="md"
            mb="1"
            bg="gray.700"
        >
            {isAccepted && <div>Match Accepted</div>}
            {isDeclined && <div>Match Declined</div>}
            {!isAccepted && !isDeclined && (
                <>
                    <Text fontWeight="bold" color="blue.400">
                        {message.sender}
                    </Text>
                    <Text color="gray.50">{message.message}</Text>
                    {message.type && message.type === 'challenge' && (
                        <Box>
                            <Button
                                onClick={() => {
                                    console.log('accepting match')
                                    const caller = callData.find(
                                        (call) => call.callerId === message.sender
                                    )
                                    console.log(message)
                                    // setIsInMatch(true)
                                    window.api.answerCall(caller)
                                }}
                            >
                                Accept
                            </Button>
                            <Button
                                onClick={() => {
                                    setIsDeclined(true)
                                    console.log('accepting match')
                                    const caller = callData.find(
                                        (call) => call.callerId === message.sender
                                    )
                                    window.api.declineCall(caller)
                                    // clearCallData()
                                }}
                            >
                                Decline
                            </Button>
                        </Box>
                    )}
                </>
            )}
        </Flex>
    )
}
