import { useEffect, memo, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import { BarList, Chart, type BarListData, useChart } from '@chakra-ui/charts'
import { Cell, Pie, PieChart, Tooltip } from 'recharts'
import {
    IconButton,
    ButtonGroup,
    Stack,
    Text,
    Heading,
    Box,
    Center,
    Spinner,
    Pagination,
    Skeleton,
    Editable,
    Button,
    createListCollection,
    Flex,
    Avatar,
    Float,
    Circle,
} from '@chakra-ui/react'
import {
    SelectContent,
    SelectItem,
    SelectRoot,
    SelectTrigger,
    SelectValueText,
} from '../../chakra/ui/select'
import {
    ChartBar,
    Check,
    ChevronLeft,
    ChevronRight,
    Construction,
    Joystick,
    Pencil,
    RefreshCcw,
    UserRound,
    Wrench,
    X,
} from 'lucide-react'
import { Field } from '../../chakra/ui/field'
import { toaster } from '../../chakra/ui/toaster'
import { useLoginStore, useLayoutStore } from '../../../state/deprecated_store'

import {
    RegExpMatcher,
    TextCensor,
    englishDataset,
    englishRecommendedTransformers,
} from 'obscenity'

import SideBar from '../general/SideBar'
import MatchSetCard from '../users/MatchSetCard'
import TitleBadge from '../users/TitleBadge'
import GravatarInput from '../profile/GravatarInput'

const matcher = new RegExpMatcher({
    ...englishDataset.build(),
    ...englishRecommendedTransformers,
})

//TODO: user should have to click a button to save all data
export default function PlayerProfilePage() {
    const theme = useLayoutStore((state) => state.appTheme)
    const { userId } = useParams({ strict: false })
    const userState = useLoginStore((state) => state.userState)
    const updateUserState = useLoginStore((state) => state.updateUserState)
    const [currentTab, setCurrentTab] = useState<number>(0)
    const [editedUserName, setEditedUserName] = useState(undefined)
    const [editedGravEmail, setEditedGravEmail] = useState(undefined)
    const [isEditName, setIsEditName] = useState(false)
    const [nameInvalid, setNameInvalid] = useState(false)
    const [emailInvalid, setEmailInvalid] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [isLoadingUserData, setIsLoadingUserData] = useState(true)
    const [recentMatches, setRecentMatches] = useState([])
    const [userData, setUserData] = useState([])
    const [lastMatch, setLastMatch] = useState(null)
    const [firstMatch, setFirstMatch] = useState(null)
    const [pageNumber, setPageNumber] = useState(1)
    const [pageCount, setPageCount] = useState(null)
    const [isBack, setIsBack] = useState(false)
    const [matchTotal, setMatchTotal] = useState(undefined)
    const [selectedMatchDetails, setSelectedMatchDetails] = useState(undefined)
    const [titleList, setTitleList] = useState(undefined)
    const [selectedTitle, setSelectedTitle] = useState(undefined)

    // used when switching tabs etc
    const resetState = () => {
        setMatchTotal(undefined)
        setIsBack(false)
        setPageCount(null)
        setPageNumber(1)
        setFirstMatch(null)
        setLastMatch(null)
        setRecentMatches([])
        setEditedUserName(undefined)
        setEditedGravEmail(undefined)
        setIsEditName(false)
        setSelectedMatchDetails(undefined)
    }

    const handleSetRecentMatches = (matchData) => {
        const { matches, lastVisible, totalMatches, firstVisible } = matchData
        // only set this once
        if (!matchTotal) {
            setMatchTotal(totalMatches)
            setPageCount(Math.ceil(totalMatches / 10))
        }
        setFirstMatch(firstVisible)
        setLastMatch(lastVisible)
        setRecentMatches(matches)
        setIsLoading(false)
    }

    const handleSetUserData = (data) => {
        setUserData(data)
        setEditedUserName(data.userName)
        setEditedGravEmail(data.gravEmail)
    }

    useEffect(() => {
        // use effects when we switch tabs
        // public profile
        if (currentTab === 0) {
            setIsLoading(false)
            window.api.getAllTitles({ userId })
            if (!userData?.userName) {
                window.api.getUserData(userId)
            }
        }
        // recent matches
        if (currentTab === 1) {
            // setIsLoading(true)
            // window.api.getUserMatches({ userId, lastMatchId: lastMatch })
            if (isBack) {
                window.api.getUserMatches({ userId, firstMatchId: firstMatch })
                setIsBack(false)
            } else {
                setIsBack(false)
                window.api.getUserMatches({ userId, lastMatchId: lastMatch })
            }
        }
        // public profile
        if (currentTab === 2) {
            //setIsLoading(true)
            setIsLoading(false)
        }
    }, [currentTab, pageNumber])

    useEffect(() => {
        if (currentTab === 0 || currentTab === 3) {
            setIsLoadingUserData(false)
        }
    }, [userData])

    useEffect(() => {
        // if we are on the matches tab we want to wait until the full load is completed
        if (currentTab === 1) {
            setIsLoading(false)
        }
    }, [firstMatch])

    const handleSetTitles = (data) => {
        const titles = createListCollection({
            items: [
                ...data?.titleData?.titles.map((title, index) => {
                    return { label: title.title, value: index, data: title }
                }),
            ],
        })
        setTitleList(titles)
    }

    useEffect(() => {
        if (!titleList?.items) return
        const newTitle = titleList.items[selectedTitle]?.data
        if (!newTitle) return
        updateUserState({ ...userState, userTitle: newTitle })
        window.api.changeUserData({ userTitle: newTitle })
    }, [selectedTitle])

    useEffect(() => {
        window.api.removeExtraListeners('getUserData', handleSetUserData)
        window.api.on('getUserData', handleSetUserData)

        window.api.removeExtraListeners('getUserMatches', handleSetRecentMatches)
        window.api.on('getUserMatches', handleSetRecentMatches)

        window.api.removeExtraListeners('fillGlobalSet', globalSetDataFill)
        window.api.on('fillGlobalSet', globalSetDataFill)

        window.api.removeExtraListeners('fillAllTitles', handleSetTitles)
        window.api.on('fillAllTitles', handleSetTitles)

        return () => {
            window.api.removeListener('getUserData', handleSetUserData)
            window.api.removeListener('getUserMatches', handleSetRecentMatches)
            window.api.removeListener('fillGlobalSet', globalSetDataFill)
            window.api.removeListener('fillAllTitles', handleSetTitles)
        }
    }, [])

    const globalSetDataFill = ({ globalSet }) => {
        if (globalSet) {
            setSelectedMatchDetails(globalSet)
        } else {
            // toaster.error({
            //     title: 'Failed to load set!',
            // })
            setSelectedMatchDetails({ matches: [] })
        }
    }

    const getSuperArt = (code) => {
        switch (parseInt(code)) {
            case 0:
                return 'SAI'
                break
            case 1:
                return 'SAII'
                break
            case 2:
                return 'SAIII'
                break
            default:
                return 'SAI'
                break
        }
    }

    const RenderSuperArt = ({ code }) => {
        const currentSuper = getSuperArt(code)
        let superColor
        if (code === 0) {
            superColor = 'yellow.500'
        } else if (code === 1) {
            superColor = 'orange.500'
        } else if (code === 2) {
            superColor = 'blue.500'
        }
        return (
            <Text textStyle="md" padding="8px" color={superColor} width={'60px'}>
                {currentSuper}
            </Text>
        )
    }

    useEffect(() => {
        setNameInvalid(true)
    }, [editedUserName])

    useEffect(() => {
        setEmailInvalid(true)
    }, [editedGravEmail])

    const getCharacterData = () => {
        if (!userData?.playerStatSet?.characters) return
        const charKeys = Object.keys(userData?.playerStatSet?.characters)
        const data = charKeys.map((char) => {
            return {
                name: char,
                value: userData?.playerStatSet?.characters[char].picks,
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

    const getWinRate = (): number => {
        if (userData?.playerStatSet?.totalWins > 0) {
            return (
                (userData?.playerStatSet?.totalWins / userData?.playerStatSet?.totalGames) *
                100
            ).toFixed(2)
        } else return 0
    }

    const GeneratedCharacterDonut = ({ characterName }) => {
        if (!userData?.playerStatSet?.characters) return null
        const character = userData?.playerStatSet?.characters[characterName]
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
            <Chart.Root boxSize="20px" chart={superDonut} mx="-2">
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

    const UserProfileHeader = memo(function UserProfileHeader({ userData }) {
        return (
            <Box display="flex" alignItems="center">
                <Box flex={1} display={'flex'} alignContent={'center'} verticalAlign={'center'}>
                    <Box>
                        <Avatar.Root bg={theme.colors.main.bg} variant="solid" size={'2xl'}>
                            <Avatar.Fallback name={userData.name} />
                            <Avatar.Image src={userData.userProfilePic} />
                        </Avatar.Root>
                    </Box>
                    <Box>
                        <Text textStyle="md" padding="8px" color={theme.colors.main.textMedium}>
                            {userData?.userName || 'Unknown User'}
                        </Text>
                        <TitleBadge title={userData?.userTitle} />
                    </Box>
                </Box>
                <Box flex={1} textAlign={'right'}>
                    <Button
                        justifyContent="flex-start"
                        bg={theme.colors.main.secondary}
                        onClick={() => window.api.getUserData(userData.uid)}
                    >
                        <RefreshCcw />
                    </Button>
                </Box>
            </Box>
        )
    })

    return (
        <Box display="flex" gap="12px">
            <SideBar width="160px">
                <Button
                    disabled={currentTab === 0}
                    justifyContent="flex-start"
                    bg={theme.colors.main.secondary}
                    onClick={() => setCurrentTab(0)}
                >
                    <UserRound />
                    Profile
                </Button>
                <Button
                    disabled={currentTab === 1}
                    justifyContent="flex-start"
                    bg={theme.colors.main.secondary}
                    onClick={() => {
                        resetState()
                        setCurrentTab(1)
                    }}
                >
                    <Joystick />
                    Recent Matches
                </Button>
                <Button
                    disabled={currentTab === 2 || userData?.uid !== userState.uid}
                    justifyContent="flex-start"
                    bg={theme.colors.main.secondary}
                    onClick={() => setCurrentTab(2)}
                >
                    <ChartBar />
                    Statistics
                </Button>
                <Button
                    data-state="open"
                    animationDuration="slow"
                    animationStyle={{ _open: 'slide-fade-in', _closed: 'slide-fade-out' }}
                    disabled={currentTab === 3 || userData?.uid !== userState.uid}
                    justifyContent="flex-start"
                    bg={theme.colors.main.secondary}
                    onClick={() => {
                        resetState()
                        setCurrentTab(3)
                    }}
                >
                    <Wrench />
                    User Setting
                </Button>
            </SideBar>

            <Stack minH="100%" maxWidth={'600px'} flex={1}>
                <UserProfileHeader userData={userData} />
                {currentTab === 0 && (
                    <Box>
                        <Box color={theme.colors.main.actionSecondary} display="flex" gap="12px">
                            <Construction /> Under Construction
                        </Box>
                        <Text textStyle="md" padding="8px" color={theme.colors.main.textMedium}>
                            Current Elo: {userData?.playerStatSet?.accountElo}
                        </Text>
                        <Text textStyle="md" padding="8px" color={theme.colors.main.textMedium}>
                            Overall win rate: {getWinRate()}%
                        </Text>
                        <Text textStyle="md" padding="8px" color={theme.colors.main.textMedium}>
                            Current Win Streak: {userData?.playerStatSet?.winStreak}
                        </Text>
                        <Text textStyle="md" padding="8px" color={theme.colors.main.textMedium}>
                            Total Games: {userData?.playerStatSet?.totalGames}
                        </Text>
                        <Text textStyle="md" padding="8px" color={theme.colors.main.textMedium}>
                            Wins: {userData?.playerStatSet?.totalWins}
                        </Text>
                        <Text textStyle="md" padding="8px" color={theme.colors.main.textMedium}>
                            Losses: {userData?.playerStatSet?.totalLosses}
                        </Text>

                        <Box display="flex" width={'100%'}>
                            {Object.keys(userData?.playerStatSet?.characters || {}).length && (
                                <BarList.Root
                                    chart={chart}
                                    bg="none"
                                    pointerEvents={'none'}
                                    flex="1"
                                >
                                    <BarList.Content>
                                        <Box display="flex" width={'100%'}>
                                            <BarList.Label title="Character Choice" flex="1">
                                                <BarList.Bar
                                                    bg={'none'}
                                                    color={theme.colors.main.text}
                                                />
                                            </BarList.Label>
                                            <BarList.Label
                                                title="Pick Rate"
                                                minW="16"
                                                titleAlignment="end"
                                            >
                                                <BarList.Value color={theme.colors.main.text} />
                                            </BarList.Label>

                                            <BarList.Label
                                                title="Overall %"
                                                minW="16"
                                                titleAlignment="end"
                                            >
                                                <BarList.Value
                                                    color={theme.colors.main.text}
                                                    valueFormatter={(value) =>
                                                        `${getPercent(value)}%`
                                                    }
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
                                {userData?.playerStatSet
                                    ? getSortedObjectData(userData?.playerStatSet?.characters)?.map(
                                          (char, index) => {
                                              return (
                                                  <GeneratedCharacterDonut
                                                      key={`char-${index}`}
                                                      characterName={char[0]}
                                                  />
                                              )
                                          }
                                      )
                                    : null}
                            </Stack>
                        </Box>
                    </Box>
                )}

                {currentTab === 1 && (
                    <Box>
                        <Stack>
                            <Stack>
                                <Heading flex="0" size="md" color={theme.colors.main.textSubdued}>
                                    Recent Matches
                                </Heading>
                                {matchTotal && (
                                    <Box>
                                        <Text
                                            textStyle="md"
                                            padding="8px"
                                            color={theme.colors.main.textMedium}
                                        >
                                            Total Matches Played: {matchTotal}
                                        </Text>
                                        <Pagination.Root
                                            color={theme.colors.main.action}
                                            count={matchTotal}
                                            pageSize={10}
                                            defaultPage={1}
                                            onPageChange={(event) => {
                                                setIsLoading(true)
                                                if (event.page <= 1) {
                                                    setLastMatch(null)
                                                } else if (pageNumber > event.page) {
                                                    setIsBack(true)
                                                }
                                                setPageNumber(event.page)
                                            }}
                                        >
                                            <ButtonGroup gap="4" size="sm" variant="ghost">
                                                <Pagination.PrevTrigger asChild>
                                                    <IconButton color={theme.colors.main.action}>
                                                        <ChevronLeft />
                                                    </IconButton>
                                                </Pagination.PrevTrigger>
                                                <Text textStyle="md" padding="8px">
                                                    {pageNumber} of {pageCount}
                                                </Text>
                                                <Pagination.NextTrigger asChild>
                                                    <IconButton color={theme.colors.main.action}>
                                                        <ChevronRight />
                                                    </IconButton>
                                                </Pagination.NextTrigger>
                                            </ButtonGroup>
                                        </Pagination.Root>
                                    </Box>
                                )}
                                {recentMatches &&
                                    recentMatches.map((match, index) => {
                                        return (
                                            <MatchSetCard
                                                recentMatches={recentMatches}
                                                key={index}
                                                match={match}
                                                index={index}
                                                isLoading={isLoading}
                                                RenderSuperArt={RenderSuperArt}
                                                selectedMatchDetails={selectedMatchDetails}
                                            />
                                        )
                                    })}
                            </Stack>
                        </Stack>
                    </Box>
                )}
                {currentTab === 2 && (
                    <Box>
                        <Box color={theme.colors.main.actionSecondary} display="flex" gap="12px">
                            <Construction />
                            Under Construction
                        </Box>
                    </Box>
                )}

                {currentTab === 3 && (
                    <Stack gap={4}>
                        <Text textStyle="xs" color={theme.colors.main.warning}>
                            Profile changes are not visible to others until the next time you log
                            in.
                        </Text>
                        <Stack>
                            <Text textStyle="xs" color={theme.colors.main.textMedium}>
                                User Name
                            </Text>
                            <Editable.Root
                                defaultValue={userData?.userName}
                                maxLength={16}
                                onEditChange={(e) => setIsEditName(e.edit)}
                                onValueCommit={(e) => {
                                    const censor = new TextCensor()
                                    const nameMatch = e.value
                                    const matches = matcher.getAllMatches(nameMatch)
                                    const censoredMessage = censor.applyTo(nameMatch, matches)
                                    setEditedUserName(censoredMessage)
                                    updateUserState({ ...userState, name: censoredMessage })
                                    window.api.changeUserData({ userName: censoredMessage })
                                }}
                                onValueChange={(e) => setEditedUserName(e.value)}
                                onValueRevert={(e) => {
                                    setEditedUserName(e.value)
                                    updateUserState({ ...userState, name: e.value })
                                }}
                                value={editedUserName}
                                invalid={
                                    editedUserName && editedUserName.length <= 1 && nameInvalid
                                }
                            >
                                {!isEditName && (
                                    <Heading
                                        flex="1"
                                        size="lg"
                                        color={theme.colors.main.actionSecondary}
                                        width="100px"
                                        height="36px"
                                    >
                                        {editedUserName || userData?.userName ? (
                                            editedUserName || userData?.userName
                                        ) : (
                                            <Skeleton height="24px" />
                                        )}
                                    </Heading>
                                )}

                                <Editable.Input
                                    id="test"
                                    bg={theme.colors.main.textSubdued}
                                    height="36px"
                                    value={editedUserName}
                                />
                                {userData?.uid === userState.uid && (
                                    <Editable.Control>
                                        <Editable.EditTrigger asChild>
                                            <IconButton
                                                variant="ghost"
                                                size="xs"
                                                color={theme.colors.main.action}
                                            >
                                                <Pencil />
                                            </IconButton>
                                        </Editable.EditTrigger>
                                        <Editable.CancelTrigger asChild>
                                            <IconButton
                                                variant="outline"
                                                size="xs"
                                                color={theme.colors.main.action}
                                            >
                                                <X />
                                            </IconButton>
                                        </Editable.CancelTrigger>
                                        <Editable.SubmitTrigger asChild>
                                            <IconButton
                                                variant="outline"
                                                size="xs"
                                                color={theme.colors.main.action}
                                            >
                                                <Check />
                                            </IconButton>
                                        </Editable.SubmitTrigger>
                                    </Editable.Control>
                                )}
                            </Editable.Root>
                        </Stack>
                        <GravatarInput
                            userData={userData}
                            userState={userState}
                            editedGravEmail={editedGravEmail}
                            setEditedGravEmail={setEditedGravEmail}
                            updateUserState={updateUserState}
                            emailInvalid={emailInvalid}
                        />
                        <Stack>
                            <Text textStyle="xs" color={theme.colors.main.textMedium}>
                                User Flair
                            </Text>
                            <TitleBadge title={userState?.userTitle || userData?.userTitle} />
                            <Field
                                marginTop={'8px'}
                                label=""
                                helperText="Title flair to display to other users"
                                color={theme.colors.main.textMedium}
                            >
                                <SelectRoot
                                    color={theme.colors.main.actionSecondary}
                                    collection={titleList || []}
                                    value={selectedTitle}
                                    onValueChange={(e) => setSelectedTitle(e.value)}
                                >
                                    <SelectTrigger>
                                        <SelectValueText placeholder="Change Title" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {titleList?.items.map((title) => (
                                            <SelectItem item={title} key={title.value}>
                                                {title?.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </SelectRoot>
                            </Field>
                        </Stack>
                    </Stack>
                )}

                {isLoading && (
                    <Box pos="absolute" inset="0" bg={theme.colors.main.bg} opacity="50%">
                        <Center h="full">
                            <Spinner color={theme.colors.main.action} />
                        </Center>
                    </Box>
                )}
            </Stack>
        </Box>
    )
}
