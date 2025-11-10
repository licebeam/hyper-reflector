import { useEffect, useMemo, useState } from 'react'
import {
    AlertDescription,
    AlertRoot,
    Box,
    CardBody,
    CardRoot,
    Heading,
    SimpleGrid,
    Spinner,
    Stack,
    Text,
    useToken,
} from '@chakra-ui/react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import api from '../external-api/requests'
import { auth } from '../utils/firebase'
import { useUserStore } from '../state/store'

type SuperArtStats = { wins?: number; losses?: number }

type CharacterChoice = {
    picks: number
    superChoice?: Array<SuperArtStats> | Record<string, SuperArtStats>
}

type GlobalStats = {
    globalNumberOfMatches?: number
    globalWinCount?: Record<string, number>
    globalCharacterChoice?: Record<string, CharacterChoice>
}

type GlobalStatsResponse = {
    globalStatSet?: GlobalStats
}

const PICK_BAR_COLORS = {
    bar: '#fb923c',
    background: 'rgba(255,255,255,0.08)',
}

const CHARACTER_ROSTER = [
    'Alex',
    'Ryu',
    'Yun',
    'Dudley',
    'Necro',
    'Hugo',
    'Ibuki',
    'Elena',
    'Oro',
    'Yang',
    'Ken',
    'Sean',
    'Urien',
    'Gouki',
    'Chun-Li',
    'Makoto',
    'Q',
    'Twelve',
    'Remy',
]

function normalizeSuperChoices(choice?: CharacterChoice['superChoice']): SuperArtStats[] {
    if (!choice) return []
    if (Array.isArray(choice)) return choice
    return Object.values(choice)
}

function CharacterSuperArtDonut({
    name,
    stats,
    colors,
}: {
    name: string
    stats: CharacterChoice
    colors: readonly string[]
}) {
    const superChoices = normalizeSuperChoices(stats.superChoice)
    const saData = [0, 1, 2].map((index) => {
        const entry = superChoices[index]
        const value = (entry?.wins || 0) + (entry?.losses || 0)
        return {
            name: `SA ${index + 1}`,
            value,
            color: colors[index] || colors[colors.length - 1] || '#fbbf24',
        }
    })

    const hasAnyValue = saData.some((entry) => entry.value > 0)

    return (
        <Stack gap={2} align="center">
            <Text fontWeight="semibold" fontSize="sm">
                {name}
            </Text>
            {hasAnyValue ? (
                <Box w="120px" h="120px">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Tooltip cursor={false} />
                            <Pie
                                innerRadius={40}
                                outerRadius={55}
                                isAnimationActive={false}
                                data={saData}
                                dataKey="value"
                            >
                                {saData.map((item, index) => (
                                    <Cell key={item.name} fill={colors[index] || colors[0]} />
                                ))}
                            </Pie>
                        </PieChart>
                    </ResponsiveContainer>
                </Box>
            ) : (
                <Text fontSize="xs" color="whiteAlpha.600">
                    No data
                </Text>
            )}
        </Stack>
    )
}

function PlayerWinRateDonut({ winCount }: { winCount?: Record<string, number> }) {
    if (!winCount) {
        return <Text color="whiteAlpha.700">Play a few matches to populate this chart.</Text>
    }
    const data = [
        { name: 'Player 1', value: winCount['1'] || 0, color: '#fb923c' },
        { name: 'Player 2', value: winCount['2'] || 0, color: '#38bdf8' },
    ]

    const hasAnyValue = data.some((entry) => entry.value > 0)
    if (!hasAnyValue) {
        return <Text color="whiteAlpha.700">No wins recorded yet.</Text>
    }

    return (
        <Box w="260px" h="280px" mx="auto">
            <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                    <Tooltip cursor={false} />
                    <Pie
                        innerRadius={80}
                        outerRadius={110}
                        isAnimationActive={false}
                        data={data}
                        dataKey="value"
                        labelLine={{ strokeWidth: 1 }}
                        label={({ name: labelName, value }) =>
                            `${labelName}: ${value.toLocaleString()}`
                        }
                    >
                        {data.map((item) => (
                            <Cell key={item.name} fill={item.color} strokeWidth={2} />
                        ))}
                    </Pie>
                </PieChart>
            </ResponsiveContainer>
        </Box>
    )
}

export default function HomePage() {
    const globalUser = useUserStore((s) => s.globalUser)
    const [globalStats, setGlobalStats] = useState<GlobalStats | null>(null)
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const superArtColors = useToken('colors', ['yellow.500', 'orange.500', 'blue.500'])

    useEffect(() => {
        if (!globalUser?.uid) {
            setGlobalStats(null)
            return
        }
        let isMounted = true
        setIsLoading(true)
        setErrorMessage(null)
        ;(async () => {
            try {
                const result = (await api.getGlobalStats(auth, globalUser.uid)) as
                    | GlobalStatsResponse
                    | undefined
                if (!isMounted) return
                if (result?.globalStatSet) {
                    setGlobalStats(result.globalStatSet)
                } else {
                    setGlobalStats(null)
                    setErrorMessage('Global stats are not available yet.')
                }
            } catch (err) {
                console.warn('failed to load global stats', err)
                if (isMounted) {
                    setGlobalStats(null)
                    setErrorMessage('Unable to load stats. Please try again shortly.')
                }
            } finally {
                if (isMounted) setIsLoading(false)
            }
        })()
        return () => {
            isMounted = false
        }
    }, [globalUser?.uid])

    const rosterStats = useMemo(() => {
        const baseline = CHARACTER_ROSTER.reduce<Record<string, CharacterChoice>>((acc, name) => {
            acc[name] = { picks: 0, superChoice: [] }
            return acc
        }, {})
        if (globalStats?.globalCharacterChoice) {
            for (const [name, stats] of Object.entries(globalStats.globalCharacterChoice)) {
                baseline[name] = {
                    picks: stats?.picks || 0,
                    superChoice: stats?.superChoice,
                }
            }
        }
        return baseline
    }, [globalStats?.globalCharacterChoice])

    const characterEntries = useMemo(
        () => Object.entries(rosterStats).sort((a, b) => (b[1]?.picks || 0) - (a[1]?.picks || 0)),
        [rosterStats]
    )

    const barListData = characterEntries.map(([name, stats]) => ({
        name,
        value: stats?.picks || 0,
    }))
    const totalPicks = barListData.reduce((sum, entry) => sum + entry.value, 0) || 1

    const mostPlayedCharacter = characterEntries[0]?.[0]
    const characterDonuts = characterEntries

    if (!globalUser) {
        return (
            <AlertRoot status="warning" borderRadius="lg" bg="yellow.900" mt={8}>
                <AlertDescription>
                    Sign in to view the live global stats dashboard.
                </AlertDescription>
            </AlertRoot>
        )
    }

    return (
        <Stack gap={8} py={4}>
            <Stack gap={2}>
                <Heading size="lg">Global stats</Heading>
                <Text color="whiteAlpha.700">
                    Live match tracking across the Hyper Reflector community.
                </Text>
            </Stack>

            {errorMessage ? (
                <AlertRoot status="error" borderRadius="lg" bg="red.900">
                    <AlertDescription>{errorMessage}</AlertDescription>
                </AlertRoot>
            ) : null}

            {isLoading ? (
                <Stack align="center" py={20}>
                    <Spinner size="xl" color="orange.300" />
                    <Text color="whiteAlpha.700">Crunching the latest match data…</Text>
                </Stack>
            ) : (
                <SimpleGrid columns={{ base: 1, xl: 2 }} gap={8}>
                    <CardRoot bg="gray.900" borderColor="whiteAlpha.200" borderWidth="1px">
                        <CardBody>
                            <Stack gap={6}>
                                <Stack gap={1}>
                                    <Text fontSize="sm" color="whiteAlpha.600">
                                        Total matches recorded
                                    </Text>
                                    <Heading size="lg">
                                        {globalStats?.globalNumberOfMatches?.toLocaleString() || 0}
                                    </Heading>
                                </Stack>
                                <Box h="1px" bg="whiteAlpha.200" />
                                <Stack gap={1}>
                                    <Text fontSize="sm" color="whiteAlpha.600">
                                        Most played character
                                    </Text>
                                    <Text fontSize="lg" fontWeight="semibold">
                                        {mostPlayedCharacter || 'TBD'}
                                    </Text>
                                </Stack>
                                <Box h="1px" bg="whiteAlpha.200" />
                                <Stack gap={4}>
                                    <Text fontWeight="semibold">Player win spread</Text>
                                    <PlayerWinRateDonut winCount={globalStats?.globalWinCount} />
                                </Stack>
                            </Stack>
                        </CardBody>
                    </CardRoot>

                    <CardRoot bg="gray.900" borderColor="whiteAlpha.200" borderWidth="1px">
                        <CardBody>
                            <Stack gap={6}>
                                <Stack gap={1}>
                                    <Heading size="md">Character pick rates</Heading>
                                    <Text color="whiteAlpha.700" fontSize="sm">
                                        Ranking of every character since the last reset.
                                    </Text>
                                </Stack>
                                {barListData.length ? (
                                    <Stack gap={3}>
                                        <Stack direction="row" fontSize="xs" color="whiteAlpha.600">
                                            <Box flex="1">Character</Box>
                                            <Box w="70px" textAlign="right">
                                                Matches
                                            </Box>
                                            <Box w="60px" textAlign="right">
                                                Pick %
                                            </Box>
                                        </Stack>
                                        {barListData.map((entry) => {
                                            const percent = (entry.value / totalPicks) * 100
                                            return (
                                                <Stack key={entry.name} gap={1}>
                                                    <Stack direction="row" align="center" gap={3}>
                                                        <Stack flex="1">
                                                            <Text fontWeight="semibold">
                                                                {entry.name}
                                                            </Text>
                                                            <Box
                                                                position="relative"
                                                                bg={PICK_BAR_COLORS.background}
                                                                borderRadius="full"
                                                                h="6px"
                                                            >
                                                                <Box
                                                                    position="absolute"
                                                                    left="0"
                                                                    top="0"
                                                                    bottom="0"
                                                                    borderRadius="full"
                                                                    width={`${percent}%`}
                                                                    bg={PICK_BAR_COLORS.bar}
                                                                />
                                                            </Box>
                                                        </Stack>
                                                        <Text w="70px" textAlign="right">
                                                            {entry.value.toLocaleString()}
                                                        </Text>
                                                        <Text w="60px" textAlign="right">
                                                            {percent.toFixed(1)}%
                                                        </Text>
                                                    </Stack>
                                                </Stack>
                                            )
                                        })}
                                    </Stack>
                                ) : (
                                    <Text color="whiteAlpha.600">
                                        We do not have enough data to show pick rates yet.
                                    </Text>
                                )}

                                {characterDonuts.length ? (
                                    <SimpleGrid columns={{ base: 2, md: 3, lg: 4 }} gap={6}>
                                        {characterDonuts.map(([name, stats]) => (
                                            <CharacterSuperArtDonut
                                                key={name}
                                                name={name}
                                                stats={stats}
                                                colors={superArtColors}
                                            />
                                        ))}
                                    </SimpleGrid>
                                ) : null}
                            </Stack>
                        </CardBody>
                    </CardRoot>
                </SimpleGrid>
            )}
        </Stack>
    )
}
