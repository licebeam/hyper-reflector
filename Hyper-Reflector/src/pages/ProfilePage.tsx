import { JSX, useCallback, useEffect, useMemo, useState } from 'react'
import {
    Box,
    Button,
    CardBody,
    CardHeader,
    CardRoot,
    Flex,
    Heading,
    Input,
    SimpleGrid,
    Spinner,
    Stack,
    Text,
} from '@chakra-ui/react'
import { useNavigate } from '@tanstack/react-router'
import { Search, ArrowRight, Award, Trophy, RefreshCcw } from 'lucide-react'
import { auth } from '../utils/firebase'
import api from '../external-api/requests'
import { useUserStore } from '../state/store'
import TitleBadge from '../components/UserCard.tsx/TitleBadge'
import WinStreakBadge from '../components/UserCard.tsx/WinStreakBadge'
import type { TUser } from '../types/user'

type LeaderboardEntry = {
    user: Partial<TUser> & { uid?: string }
    stats?: {
        accountElo?: number
        totalWins?: number
        totalGames?: number
    }
}

type LeaderboardState = {
    entries: LeaderboardEntry[]
    cursor: number | null
    loading: boolean
    initialized: boolean
}

type LeaderboardMap = {
    elo: LeaderboardState
    wins: LeaderboardState
}

const INITIAL_LEADERBOARD_STATE: LeaderboardState = {
    entries: [],
    cursor: null,
    loading: false,
    initialized: false,
}

export default function ProfilePage() {
    const globalUser = useUserStore((s) => s.globalUser)
    const navigate = useNavigate()
    const [searchTerm, setSearchTerm] = useState('')
    const [searchResults, setSearchResults] = useState<Partial<TUser>[]>([])
    const [searchCursor, setSearchCursor] = useState<string | null>(null)
    const [searchLoading, setSearchLoading] = useState(false)
    const [searchError, setSearchError] = useState<string | null>(null)
    const [leaderboards, setLeaderboards] = useState<LeaderboardMap>({
        elo: INITIAL_LEADERBOARD_STATE,
        wins: INITIAL_LEADERBOARD_STATE,
    })

    const isAuthenticated = Boolean(globalUser && auth.currentUser)
    const trimmedTerm = useMemo(() => searchTerm.trim(), [searchTerm])

    const performSearch = useCallback(
        async (term: string, options: { reset?: boolean } = {}) => {
            if (!auth.currentUser || !term) return
            const { reset = false } = options
            setSearchLoading(true)
            setSearchError(null)
            try {
                const response = await api.searchUsers(auth, term, reset ? null : searchCursor)
                const users = response?.users ?? []
                setSearchResults((prev) => (reset ? users : [...prev, ...users]))
                setSearchCursor(response?.nextCursor ?? null)
            } catch (error) {
                console.error('searchUsers failed', error)
                setSearchError('Unable to search right now. Please try again soon.')
            } finally {
                setSearchLoading(false)
            }
        },
        [searchCursor]
    )

    useEffect(() => {
        if (!isAuthenticated) {
            setSearchResults([])
            setSearchCursor(null)
            setSearchError(null)
            return
        }
        if (!trimmedTerm) {
            setSearchResults([])
            setSearchCursor(null)
            setSearchError(null)
            return
        }
        const handle = setTimeout(() => {
            void performSearch(trimmedTerm, { reset: true })
        }, 350)
        return () => clearTimeout(handle)
    }, [isAuthenticated, trimmedTerm, performSearch])

    const fetchLeaderboard = useCallback(
        async (kind: 'elo' | 'wins', options: { reset?: boolean; cursor?: number | null } = {}) => {
            if (!auth.currentUser) return
            const { reset = false, cursor = null } = options
            setLeaderboards((prev) => ({
                ...prev,
                [kind]: {
                    ...prev[kind],
                    loading: true,
                    initialized: prev[kind].initialized || reset,
                },
            }))
            try {
                const response = await api.getLeaderboard(auth, {
                    sortBy: kind === 'elo' ? 'elo' : 'wins',
                    cursor: reset ? null : cursor,
                })
                const entries = response?.entries ?? []
                setLeaderboards((prev) => {
                    const previousEntries = reset ? [] : prev[kind].entries
                    return {
                        ...prev,
                        [kind]: {
                            entries: reset ? entries : [...previousEntries, ...entries],
                            cursor: response?.nextCursor ?? null,
                            loading: false,
                            initialized: true,
                        },
                    }
                })
            } catch (error) {
                console.error('getLeaderboard failed', error)
                setLeaderboards((prev) => ({
                    ...prev,
                    [kind]: { ...prev[kind], loading: false, initialized: true },
                }))
            }
        },
        []
    )

    useEffect(() => {
        if (!isAuthenticated) return
        if (!leaderboards.elo.initialized) {
            void fetchLeaderboard('elo', { reset: true })
        }
        if (!leaderboards.wins.initialized) {
            void fetchLeaderboard('wins', { reset: true })
        }
    }, [
        fetchLeaderboard,
        isAuthenticated,
        leaderboards.elo.initialized,
        leaderboards.wins.initialized,
    ])

    const handleViewProfile = (userId?: string) => {
        if (!userId) return
        navigate({ to: '/profile/$userId', params: { userId } })
    }

    if (!isAuthenticated) {
        return (
            <Stack gap={6} padding="8">
                <Heading size="lg">Player profiles</Heading>
                <Text color="gray.400">
                    Sign in to browse player profiles, leaderboards, and personalize your own stats
                    page.
                </Text>
                <Button colorPalette="orange" onClick={() => navigate({ to: '/' })}>
                    Go to sign in
                </Button>
            </Stack>
        )
    }

    const renderUserCard = (user: Partial<TUser>, index?: number) => {
        if (!user) return null
        const subtitle: string[] = []
        if (user.accountElo !== undefined) {
            subtitle.push(`ELO ${user.accountElo}`)
        }
        const winStreakValue =
            typeof user.winstreak === 'number'
                ? user.winstreak
                : typeof (user as any).winStreak === 'number'
                  ? (user as any).winStreak
                  : undefined
        if (typeof winStreakValue === 'number') {
            subtitle.push(`Streak ${winStreakValue}`)
        }
        return (
            <CardRoot
                key={user.uid ?? `${user.userName}-${index}`}
                variant="elevated"
                bg="gray.900"
            >
                {typeof index === 'number' ? (
                    <CardHeader pb="0">
                        <Text fontSize="xs" color="gray.500">
                            #{index + 1}
                        </Text>
                    </CardHeader>
                ) : null}
                <CardBody>
                    <Stack gap={2}>
                        <Flex justify="space-between" align="center">
                            <Box>
                                <Heading size="md">{user.userName || 'Unknown player'}</Heading>
                                <Flex gap="2" align="center" flexWrap="wrap">
                                    <TitleBadge title={user.userTitle} />
                                    <WinStreakBadge value={winStreakValue ?? 0} compact />
                                </Flex>
                                {subtitle.length ? (
                                    <Text fontSize="sm" color="gray.400">
                                        {subtitle.join(' · ')}
                                    </Text>
                                ) : null}
                            </Box>
                            <Button
                                variant="ghost"
                                colorPalette="orange"
                                onClick={() => handleViewProfile(user.uid)}
                            >
                                <Flex align="center" gap="2">
                                    <span>View</span>
                                    <ArrowRight size={16} />
                                </Flex>
                            </Button>
                        </Flex>
                        {user.countryCode ? (
                            <Text fontSize="xs" color="gray.500">
                                Country: {user.countryCode}
                            </Text>
                        ) : null}
                        {Array.isArray(user.knownAliases) && user.knownAliases.length ? (
                            <Text fontSize="xs" color="gray.500">
                                Known as: {user.knownAliases.slice(0, 3).join(', ')}
                            </Text>
                        ) : null}
                    </Stack>
                </CardBody>
            </CardRoot>
        )
    }

    const renderLeaderboard = (
        kind: 'elo' | 'wins',
        icon: JSX.Element,
        title: string,
        description: string
    ) => {
        const board = leaderboards[kind]
        return (
            <CardRoot bg="gray.900" borderWidth="1px" borderColor="gray.700">
                <CardHeader>
                    <Flex justify="space-between" align="center">
                        <Stack gap={1}>
                            <Flex align="center" gap={2}>
                                {icon}
                                <Heading size="md">{title}</Heading>
                            </Flex>
                            <Text fontSize="sm" color="gray.400">
                                {description}
                            </Text>
                        </Stack>
                        <Button
                            size="sm"
                            variant="outline"
                            onClick={() =>
                                fetchLeaderboard(kind, {
                                    reset: true,
                                })
                            }
                            loading={board.loading && board.entries.length === 0}
                        >
                            <Flex align="center" gap="2">
                                <RefreshCcw size={16} />
                                <span>Refresh</span>
                            </Flex>
                        </Button>
                    </Flex>
                </CardHeader>
                <CardBody>
                    <Stack gap={3}>
                        {board.entries.length === 0 && !board.loading ? (
                            <Text fontSize="sm" color="gray.500">
                                No players to show yet.
                            </Text>
                        ) : (
                            board.entries.map((entry, index) => (
                                <Flex
                                    key={`${kind}-${entry.user.uid ?? index}`}
                                    justify="space-between"
                                    align="center"
                                    borderWidth="1px"
                                    borderColor="gray.700"
                                    borderRadius="md"
                                    padding="2"
                                >
                                    <Stack gap={0}>
                                        <Text fontWeight="semibold">
                                            #{index + 1} {entry.user.userName || 'Unknown'}
                                        </Text>
                                        <TitleBadge title={entry.user.userTitle} />
                                    </Stack>
                                    <Stack gap={0} textAlign="right">
                                        {kind === 'elo' ? (
                                            <Text fontSize="sm" color="gray.300">
                                                ELO {entry.stats?.accountElo ?? '—'}
                                            </Text>
                                        ) : (
                                            <>
                                                <Text fontSize="sm" color="gray.300">
                                                    Wins {entry.stats?.totalWins ?? 0}
                                                </Text>
                                                <Text fontSize="xs" color="gray.500">
                                                    Games {entry.stats?.totalGames ?? 0}
                                                </Text>
                                            </>
                                        )}
                                        <Button
                                            size="xs"
                                            variant="ghost"
                                            onClick={() => handleViewProfile(entry.user.uid)}
                                        >
                                            View profile
                                        </Button>
                                    </Stack>
                                </Flex>
                            ))
                        )}
                        {board.entries.length > 0 ? (
                            <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                    fetchLeaderboard(kind, {
                                        cursor: board.cursor,
                                        reset: false,
                                    })
                                }
                                loading={board.loading && board.entries.length > 0}
                                disabled={!board.cursor || board.loading}
                            >
                                {board.cursor ? 'Load more players' : 'End of list'}
                            </Button>
                        ) : null}
                    </Stack>
                </CardBody>
            </CardRoot>
        )
    }

    return (
        <Stack gap={8} padding={{ base: 4, md: 8 }}>
            <Flex
                justify="space-between"
                align={{ base: 'stretch', md: 'center' }}
                direction={{ base: 'column', md: 'row' }}
                gap={4}
            >
                <Stack gap={1}>
                    <Heading size="lg">Player profiles</Heading>
                    <Text color="gray.400" fontSize="sm">
                        Search players, browse leaderboards, and jump directly into any profile.
                    </Text>
                </Stack>
                {globalUser?.uid ? (
                    <Button colorPalette="orange" onClick={() => handleViewProfile(globalUser.uid)}>
                        <Flex align="center" gap="2">
                            <span>View my profile</span>
                            <ArrowRight size={16} />
                        </Flex>
                    </Button>
                ) : null}
            </Flex>

            <CardRoot bg="gray.900" borderWidth="1px" borderColor="gray.700">
                <CardBody>
                    <Stack gap={4}>
                        <Box position="relative">
                            <Box
                                position="absolute"
                                top="50%"
                                left="12px"
                                transform="translateY(-50%)"
                                color="gray.500"
                                pointerEvents="none"
                            >
                                <Search size={16} />
                            </Box>
                            <Input
                                paddingLeft="40px"
                                placeholder="Search by player name"
                                value={searchTerm}
                                onChange={(event) => setSearchTerm(event.target.value)}
                            />
                        </Box>
                        {searchError ? (
                            <Text fontSize="sm" color="red.300">
                                {searchError}
                            </Text>
                        ) : null}
                        {trimmedTerm && (
                            <Flex justify="space-between" align="center">
                                <Text fontSize="sm" color="gray.400">
                                    Showing {searchResults.length} result
                                    {searchResults.length === 1 ? '' : 's'}
                                </Text>
                                <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => setSearchTerm('')}
                                    disabled={searchLoading}
                                >
                                    Clear search
                                </Button>
                            </Flex>
                        )}
                        <Stack gap={3}>
                            {searchLoading && searchResults.length === 0 ? (
                                <Flex justify="center">
                                    <Spinner />
                                </Flex>
                            ) : null}
                            {!searchLoading && trimmedTerm && searchResults.length === 0 ? (
                                <Text fontSize="sm" color="gray.500">
                                    No players found for “{trimmedTerm}”.
                                </Text>
                            ) : null}
                            {searchResults.map((user) => renderUserCard(user))}
                            {searchResults.length > 0 && searchCursor ? (
                                <Button
                                    variant="outline"
                                    onClick={() => performSearch(trimmedTerm, { reset: false })}
                                    loading={searchLoading}
                                    disabled={searchLoading}
                                >
                                    Load more results
                                </Button>
                            ) : null}
                        </Stack>
                    </Stack>
                </CardBody>
            </CardRoot>

            <Stack gap={4}>
                <Heading size="md">Leaderboards</Heading>
                <SimpleGrid columns={{ base: 1, lg: 2 }} gap={4}>
                    {renderLeaderboard(
                        'elo',
                        <Award size={18} />,
                        'Highest ELO',
                        'Top rated competitors across Hyper Reflector.'
                    )}
                    {renderLeaderboard(
                        'wins',
                        <Trophy size={18} />,
                        'Most wins',
                        'Players with the greatest number of recorded wins.'
                    )}
                </SimpleGrid>
            </Stack>
        </Stack>
    )
}
