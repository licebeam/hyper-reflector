import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useLoginStore, useMessageStore } from '../../state/store'
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

export default function UserCard({ user }) {
    const [isInMatch, setIsInMatch] = useState(false)
    const [isUserChallenging, setIsUserChallenging] = useState(false)
    const userState = useLoginStore((state) => state.userState)
    const callData = useMessageStore((state) => state.callData)
    const clearCallData = useMessageStore((state) => state.clearCallData)

    const navigate = useNavigate()

    useEffect(() => {
        console.log('call', callData)
        setIsUserChallenging((prevState) => {
            const found = callData.some((call) => call.callerId === user.uid)
            console.log(found ? 'Found USER in call' : 'Did not find user in call')
            return found // This ensures the state is always updated properly
        })
    }, [callData, user.uid])

    const handleEndMatch = () => {
        setTimeout(() => {
            setIsInMatch(false)
            clearCallData()
            console.log('match ended----------------------------')
        }, 2000)
    }

    useEffect(() => {
        window.api.removeAllListeners('endMatchUI', handleEndMatch)
        window.api.on('endMatchUI', handleEndMatch)
        return () => {
            window.api.removeListener('endMatchUI', handleEndMatch)
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
                    <Text textStyle="xs" fontWeight="bold" color="gray.100">
                        {elo}
                    </Text>
                </Box>
            )
        }
    }

    return (
        <Popover.Root positioning={{ sameWidth: true }}>
            <Popover.Trigger asChild>
                <Box
                    minH="60px"
                    maxH="60px"
                    background={'cyan.800'}
                    borderRadius="8px"
                    padding="8px"
                    height="100%"
                    borderWidth="2px"
                    borderColor={'cyan.900'}
                    _hover={{ bg: 'cyan.700', cursor: 'pointer' }}
                >
                    <Flex gap="12px">
                        <Box>
                            <Avatar.Root colorPalette="cyan" variant="solid">
                                <Avatar.Fallback name={user.name} />
                                <Float placement="bottom-end" offsetX="1" offsetY="1">
                                    <Circle
                                        bg="green.500"
                                        size="8px"
                                        outline="0.2em solid"
                                        outlineColor="cyan.900"
                                    />
                                </Float>
                            </Avatar.Root>
                        </Box>
                        <Stack gap="0px">
                            <Flex>
                                <Text textStyle="sm" fontWeight="bold" color="gray.100">
                                    {user.name}
                                </Text>
                            </Flex>
                            <Box minH="16px">
                                {user.userTitle && (
                                    <Badge size="xs" variant="subtle" colorPalette="red">
                                        {user.userTitle}
                                    </Badge>
                                )}
                            </Box>
                        </Stack>
                        {/* eventually we'll display user account ranks here. */}
                        <RankDisplay elo={user.elo} />
                        <Box>{/* eventually we will display ping here */}</Box>
                    </Flex>
                </Box>
            </Popover.Trigger>
            <Portal>
                <Popover.Positioner>
                    <Popover.Content width="auto" backgroundColor="gray.900">
                        <Popover.Arrow />
                        <Popover.Body>
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
                                        window.api.callUser({
                                            callerId: userState.uid,
                                            calleeId: user.uid,
                                        })
                                    }}
                                >
                                    Challenge
                                </Button>
                            )}
                            {/* link to user profile */}
                            <Button
                                onClick={() => {
                                    navigate({ to: `/profile/${user.uid || ''}` })
                                }}
                            >
                                Profile
                            </Button>
                        </Popover.Body>
                    </Popover.Content>
                </Popover.Positioner>
            </Portal>
        </Popover.Root>
    )
}
