import { useState } from 'react'
import {
    Button,
    Stack,
    Input,
    Text,
    Heading,
    Flex,
    createListCollection,
    Box,
} from '@chakra-ui/react'
import {
    SelectContent,
    SelectItem,
    SelectLabel,
    SelectRoot,
    SelectTrigger,
    SelectValueText,
} from '../components/chakra/ui/select'
import { Field } from '../components/chakra/ui/field'
import SideBar from '../components/general/SideBar'
import { BookUser, Construction, FlaskConical, PaintBucket, Router, UserRound } from 'lucide-react'
import { useLayoutStore, useLoginStore } from '../state/store'

export default function OfflinePage() {
    const theme = useLayoutStore((state) => state.appTheme)
    const updateUserState = useLoginStore((state) => state.updateUserState)
    const userState = useLoginStore((state) => state.userState)
    const [currentTab, setCurrentTab] = useState<number>(0)
    const [player, setPlayer] = useState('')
    const [opponentPort, setOpponentPort] = useState('')
    const [opponentIp, setOpponentIp] = useState('')
    const [myPort, setMyPort] = useState('')

    const players = createListCollection({
        items: [
            { label: 'Player 1', value: '0' },
            { label: 'Player 2', value: '1' },
        ],
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
                    <FlaskConical />
                    Training
                </Button>

                <Button
                    disabled={currentTab === 1}
                    justifyContent="flex-start"
                    bg={theme.colors.main.secondary}
                    onClick={() => setCurrentTab(1)}
                >
                    <BookUser />
                    Match By Code
                </Button>
                <Button
                    disabled={currentTab === 2}
                    justifyContent="flex-start"
                    bg={theme.colors.main.secondary}
                    onClick={() => setCurrentTab(2)}
                >
                    <Router />
                    Match By IP
                </Button>
                <Button
                    disabled={currentTab === 3}
                    justifyContent="flex-start"
                    bg={theme.colors.main.secondary}
                    onClick={() => setCurrentTab(3)}
                >
                    <PaintBucket />
                    Palette Mods
                </Button>
            </SideBar>

            <Stack flex="1" maxWidth={'600px'}>
                {currentTab === 0 && (
                    <Stack>
                        <Heading size="md" color={theme.colors.main.textSubdued}>
                            Training Mode
                        </Heading>
                        <Button
                            bg={theme.colors.main.actionSecondary}
                            onClick={() => {
                                // TODO eventually adjust this for effecting the match making queue, challenge sound etc.
                                updateUserState({ ...userState, isFighting: true })
                                // console.log('updating fighting state')
                                window.api.startSoloTraining()
                            }}
                        >
                            Start Training
                        </Button>
                    </Stack>
                )}
                {currentTab === 1 && (
                    <Stack>
                        <Heading size="md" color={theme.colors.main.textSubdued}>
                            Connect By Code
                        </Heading>
                        <Text textStyle="xs" color={theme.colors.main.textMedium}>
                            Connect to another user via a code of your choosing, this uses Hyper
                            Reflector's match making server to connect two users without the need to
                            log in.
                        </Text>
                        <Text textStyle="xs" color={theme.colors.main.caution}>
                            Make sure both players create a long 8 digit code to connect to
                            eachother. This is an early feature, so there are bound to be issues.
                        </Text>
                        <Flex gap="2">
                            <Field
                                label="Player"
                                helperText="The side you play on must be opposite of your opponent."
                                color={theme.colors.main.textMedium}
                            >
                                <SelectRoot
                                    color={theme.colors.main.actionSecondary}
                                    collection={players}
                                    value={[player]}
                                    onValueChange={(e) => setPlayer(e.value[0])}
                                >
                                    <SelectTrigger>
                                        <SelectValueText placeholder="Select Player" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {players.items.map((player) => (
                                            <SelectItem item={player} key={player.value}>
                                                {player.label}
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </SelectRoot>
                            </Field>
                            <Field
                                label="Player Code"
                                helperText="Send this to your opponent, atleast 8 characters"
                                color={theme.colors.main.textMedium}
                            >
                                <Input
                                    bg={theme.colors.main.textSubdued}
                                    color={theme.colors.main.bg}
                                    min={8}
                                    max={16}
                                    type="text"
                                    value={myPort}
                                    onChange={(e) => setMyPort(e.target.value)}
                                    placeholder="Bobby789"
                                />
                            </Field>
                            <Field
                                label="Opponent Code"
                                helperText="The Code of your opponent, atleast 8 characters"
                                color={theme.colors.main.textMedium}
                            >
                                <Input
                                    bg={theme.colors.main.textSubdued}
                                    color={theme.colors.main.bg}
                                    min={8}
                                    max={16}
                                    type="text"
                                    value={opponentPort}
                                    onChange={(e) => setOpponentPort(e.target.value)}
                                    placeholder="Blake123"
                                />
                            </Field>
                        </Flex>
                        <Flex gap="8">
                            <Button
                                bg={theme.colors.main.actionSecondary}
                                disabled={opponentPort.length < 8 || !player || myPort.length < 8}
                                alignSelf="center"
                                onClick={() => {
                                    window.api.startGameOnline(opponentPort, player, myPort)
                                }}
                            >
                                Connect
                            </Button>
                        </Flex>
                    </Stack>
                )}
                {currentTab === 2 && (
                    <div>
                        <Box color={theme.colors.main.actionSecondary} display="flex" gap="12px">
                            <Construction />
                            Under Construction
                        </Box>
                    </div>
                )}
                {currentTab === 3 && (
                    <div>
                        <Box color={theme.colors.main.actionSecondary} display="flex" gap="12px">
                            <Construction />
                            Under Construction
                        </Box>
                    </div>
                )}
            </Stack>
        </Box>
    )
}
