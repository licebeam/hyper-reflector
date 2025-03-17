import { useEffect, useState } from 'react'
import { useLoginStore } from '../state/store'
import { Button, Stack, Input, Flex } from '@chakra-ui/react'

export default function PlayerProfilePage() {
    const userState = useLoginStore((state) => state.userState)
    const [recentMatches, setRecentMatches] = useState([])

    const handleSetRecentMatches = (matches) => {
        setRecentMatches(matches.recentMatches)
    }

    useEffect(() => {
        window.api.getUserMatches()
    }, [])

    useEffect(() => {
        // Listen for updates from Electron
        window.api.removeExtraListeners('getUserMatches', handleSetRecentMatches)
        window.api.on('getUserMatches', handleSetRecentMatches)

        return () => {
            window.api.removeListener('getUserMatches', handleSetRecentMatches)
        }
    }, [])

    return (
        <Stack>
            <Flex>Coming Soon</Flex>
            <div>Current Username: {userState.name}</div>
            <div>recent matches</div>
            <Stack>
                {recentMatches &&
                    recentMatches.map((match) => {
                        return (
                            <Flex>
                                {/* {match.matchId} */}
                                <div>{match.player1Name}</div>
                                <div>{match.player1Char}</div>
                                <div>{match.player1Super}</div>
                                vs
                                <div>{match.player2Name || 'Unknown User'}</div>
                                <div>{match.player2Char}</div>
                                <div>{match.player1Super}</div>
                            </Flex>
                        )
                    })}
            </Stack>
            {/* <input placeholder="User name" type="text" />
            <div> Here you can set your favorite character and see stats from matches </div>
            <div> match settings</div>
            <div> recent matches</div>
            <button
                onClick={() => {
                    console.log('save profile')
                }}
            >
                {' '}
                Save{' '}
            </button> */}
        </Stack>
    )
}
