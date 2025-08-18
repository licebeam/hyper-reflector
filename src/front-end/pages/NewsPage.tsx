import { useEffect, useState } from 'react'
import { Box, Heading, Stack, Text } from '@chakra-ui/react'
import { BarList, Chart, type BarListData, useChart } from '@chakra-ui/charts'
import { Cell, Pie, PieChart, Tooltip } from 'recharts'
import BlogPost from '../components/BlogPost'
import { useLayoutStore, useLoginStore } from '../state/store'

const blogsArray = [
    {
        title: 'Update Version 0.4.1a',
        date: '8/17/2025',
        content: `
         Small amount of bug fixes, check the discord for the full notes, thanks!
        `,
    },
    {
        title: 'Update Version 0.4.0a',
        date: '8/3/2025',
        content: `
         News updates will be going away from this page, so check the discord for full notes!
        `,
    },
    {
        title: 'Update Version 0.3.1a',
        date: '6/10/2025',
        content: `
         Hey this isn't perfect but I want to get it out as soon as possible so that people can use the platform again. I've added a few things, but the notes will have more info
        `,
    },
    {
        title: 'Update Version 0.3.0a',
        date: '4/30/2025',
        content: `
         This is the first major update for hyper reflector!
         In addition to bug fixes, performance improvements: This update adds player flair, app themes, private and public lobby creation, matches are now saved as sets which can be browsed for statistics (coming soon).
         Additionally, global and personal stat tracking is here!, characters played, matches, win rates, check your profile after a few matches! - Full notes on github and discord.
        `,
    },
    {
        title: 'Update Version 0.2.2a',
        date: '3/25/2025',
        content: 'hot fixes lua sorry + Small bug fixes from 0.2.0 -- edit: more hotfixes...',
    },
    {
        title: 'Update Version 0.1.9a',
        date: '3/23/2025',
        content:
            'Thanks again for another successful week testing, in this update I add some quality of life improvements for the chat and player profiles, as well as some match bug fixes, please check the release notes on discord. =)',
    },
    {
        title: 'Update Version 0.1.8a',
        date: '3/18/2025',
        content:
            'Took me a minute but, here we are with update 0.1.8 alpha! This adds the precurser to match stat tracking and many features, some updated ui, like profile an chat. As well as changes to our stat tracking lua, enjoy. Full release notes on discord.',
    },
    {
        title: 'Update Version 0.1.7a',
        date: '3/10/2025',
        content:
            'Update v0.1.7a is here, no longer are we reliant on UPNP to manage connections you can see the full changelog on discord, sorry I will eventually fix up the news page!!',
    },
    {
        title: 'Hyper Reflector Alpha!',
        date: '3/4/2025',
        content: 'Welcome to the alpha, hop in the discord',
    },
]

export default function NewsPage() {
    const theme = useLayoutStore((state) => state.appTheme)
    const userState = useLoginStore((state) => state.userState)
    const [globalStats, setGlobalStats] = useState(undefined)

    const handleFillGlobalStats = (stats) => {
        setGlobalStats(stats.globalStatSet)
    }

    useEffect(() => {
        window.api.getGlobalStats({ userId: userState })
        window.api.removeExtraListeners('fillGlobalStats', handleFillGlobalStats)
        window.api.on('fillGlobalStats', handleFillGlobalStats)

        return () => {
            window.api.removeListener('fillGlobalStats', handleFillGlobalStats)
        }
    }, [])

    const getCharacterData = () => {
        if (!globalStats?.globalCharacterChoice) return
        const charKeys = Object.keys(globalStats?.globalCharacterChoice)
        const data = charKeys.map((char) => {
            return {
                name: char,
                value: globalStats?.globalCharacterChoice[char].picks,
                test: 'poo',
            }
        })
        return data
    }

    const chart = useChart<BarListData>({
        sort: { by: 'value', direction: 'desc' },
        data: getCharacterData() || [{ name: 'unknown', value: 0, test: 'cool' }],
        series: [{ name: 'name', color: theme.colors.main.actionSecondary }],
    })

    const getPercent = (value: number) => chart.getValuePercent('value', value).toFixed(2)

    const GeneratedCharacterDonut = ({ characterName }) => {
        if (!globalStats.globalCharacterChoice) return null
        const character = globalStats.globalCharacterChoice[characterName]
        if (!character) return null
        const sa1Picks = character?.superChoice[0]?.wins + character?.superChoice[0]?.losses || 0
        const sa2Picks = character?.superChoice[1]?.wins + character?.superChoice[1]?.losses || 0
        const sa3Picks = character?.superChoice[2]?.wins + character?.superChoice[2]?.losses || 0
        const superDonut = useChart({
            data: [
                { name: 'SA I', value: sa1Picks, color: theme.colors.main.sa1 },
                { name: 'SA II', value: sa2Picks, color: theme.colors.main.sa2 },
                { name: 'SA III', value: sa3Picks, color: theme.colors.main.sa3 },
            ],
        })

        return (
            <Chart.Root boxSize="20px" chart={superDonut} mx="-160px">
                <PieChart>
                    <Tooltip
                        cursor={false}
                        animationDuration={100}
                        content={<Chart.Tooltip hideLabel />}
                    />
                    <Pie
                        innerRadius={10}
                        outerRadius={22}
                        isAnimationActive={false}
                        data={superDonut.data}
                        dataKey={superDonut.key('value')}
                    >
                        {superDonut.data.map((item) => (
                            <Cell key={item.name} fill={superDonut.color(item.color)} />
                        ))}
                    </Pie>
                </PieChart>
            </Chart.Root>
        )
    }

    const getSortedObjectData = (data) => {
        const sorted = Object.entries(data).sort(([, a], [, b]) => b.picks - a.picks)
        return sorted
    }

    const PlayerWinRateDonut = (data) => {
        if (!globalStats?.globalWinCount) return null
        const p1Wins = globalStats?.globalWinCount['1'] || 0
        const p2Wins = globalStats?.globalWinCount['2'] || 0
        const playerWinDonut = useChart({
            data: [
                { name: 'Player 1 Wins', value: p1Wins, color: theme.colors.main.action },
                { name: 'Player 2 Wins', value: p2Wins, color: theme.colors.main.secondary },
            ],
        })
        return (
            <Chart.Root boxSize="200px" chart={playerWinDonut} mx="auto">
                <PieChart>
                    <Tooltip
                        cursor={false}
                        animationDuration={100}
                        content={<Chart.Tooltip hideLabel />}
                    />
                    <Pie
                        innerRadius={80}
                        outerRadius={100}
                        isAnimationActive={false}
                        data={playerWinDonut.data}
                        dataKey={playerWinDonut.key('value')}
                        nameKey="value"
                        labelLine={{ strokeWidth: 1 }}
                        label={{
                            fill: playerWinDonut.color(theme.colors.main.action),
                        }}
                    >
                        {playerWinDonut.data.map((item) => (
                            <Cell
                                strokeWidth={2}
                                key={item.name}
                                fill={playerWinDonut.color(item.color)}
                            />
                        ))}
                    </Pie>
                </PieChart>
            </Chart.Root>
        )
    }

    return (
        <Box display="flex" gap="32px">
            <Stack gap="12px" flex="2">
                <Heading size="md" color={theme.colors.main.textSubdued}>
                    News
                </Heading>
                <Stack>
                    {blogsArray.map((blog, index) => (
                        <BlogPost blog={blog} key={`blog-post-${index}`} />
                    ))}
                </Stack>
            </Stack>
            <Stack flex="4" gap="12px">
                <Heading size="md" color={theme.colors.main.textSubdued}>
                    Hyper Reflector
                </Heading>
                <Text textStyle="md" padding="8px" color={theme.colors.main.textMedium}>
                    Total Matches: {globalStats?.globalNumberOfMatches || 0}
                </Text>
                <Text textStyle="md" padding="8px" color={theme.colors.main.textMedium}>
                    Win Rates:
                </Text>
                <Box>
                    <PlayerWinRateDonut />
                </Box>
                <Box display="flex">
                    {Object.keys(globalStats?.globalCharacterChoice || {}).length && (
                        <BarList.Root chart={chart} bg="none" pointerEvents={'none'} flex="1">
                            <BarList.Content>
                                <Box display="flex" width={'80%'}>
                                    <BarList.Label title="Character Choice" flex="1">
                                        <BarList.Bar bg={'none'} color={theme.colors.main.text} />
                                    </BarList.Label>
                                    <BarList.Label title="Pick Rate" minW="16" titleAlignment="end">
                                        <BarList.Value color={theme.colors.main.text} />
                                    </BarList.Label>

                                    <BarList.Label title="Overall %" minW="16" titleAlignment="end">
                                        <BarList.Value
                                            color={theme.colors.main.text}
                                            valueFormatter={(value) => `${getPercent(value)}%`}
                                        />
                                    </BarList.Label>
                                    <BarList.Label
                                        title=""
                                        minW="16"
                                        titleAlignment="end"
                                    ></BarList.Label>
                                </Box>
                            </BarList.Content>
                        </BarList.Root>
                    )}
                    <Stack gap="28px" marginTop={'34px'}>
                        {globalStats?.globalCharacterChoice
                            ? getSortedObjectData(globalStats?.globalCharacterChoice)?.map(
                                  (char) => {
                                      return <GeneratedCharacterDonut characterName={char[0]} />
                                  }
                              )
                            : null}
                    </Stack>
                </Box>
            </Stack>
        </Box>
    )
}
