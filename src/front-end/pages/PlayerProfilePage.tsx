import { useEffect, useState } from 'react'
import { useParams } from '@tanstack/react-router'
import {
    Button,
    IconButton,
    ButtonGroup,
    Stack,
    Input,
    Text,
    Heading,
    createListCollection,
    Box,
    Flex,
    Center,
    Spinner,
    Card,
    Pagination,
    Skeleton,
} from '@chakra-ui/react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import {
    SelectContent,
    SelectItem,
    SelectRoot,
    SelectTrigger,
    SelectValueText,
} from '../components/chakra/ui/select'
import { Field } from '../components/chakra/ui/field'
import { useLoginStore } from '../state/store'

export default function PlayerProfilePage() {
    const { userId } = useParams({ strict: false })
    console.log('got user id, ', userId)
    const userState = useLoginStore((state) => state.userState)
    const [isLoading, setIsLoading] = useState(true)
    const [recentMatches, setRecentMatches] = useState([])
    const [userData, setUserData] = useState([])
    const [lastMatch, setLastMatch] = useState(null)
    const [pageNumber, setPageNumber] = useState(1)
    const [pageCount, setPageCount] = useState(null)
    const [matchTotal, setMatchTotal] = useState(undefined)

    const handleSetRecentMatches = (matchData) => {
        const { matches, lastVisible, totalMatches } = matchData
        // only set this once
        if (!matchTotal) {
            setMatchTotal(totalMatches)
            setPageCount(Math.ceil(totalMatches / 10))
        }

        setLastMatch(lastVisible)
        setRecentMatches(matches)
        setIsLoading(false)
    }

    const handleSetUserData = (data) => {
        console.log('USER DATA-------------', data)
        setUserData(data)
    }

    useEffect(() => {
        //TODO sometimes this fails to get match data
        window.api.getUserData(userId)
        window.api.getUserMatches({ userId, lastMatchId: lastMatch })
        // temp
        setTimeout(() => {
            setIsLoading(false)
        }, 1000)
    }, [])

    useEffect(() => {
        window.api.getUserMatches({ userId, lastMatchId: lastMatch })
    }, [pageNumber])

    useEffect(() => {
        window.api.removeExtraListeners('getUserData', handleSetUserData)
        window.api.on('getUserData', handleSetUserData)

        window.api.removeExtraListeners('getUserMatches', handleSetRecentMatches)
        window.api.on('getUserMatches', handleSetRecentMatches)

        return () => {
            window.api.removeListener('getUserData', handleSetUserData)
            window.api.removeListener('getUserMatches', handleSetRecentMatches)
        }
    }, [])

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
        } else {
            superColor = 'blue.500'
        }
        return (
            <Text textStyle="md" padding="8px" color={superColor}>
                {currentSuper}
            </Text>
        )
    }

    return (
        <Stack minH="100%">
            <Heading flex="0" size="lg">
                {userState.name}
            </Heading>
            {/* <Box>{userId}</Box> */}
            <Stack>
                <Stack>
                    <Heading flex="0" size="md">
                        Recent Matches
                    </Heading>
                    {matchTotal && (
                        <Box>
                            <Text textStyle="md" padding="8px">
                                Total Matches Played: {matchTotal}
                            </Text>
                            <Pagination.Root
                                count={matchTotal}
                                pageSize={10}
                                defaultPage={1}
                                onPageChange={(event) => {
                                    setIsLoading(true)
                                    console.log(event)
                                    if (event.page === 1) {
                                        setLastMatch(null)
                                    }
                                    setPageNumber(event.page)
                                }}
                            >
                                <ButtonGroup gap="4" size="sm" variant="ghost">
                                    <Pagination.PrevTrigger asChild>
                                        <IconButton>
                                            <ChevronLeft />
                                        </IconButton>
                                    </Pagination.PrevTrigger>
                                    <Text textStyle="md" padding="8px">
                                        {pageNumber} of {pageCount}
                                    </Text>
                                    <Pagination.NextTrigger asChild>
                                        <IconButton>
                                            <ChevronRight />
                                        </IconButton>
                                    </Pagination.NextTrigger>
                                </ButtonGroup>
                            </Pagination.Root>
                        </Box>
                    )}

                    {recentMatches &&
                        recentMatches.map((match) => {
                            return (
                                <>
                                    {isLoading && <Skeleton height="230px" />}
                                    {!isLoading && (
                                        <Card.Root variant="elevated" maxH="230px">
                                            <Card.Header>
                                                {new Date(
                                                    match.timestamp._seconds * 1000
                                                ).toLocaleString()}
                                            </Card.Header>
                                            <Card.Body flex="1">
                                                <Flex>
                                                    <Stack gap="0px" flex="1" alignItems="center">
                                                        <Text textStyle="md" padding="8px">
                                                            {match.player1Name}
                                                        </Text>
                                                        <Text textStyle="xs" padding="8px">
                                                            {match.player1Char}
                                                        </Text>
                                                        <RenderSuperArt code={match.player1Super} />
                                                    </Stack>
                                                    <Flex flex="1" justifyContent="center">
                                                        <Text textStyle="md" padding="8px">
                                                            {match.results === '1' ? 1 : 0}
                                                        </Text>
                                                        <Text textStyle="md" padding="8px">
                                                            VS
                                                        </Text>
                                                        <Text textStyle="md" padding="8px">
                                                            {match.results === '2' ? 1 : 0}
                                                        </Text>
                                                    </Flex>
                                                    <Stack gap="0px" flex="1" alignItems="center">
                                                        <Text textStyle="md" padding="8px">
                                                            {match.player2Name || 'Unknown User'}
                                                        </Text>
                                                        <Text textStyle="xs" padding="8px">
                                                            {match.player2Char}
                                                        </Text>
                                                        <RenderSuperArt code={match.player2Super} />
                                                    </Stack>
                                                </Flex>
                                            </Card.Body>
                                            <Card.Footer />
                                        </Card.Root>
                                    )}
                                </>
                            )
                        })}
                </Stack>
            </Stack>
            {isLoading && (
                <Box pos="absolute" inset="0" bg="bg/80">
                    <Center h="full">
                        <Spinner color="red.500" />
                    </Center>
                </Box>
            )}
        </Stack>
    )
}
