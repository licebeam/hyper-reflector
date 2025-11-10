import { Avatar, Box, Button, Flex, Stack, Text } from '@chakra-ui/react'
import { useEffect, useMemo, useState } from 'react'
import type { KeyboardEvent, MouseEvent } from 'react'
import { Tooltip } from '../chakra/ui/tooltip'
import '/node_modules/flag-icons/css/flag-icons.min.css'
import { TUser } from '../../types/user'
import TitleBadge from './TitleBadge'
import WinStreakBadge from './WinStreakBadge'
import { useUserStore, useSettingsStore } from '../../state/store'
import { resolvePingBetweenUsers } from '../../utils/ping'

type UserCardSmallProps = {
    user: TUser | undefined
    isSelf?: boolean
    onChallenge?: (user: TUser) => void
    onViewProfile?: (user: TUser) => void
}

export default function UserCardSmall({
    user,
    isSelf,
    onChallenge,
    onViewProfile,
}: UserCardSmallProps) {
    const [menuOpen, setMenuOpen] = useState(false)
    const isInteractive = Boolean(!isSelf && user)
    const viewer = useUserStore((state) => state.globalUser)
    const mutedUsers = useSettingsStore((state) => state.mutedUsers)
    const toggleMutedUser = useSettingsStore((state) => state.toggleMutedUser)
    const isMuted = Boolean(user && mutedUsers.includes(user.uid))

    useEffect(() => {
        setMenuOpen(false)
    }, [user?.uid])

    if (!user) {
        return null
    }

    const toggleMenu = () => {
        if (!isInteractive) return
        setMenuOpen((prev) => !prev)
    }

    const handleKeyToggle = (event: KeyboardEvent<HTMLDivElement>) => {
        if (!isInteractive) return
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            toggleMenu()
        }
    }

    const handleChallenge = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation()
        if (!isInteractive || !onChallenge) return
        onChallenge(user)
        setMenuOpen(false)
    }

    const handleViewProfile = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation()
        if (!onViewProfile) return
        onViewProfile(user)
        setMenuOpen(false)
    }

    const handleToggleMute = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation()
        if (!user) return
        toggleMutedUser(user.uid)
        setMenuOpen(false)
    }

    const pingInfo = useMemo(() => resolvePingBetweenUsers(user, viewer), [user, viewer])
    const pingLabel = useMemo(() => {
        if (pingInfo.ping === null) return undefined
        const value = Math.round(pingInfo.ping)
        return `${value} ms`
    }, [pingInfo.ping])

    return (
        <Stack
            spacing="1"
            borderWidth="1px"
            borderColor="gray.700"
            borderRadius="md"
            bg="bg.canvas"
            _hover={isInteractive ? { borderColor: 'gray.500' } : undefined}
        >
            <Flex
                alignItems="center"
                gap="2"
                padding="2"
                cursor={isInteractive ? 'pointer' : 'default'}
                role={isInteractive ? 'button' : undefined}
                tabIndex={isInteractive ? 0 : -1}
                onClick={toggleMenu}
                onKeyDown={handleKeyToggle}
            >
                <Avatar.Root variant="outline" size="xs">
                    <Avatar.Fallback name={user.userName} />
                    <Avatar.Image src={user.userProfilePic} />
                </Avatar.Root>
                <Stack spacing="0">
                    <Text fontWeight="semibold" fontSize="sm">
                        {user.userName}
                    </Text>
                    <Flex align="center" gap="1">
                        <TitleBadge title={user.userTitle} />
                        <WinStreakBadge value={user.winstreak} compact />
                    </Flex>
                    <Text fontSize="xs" color="gray.500">
                        ELO {user.accountElo ?? '--'}
                    </Text>
                    {pingLabel ? (
                        <Text
                            fontSize="xs"
                            color={pingInfo.isUnstable ? 'orange.300' : 'gray.400'}
                        >
                            Ping {pingLabel}
                        </Text>
                    ) : (
                        <Text fontSize="xs" color="gray.600">
                            Ping unknown
                        </Text>
                    )}
                </Stack>
                <Tooltip content={`${user.countryCode || 'Unknown'}`} openDelay={200} closeDelay={100}>
                    <div>
                        <span
                            //  @ts-ignore // this is needed for the country code css library.
                            class={`fi fi-${user.countryCode?.toLowerCase() || 'xx'}`}
                        />
                    </div>
                </Tooltip>
            </Flex>
            {menuOpen && isInteractive ? (
                <Box paddingX="3" paddingBottom="3">
                    <Stack spacing="2">
                       {user.knownAliases.length ? (
                           <Text fontSize="xs" color="gray.400">
                               Also known as: {user.knownAliases.join(', ')}
                           </Text>
                       ) : null}
                        <Button size="sm" colorPalette="orange" onClick={handleChallenge}>
                            Challenge player
                        </Button>
                        {onViewProfile ? (
                            <Button size="sm" variant="subtle" onClick={handleViewProfile}>
                                View profile
                            </Button>
                        ) : null}
                        <Button
                            size="sm"
                            variant={isMuted ? 'solid' : 'outline'}
                            colorPalette={isMuted ? 'green' : 'neutral'}
                            onClick={handleToggleMute}
                        >
                            {isMuted ? 'Unmute player' : 'Mute player'}
                        </Button>
                    </Stack>
                </Box>
            ) : null}
        </Stack>
    )
}
