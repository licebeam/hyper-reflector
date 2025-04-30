import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useLoginStore, useMessageStore, useLayoutStore } from '../../state/store'
import {
    Button,
    Stack,
    Input,
    Flex,
    Box,
    Avatar,
    AvatarGroup,
    Card,
    Badge,
    Text,
    Icon,
    Float,
    Circle,
    Portal,
    Popover,
} from '@chakra-ui/react'
import { Crown } from 'lucide-react'
import TitleBadge from './TitleBadge'

export default function UserCard({ user }) {
    const theme = useLayoutStore((state) => state.appTheme)
    const [userPopOpen, setUserPopOpen] = useState(false)
    const [isInMatch, setIsInMatch] = useState(false)
    const [isUserChallenging, setIsUserChallenging] = useState(false)
    const userState = useLoginStore((state) => state.userState)
    const updateUserState = useLoginStore((state) => state.updateUserState)
    const callData = useMessageStore((state) => state.callData)
    const removeCallData = useMessageStore((state) => state.removeCallData)
    const clearCallData = useMessageStore((state) => state.clearCallData)
    const setLayoutTab = useLayoutStore((state) => state.setSelectedTab)

    const navigate = useNavigate()

    useEffect(() => {
        setIsUserChallenging((prevState) => {
            const found = callData.some((call) => call.callerId === user.uid)
            return found // This ensures the state is always updated properly
        })
    }, [callData, user.uid])

    //TODO: modify this to not use a time out maybe?
    const handleEndMatch = () => {
        updateUserState({ ...userState, isFighting: false })
        setTimeout(() => {
            setIsInMatch(false)
            clearCallData()
        }, 2000)
    }

    const handleCallDeclined = (declinedCall) => {
        const { answererId } = declinedCall
        setIsUserChallenging(false)
        setIsInMatch(false)
        const callToRemove = callData.find((call) => call.callerId === answererId)
        removeCallData(callToRemove)
    }

    useEffect(() => {
        window.api.removeAllListeners('endMatchUI', handleEndMatch)
        window.api.on('endMatchUI', handleEndMatch)

        window.api.removeAllListeners('callDeclined', handleCallDeclined)
        window.api.on('callDeclined', handleCallDeclined)
        return () => {
            window.api.removeListener('endMatchUI', handleEndMatch)
            window.api.removeListener('callDeclined', handleCallDeclined)
        }
    }, [])

    function RankDisplay({ elo }) {
        if (!elo) return
        if (elo <= 1200) {
            return (
                <Box alignContent="center" width="40px" textAlign="center">
                    <Icon size="md" color="yellow.400">
                        <Crown />
                    </Icon>
                    <Text textStyle="xs" fontWeight="bold" color={theme.colors.main.text}>
                        {elo}
                    </Text>
                </Box>
            )
        }
    }

    return (
        <Popover.Root
            open={userPopOpen}
            onOpenChange={(e) => setUserPopOpen(e.open)}
            positioning={{ sameWidth: true, offset: { crossAxis: 0, mainAxis: -4 } }}
        >
            <Popover.Trigger asChild>
                <Box
                    minW="260px"
                    minH="60px"
                    maxH="60px"
                    background={theme.colors.main.card}
                    borderRadius="4px"
                    padding="8px"
                    height="100%"
                    borderWidth="2px"
                    borderColor={theme.colors.main.cardDark}
                    _hover={{ bg: theme.colors.main.cardLight, cursor: 'pointer' }}
                >
                    <Flex gap="12px">
                        <Box>
                            <Avatar.Root colorPalette="cyan" variant="solid">
                                <Avatar.Fallback name={user.name} />
                                <Float placement="bottom-end" offsetX="1" offsetY="1">
                                    <Circle
                                        bg="green.500" // offline online stuff
                                        size="8px"
                                        outline="0.2em solid"
                                        outlineColor={theme.colors.main.cardDark}
                                    />
                                </Float>
                            </Avatar.Root>
                        </Box>
                        <Stack gap="0px">
                            <Flex>
                                <Text
                                    textStyle="sm"
                                    fontWeight="bold"
                                    color={theme.colors.main.text}
                                >
                                    {user.name}
                                </Text>
                            </Flex>
                            <TitleBadge title={user.userTitle || null} />
                        </Stack>
                        {/* eventually we'll display user account ranks here. */}
                        <Box marginLeft={'12px'}>
                            <RankDisplay elo={user.elo} />
                        </Box>
                        <Box>{/* eventually we will display ping here */}</Box>
                    </Flex>
                </Box>
            </Popover.Trigger>
            <Portal>
                <Popover.Positioner>
                    <Popover.Content width="auto" backgroundColor={theme.colors.main.tertiary}>
                        <Popover.Arrow />
                        <Popover.Body>
                            <Flex gap="8px">
                                {!isUserChallenging && user.uid !== userState.uid && (
                                    <Button
                                        bg={theme.colors.main.action}
                                        disabled={isInMatch}
                                        onClick={() => {
                                            setUserPopOpen(false)
                                            setIsInMatch(true)
                                            window.api.callUser({
                                                callerId: userState.uid,
                                                calleeId: user.uid,
                                            })
                                        }}
                                    >
                                        Challenge
                                    </Button>
                                )}
                                <Button
                                    bg={theme.colors.main.actionSecondary}
                                    onClick={async () => {
                                        setUserPopOpen(false)
                                        await setLayoutTab('profile')
                                        navigate({ to: `/profile/${user.uid || ''}` })
                                    }}
                                >
                                    Profile
                                </Button>
                            </Flex>
                        </Popover.Body>
                    </Popover.Content>
                </Popover.Positioner>
            </Portal>
        </Popover.Root>
    )
}
