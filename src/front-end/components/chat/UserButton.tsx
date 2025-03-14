import { useEffect, useState } from 'react'
import { useLoginStore, useMessageStore } from '../../state/store'
import { Button, Stack, Input, Flex } from '@chakra-ui/react'

export default function UserButton({ user }) {
    const [isInMatch, setIsInMatch] = useState(false)
    const [isUserChallenging, setIsUserChallenging] = useState(false)
    const userState = useLoginStore((state) => state.userState)
    const callData = useMessageStore((state) => state.callData)
    const removeCallData = useMessageStore((state) => state.removeCallData)
    const clearCallData = useMessageStore((state) => state.clearCallData)
    const setCallData = useMessageStore((state) => state.setCallData)

    useEffect(() => {
        console.log('call', callData)
        setIsUserChallenging((prevState) => {
            const found = callData.some((call) => call.callerId === user.uid)
            console.log(found ? 'Found USER in call' : 'Did not find user in call')
            return found // This ensures the state is always updated properly
        })
    }, [callData, user.uid])

    const handleEndMatch = () => {
        setIsInMatch(false)
        clearCallData()
        console.log('match ended----------------------------')
    }

    useEffect(() => {
        window.api.removeAllListeners('endMatchUI', handleEndMatch)
        window.api.on('endMatchUI', handleEndMatch)
        return () => {
            window.api.removeListener('endMatchUI', handleEndMatch)
        }
    }, [])

    return (
        <div>
            {user.name}
            {/* {user.uid} */}
            {!isUserChallenging && user.uid !== userState.uid && (
                <Button
                    disabled={isInMatch}
                    onClick={() => {
                        setIsInMatch(true)
                        console.log(
                            'trying to call someone from: ',
                            userState.uid,
                            ' to => ',
                            user.uid
                        )
                        window.api.callUser({ callerId: userState.uid, calleeId: user.uid })
                        // setCallData({ callerId: user.uid, type: 'test' })
                    }}
                >
                    Challenge
                </Button>
            )}
            {isUserChallenging && (
                <Button
                    disabled={isInMatch}
                    onClick={() => {
                        const caller = callData.find((call) => call.callerId === user.uid)
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
