import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useLoginStore, useMessageStore, useLayoutStore, useConfigStore } from '../../state/store'
import {
    Button,
    Stack,
    Flex,
    Box,
    Avatar,
    Text,
    Icon,
    Float,
    Circle,
    Portal,
    Popover,
} from '@chakra-ui/react'
import { Tooltip } from '../chakra/ui/tooltip'
import { Crown, Sword, Wifi, WifiHigh, WifiLow, WifiOff } from 'lucide-react'
import TitleBadge from './TitleBadge'
import '/node_modules/flag-icons/css/flag-icons.min.css'

export default function UserCard({ user }) {
    const configState = useConfigStore((state) => state.configState)
    const theme = useLayoutStore((state) => state.appTheme)
    const pushMessage = useMessageStore((state) => state.pushMessage)
    const userState = useLoginStore((state) => state.userState)
    const updateUserState = useLoginStore((state) => state.updateUserState)
    const setLayoutTab = useLayoutStore((state) => state.setSelectedTab)
    const [userPopOpen, setUserPopOpen] = useState(false)
    const [cannotChallenge, setCannotChallenge] = useState(false)

    const navigate = useNavigate()

    //TODO: modify this to not use a time out maybe?
    const handleEndMatch = () => {
        setCannotChallenge(false)
        // updateUserState({ ...userState, isFighting: false })
        // setTimeout(() => {
        //     setIsInMatch(false)
        //     clearCallData()
        // }, 2000)
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
        // this is just for demonstration purposes
        if (elo < 1100) {
            return (
                <Box alignContent="center" width="40px" textAlign="center">
                    <Icon size="md" color="yellow.800">
                        <Crown />
                    </Icon>
                    <Text textStyle="xs" fontWeight="bold" color={theme.colors.main.text}>
                        {elo}
                    </Text>
                </Box>
            )
        }
        if (elo <= 1400) {
            return (
                <Box alignContent="center" width="40px" textAlign="center">
                    <Icon size="md" color="green.600">
                        <Crown />
                    </Icon>
                    <Text textStyle="xs" fontWeight="bold" color={theme.colors.main.text}>
                        {elo}
                    </Text>
                </Box>
            )
        }
        if (elo > 1400) {
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

    function PingDisplay({
        peer,
    }: {
        peer: { uid: string; countryCode: string; ping: number } | undefined
    }) {
        const isMe = peer.uid === userState?.uid || false
        const getWifiIcon = () => {
            if (peer?.ping < 100) {
                return <Wifi />
            }
            if (peer?.ping > 100 && peer?.ping > 200) {
                return <WifiHigh />
            }
            if (peer?.ping > 200) {
                return <WifiLow />
            }
            return <WifiOff />
        }
        return (
            <Box display={'flex'} gap="8px">
                <Tooltip
                    content={`${peer?.countryCode || 'Unknown'}`}
                    openDelay={200}
                    closeDelay={100}
                >
                    <div>
                        <span class={`fi fi-${peer?.countryCode?.toLowerCase() || 'xx'}`} />
                    </div>
                </Tooltip>
                {!isMe && (
                    <Tooltip
                        content={`Estimated Ping: ${peer?.ping || 'Unknown'} ms`}
                        openDelay={200}
                        closeDelay={100}
                    >
                        <Icon size="md" color="gray.100">
                            {getWifiIcon()}
                        </Icon>
                    </Tooltip>
                )}
            </Box>
        )
    }

    const getIsOnline = () => {
        if (user.uid !== userState.uid) {
            return user?.isAway !== 'true'
        }
        if (configState?.isAway === 'true') {
            return false
        }
        return true
    }

    return (
        <Popover.Root
            open={userPopOpen}
            onOpenChange={(e) => setUserPopOpen(e.open)}
            positioning={{ sameWidth: true, offset: { crossAxis: 0, mainAxis: -4 } }}
        >
            <Popover.Trigger asChild>
                <Box
                    minW="280px"
                    maxW="280px"
                    minH="60px"
                    maxH="60px"
                    background={theme.colors.main.card}
                    borderRadius="4px"
                    padding="8px"
                    height="100%"
                    borderWidth="2px"
                    borderColor={theme.colors.main.cardDark}
                    _hover={{ bg: theme.colors.main.cardLight, cursor: 'pointer' }}
                    position={'relative'}
                >
                    <Float placement="middle-start" offsetX="-2.5" offsetY="0">
                        <Tooltip content={`Win Streak`} openDelay={200} closeDelay={100}>
                            <Box
                                textAlign={'center'}
                                alignItems={'center'}
                                className={user.winStreak >= 5 && 'glow'}
                                background={theme.colors.main.bg}
                                width={'32px'}
                                borderRadius={'8px'}
                            >
                                <Text
                                    textStyle="sm"
                                    fontWeight="bold"
                                    color={theme.colors.main.text}
                                    animation={'pulse'}
                                >
                                    {user.winStreak || null}
                                </Text>
                            </Box>
                        </Tooltip>
                    </Float>
                    <Flex gap="12px">
                        <Box maxW="120px">
                            <Avatar.Root bg={theme.colors.main.bg} variant="solid">
                                <Avatar.Fallback name={user.name} />
                                <Avatar.Image src={user.userProfilePic} />
                                <Float placement="bottom-end" offsetX="1" offsetY="1">
                                    <Circle
                                        bg={
                                            getIsOnline()
                                                ? theme.colors.main.active
                                                : theme.colors.main.away
                                        }
                                        size="8px"
                                        outline="0.2em solid"
                                        outlineColor={theme.colors.main.cardDark}
                                    />
                                </Float>
                            </Avatar.Root>
                        </Box>
                        <Stack gap="0px">
                            {/* position absolute isn't a great idea here but it is a quick fix */}
                            <Flex position={'absolute'} marginBottom={'20px'}>
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
                        <Box marginLeft={'18px'} minWidth={'40px'}>
                            <RankDisplay elo={user.elo} />
                        </Box>
                        <Box display="flex" alignItems={'center'} gap="4px" minW={'60px'}>
                            <PingDisplay
                                peer={
                                    (userState?.lastKnownPings &&
                                        userState?.lastKnownPings?.find(
                                            (u: string) => u.id === user.uid
                                        )) ||
                                    user ||
                                    undefined
                                }
                            />
                        </Box>
                    </Flex>
                </Box>
            </Popover.Trigger>
            <Portal>
                <Popover.Positioner>
                    <Popover.Content width="auto" backgroundColor={theme.colors.main.tertiary}>
                        <Popover.Arrow />
                        <Popover.Body>
                            <Flex gap="8px">
                                {user.uid !== userState.uid && (
                                    <Button
                                        borderColor={theme.colors.main.text}
                                        borderWidth={'1px'}
                                        bg={theme.colors.main.action}
                                        disabled={cannotChallenge || !getIsOnline()}
                                        onClick={() => {
                                            setUserPopOpen(false)
                                            setCannotChallenge(true)
                                            window.api.callUser({
                                                callerId: userState.uid,
                                                calleeId: user.uid,
                                            })
                                            pushMessage({
                                                sender: userState.uid,
                                                fromMe: true,
                                                challengedUID: user.uid,
                                                opp: user.name,
                                                message: `You Challenged: ${user.name}`,
                                                type: 'request',
                                                declined: false,
                                                accepted: false,
                                                id: Date.now(), // TODO this is not a long lasting solution
                                            })
                                        }}
                                    >
                                        <Sword />
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
