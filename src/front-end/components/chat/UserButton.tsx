import { useEffect, useState } from 'react'
import { useLoginStore, useMessageStore } from '../../state/store'
import { Button, Stack, Input, Flex } from '@chakra-ui/react'

export default function UserButton({ user }) {
    const [isInMatch, setIsInMatch] = useState(false)
    const userState = useLoginStore((state) => state.userState)
    const callData = useMessageStore((state) => state.callData)
    const removeCallData = useMessageStore((state) => state.callData)

    const isUserChallenging = () => {
        console.log(callData)
        if (callData.find((call) => call.callerId === user.uid)) {
            return true
        }
        return false
    }

    useEffect(() => {
        console.log('should reset call', callData)
    }, [callData])

    return (
        <div>
            {user.name}
            {/* {user.uid} */}
            {!isUserChallenging() && user.uid !== userState.uid && (
                <Button
                    // disabled={isInMatch}
                    onClick={() => {
                        console.log(
                            'trying to call someone from: ',
                            userState.uid,
                            ' to => ',
                            user.uid
                        )
                        window.api.callUser({ callerId: userState.uid, calleeId: user.uid })
                    }}
                >
                    Challenge
                </Button>
            )}
            {isUserChallenging() && (
                <Button
                    // disabled={isInMatch}
                    onClick={() => {
                        const caller = callData.find((call) => call.callerId === user.uid)
                        // removeCallData(caller)
                        setIsInMatch(true)
                        window.api.answerCall(caller)
                    }}
                >
                    Accept
                </Button>
            )}
        </div>
    )
}
