import { useRef, useEffect, useState } from 'react'
import { Flex, Stack, Tabs, Box, Text, Button } from '@chakra-ui/react'
import { useMessageStore, useLoginStore } from '../../state/store'

export default function UserChallengeMessage({ message }) {
    // console.log('message', message)
    const [isDeclined, setIsDeclined] = useState(false)
    const [isAccepted, setIsAccepted] = useState(false)
    const callData = useMessageStore((state) => state.callData)
    const removeCallData = useMessageStore((state) => state.removeCallData)
    const updateMessage = useMessageStore((state) => state.updateMessage)
    const userList = useMessageStore((state) => state.userList)
    const updateUserState = useLoginStore((state) => state.updateUserState)

    var timestamp = new Date()
    console.log('message', message)
    return (
        <Flex
            key={timestamp + message.message}
            flexDirection="column"
            width="100%"
            wordBreak="break-word"
            whiteSpace="pre-wrap"
            p="2"
            borderRadius="md"
            mb="1"
            bg="gray.700"
        >
            {message.accepted && <div>Match Accepted</div>}
            {message.declined && <div>Match Declined</div>}
            {!message.declined && !message.accepted && (
                <>
                    <Stack>
                        <Text fontWeight="bold" color="blue.400">
                            {message.sender}
                        </Text>
                        <Text color="gray.50"> {message.message}</Text>
                    </Stack>
                    {message.type && message.type === 'challenge' && (
                        <Flex gap="8px">
                            <Button
                                onClick={() => {
                                    setIsAccepted(true)
                                    const caller = callData.find(
                                        (call) => call.callerId === message.sender
                                    )
                                    const updatedMessage = {
                                        ...message,
                                        accepted: true,
                                    }
                                    updateMessage(updatedMessage)
                                    window.api.answerCall(caller)
                                    updateUserState({ isFighting: true })
                                }}
                            >
                                Accept
                            </Button>
                            <Button
                                onClick={async () => {
                                    // remove the call from the call list
                                    const callToRemove = callData.find(
                                        (call) => call.callerId === message.sender
                                    )
                                    removeCallData(callToRemove)
                                    // set visual state for declining cal
                                    setIsDeclined(true)
                                    await window.api.declineCall(callToRemove)
                                    const updatedMessage = {
                                        ...message,
                                        declined: true,
                                    }
                                    updateMessage(updatedMessage)
                                    updateUserState({ isFighting: true })
                                }}
                            >
                                Decline
                            </Button>
                        </Flex>
                    )}
                </>
            )}
        </Flex>
    )
}
