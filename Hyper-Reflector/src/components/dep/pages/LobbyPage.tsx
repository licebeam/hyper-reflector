import { useEffect, useState } from 'react'
import {
    Stack,
    Button,
    Box,
    Dialog,
    Portal,
    Input,
    Switch,
    Clipboard,
    IconButton,
} from '@chakra-ui/react'
import { CloseButton } from '../../chakra/ui/close-button'
import { Field } from '../../chakra/ui/field'
import ChatWindow from '../ChatWindow'
import ChatBar from '../ChatBar'
import UsersChat from '../UsersChat'
import SideBar from '../general/SideBar'
import { toaster } from '../../chakra/ui/toaster'
import { ClipboardCopy, KeySquare, Plus, Users } from 'lucide-react'
import { PasswordInput } from '../../chakra/ui/password-input'
import { useLayoutStore, useLoginStore, useMessageStore } from '../../../state/deprecated_store'
import {
    RegExpMatcher,
    asteriskCensorStrategy,
    TextCensor,
    englishDataset,
    englishRecommendedTransformers,
} from 'obscenity'

const matcher = new RegExpMatcher({
    ...englishDataset.build(),
    ...englishRecommendedTransformers,
})

export default function LobbyPage() {
    const theme = useLayoutStore((state) => state.appTheme)
    const clearMessageState = useMessageStore((state) => state.clearMessageState)
    const userState = useLoginStore((state) => state.userState)
    const updateUserState = useLoginStore((state) => state.updateUserState)
    const currentLobbyState = useMessageStore((state) => state.currentLobbyState)
    const setCurrentLobbyState = useMessageStore((state) => state.setCurrentLobbyState)
    const currentLobbiesState = useMessageStore((state) => state.currentLobbiesState)
    const setCurrentLobbiesState = useMessageStore((state) => state.setCurrentLobbiesState)
    const [selectedLobby, setSelectedLobby] = useState(undefined)
    const [enteredPass, setEnteredPass] = useState<string>('')
    const [open, setOpen] = useState(false)
    const [openCreate, setOpenCreate] = useState(false)
    const [newLobby, setNewLobby] = useState({ name: '', isPrivate: false, pass: '' })

    const createBlocked = (): boolean => {
        if (newLobby?.name === 'Hyper Reflector') {
            // prevent user from re-creating our default chat
            return true
        }
        if (newLobby?.name?.length <= 3 || newLobby?.name?.length >= 17) {
            return true
        }
        if (newLobby?.pass?.length >= 151) {
            return true
        }
        if (newLobby.isPrivate && !newLobby.pass.length) {
            return true
        }
        if (!newLobby.name.length) {
            return true
        }
        return false
    }

    const resetCreate = () => {
        setNewLobby({ name: '', isPrivate: false, pass: '' })
    }

    useEffect(() => {
        if (selectedLobby && selectedLobby.name.length) {
            // this should only fire off if we change lobbies
            window.api.userChangeLobby({
                newLobbyId: selectedLobby.name,
                pass: selectedLobby.pass || enteredPass,
                isPrivate: selectedLobby.isPrivate,
                user: userState,
            })
            setSelectedLobby(selectedLobby)
            // set the userState lobby so that messages send to the current lobby via websockets
            updateUserState({ ...userState, currentLobbyId: selectedLobby.name })
            clearMessageState()
            // this makes sure when we change lobbies everyone gets our CURRENT state.
            window.api.getConfigValue('isAway')
        }
    }, [currentLobbyState])

    const handleUpdateLobbies = (data) => {
        setCurrentLobbiesState(data)
    }

    // const checkVid = () => {
    //     const video = document.querySelector('video')
    //     navigator.mediaDevices
    //         .getDisplayMedia({
    //             audio: true,
    //             video: {
    //                 width: 320,
    //                 height: 240,
    //                 frameRate: 60,
    //             },
    //         })
    //         .then((stream) => {
    //             video.srcObject = stream
    //             video.onloadedmetadata = (e) => video.play()
    //         })
    //         .catch((e) => console.log(e))
    // }

    const handleUpdateUser = (data) => {
        window.api.getConfigValue('isAway')
        if (data?.isNewPing) {
            const updatedPings =
                userState?.lastKnownPings?.filter((peer) => peer.id !== data.id) ?? []
            updatedPings.push(data)

            updateUserState({
                ...userState,
                lastKnownPings: updatedPings,
            })
        } else {
            updateUserState({
                ...userState,
                ...data,
            })
        }
    }

    useEffect(() => {
        window.api.removeExtraListeners('updateUserData', handleUpdateUser)
        window.api.on('updateUserData', handleUpdateUser)

        window.api.removeExtraListeners('updateLobbyStats', handleUpdateLobbies)
        window.api.on('updateLobbyStats', handleUpdateLobbies)

        return () => {
            window.api.removeListener('updateUserData', handleUpdateUser)
            window.api.removeListener('updateLobbyStats', handleUpdateLobbies)
        }
    }, [])

    return (
        <Box height="100%" display="flex" width="100%">
            {/* <video width="320" height="240" autoPlay></video> */}
            <Dialog.Root open={openCreate}>
                <Portal>
                    <Dialog.Backdrop />
                    <Dialog.Positioner>
                        <Dialog.Content bg={theme.colors.main.bg}>
                            <Dialog.CloseTrigger
                                color={theme.colors.main.actionSecondary}
                                asChild
                                width="20px"
                                alignSelf="flex-end"
                                position="absolute"
                            >
                                <CloseButton
                                    bg={theme.colors.main.bg}
                                    size="sm"
                                    onClick={() => {
                                        setOpenCreate(false)
                                        resetCreate()
                                    }}
                                />
                            </Dialog.CloseTrigger>
                            <Dialog.Header>
                                <Dialog.Title color={theme.colors.main.actionSecondary}>
                                    Create New Lobby
                                </Dialog.Title>
                            </Dialog.Header>
                            <Dialog.Body>
                                <Box>
                                    <Field
                                        label="Lobby Name"
                                        helperText="Must be between 4 and 16 characters"
                                        color={theme.colors.main.textMedium}
                                    >
                                        <Input
                                            bg={theme.colors.main.textSubdued}
                                            color={theme.colors.main.bg}
                                            min={4}
                                            max={16}
                                            type="text"
                                            value={newLobby.name}
                                            onChange={(e) => {
                                                setNewLobby({
                                                    ...newLobby,
                                                    name: e.target.value,
                                                })
                                            }}
                                            placeholder="My private lobby"
                                        />
                                    </Field>
                                    <Switch.Root
                                        marginTop="12px"
                                        color={theme.colors.main.actionSecondary}
                                        onCheckedChange={(e) =>
                                            setNewLobby({ ...newLobby, isPrivate: e.checked })
                                        }
                                    >
                                        <Switch.HiddenInput />
                                        <Switch.Control bg={theme.colors.main.actionSecondary}>
                                            <Switch.Thumb bg={theme.colors.main.bg} />
                                        </Switch.Control>
                                        <Switch.Label>Private</Switch.Label>
                                    </Switch.Root>
                                </Box>

                                {newLobby?.isPrivate && (
                                    <Box marginTop={'12px'}>
                                        <PasswordInput
                                            bg={theme.colors.main.textSubdued}
                                            color={theme.colors.main.bg}
                                            placeholder="Password"
                                            value={newLobby.pass}
                                            min={1}
                                            max={150}
                                            onChange={(e) =>
                                                setNewLobby({ ...newLobby, pass: e.target.value })
                                            }
                                        />
                                    </Box>
                                )}
                            </Dialog.Body>
                            <Dialog.Footer>
                                <Dialog.ActionTrigger asChild>
                                    <Button
                                        color={theme.colors.main.text}
                                        onClick={() => {
                                            setOpenCreate(false)
                                            resetCreate()
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                </Dialog.ActionTrigger>
                                <Button
                                    bg={theme.colors.main.actionSecondary}
                                    color={theme.colors.main.text}
                                    disabled={!!createBlocked()}
                                    onClick={() => {
                                        const strategy = asteriskCensorStrategy()
                                        const censor = new TextCensor().setStrategy(strategy)
                                        const nameMatch = newLobby?.name
                                        const matches = matcher.getAllMatches(nameMatch)
                                        const censoredLobbyName = censor.applyTo(nameMatch, matches)
                                        const censoredLobby = {
                                            ...newLobby,
                                            name: censoredLobbyName,
                                        }
                                        setOpenCreate(false)
                                        resetCreate()
                                        // call the BE to add the user to the new lobby
                                        setSelectedLobby(censoredLobby)
                                        setCurrentLobbyState(censoredLobby)
                                        window.api.createNewLobby({
                                            name: censoredLobbyName,
                                            pass: newLobby.pass,
                                            isPrivate: newLobby.isPrivate,
                                            user: userState,
                                        }) // send new lobby info to BE
                                        toaster.success({
                                            title: 'Lobby Created!',
                                            description: censoredLobbyName,
                                        })
                                        setCurrentLobbiesState([
                                            ...currentLobbiesState,
                                            censoredLobby,
                                        ])
                                    }}
                                >
                                    Create
                                </Button>
                            </Dialog.Footer>
                        </Dialog.Content>
                    </Dialog.Positioner>
                </Portal>
            </Dialog.Root>
            <SideBar width="240px">
                <Button
                    justifyContent="flex-start"
                    bg={theme.colors.main.actionSecondary}
                    onClick={() => {
                        setOpenCreate(true)
                    }}
                >
                    <Plus />
                    New Lobby
                </Button>
                <Dialog.Root open={open}>
                    {currentLobbiesState.map((lobby, index) => {
                        return (
                            <Dialog.Trigger asChild key={index}>
                                <Button
                                    display={'flex'}
                                    disabled={currentLobbyState.name === lobby.name}
                                    justifyContent="flex-start"
                                    bg={theme.colors.main.card}
                                    onClick={async () => {
                                        if (lobby.isPrivate) {
                                            setOpen(true)
                                            setSelectedLobby(lobby)
                                        } else {
                                            setCurrentLobbyState(lobby)
                                            setSelectedLobby(lobby)
                                        }
                                    }}
                                >
                                    <Box flex="4" overflow="hidden">
                                        {lobby.name}
                                    </Box>
                                    <Box flex="1">
                                        <Box
                                            alignItems="center"
                                            justifyContent="center"
                                            display="flex"
                                            borderRadius={8}
                                            width="52px"
                                            height="28px"
                                            bg={theme.colors.main.secondary}
                                        >
                                            <Users />
                                            <Box minW="20px" color={theme.colors.main.actionLight}>
                                                {lobby.users || 0}
                                            </Box>
                                        </Box>
                                    </Box>
                                    {lobby.isPrivate && (
                                        <Stack
                                            justifyContent="center"
                                            verticalAlign="center"
                                            width="26px"
                                            height="26px"
                                            borderRadius={8}
                                            bg={theme.colors.main.secondary}
                                            position="absolute"
                                            flex="1"
                                            alignItems={'center'}
                                            right="204px"
                                            color={theme.colors.main.actionLight}
                                        >
                                            <KeySquare />
                                        </Stack>
                                    )}
                                </Button>
                            </Dialog.Trigger>
                        )
                    })}
                    <Portal>
                        <Dialog.Backdrop />
                        <Dialog.Positioner>
                            <Dialog.Content bg={theme.colors.main.bg}>
                                <Dialog.CloseTrigger
                                    asChild
                                    width="20px"
                                    alignSelf="flex-end"
                                    position="absolute"
                                >
                                    <CloseButton
                                        color={theme.colors.main.actionSecondary}
                                        bg={theme.colors.main.bg}
                                        size="sm"
                                        onClick={() => {
                                            setEnteredPass('')
                                            setOpen(false)
                                        }}
                                    />
                                </Dialog.CloseTrigger>
                                <Dialog.Header>
                                    <Dialog.Title color={theme.colors.main.actionSecondary}>
                                        Join Lobby: {selectedLobby && selectedLobby.name}
                                    </Dialog.Title>
                                </Dialog.Header>
                                <Dialog.Body>
                                    {selectedLobby?.isPrivate && (
                                        <div>
                                            <Box>Lobby Password</Box>
                                            <PasswordInput
                                                bg={theme.colors.main.textSubdued}
                                                color={theme.colors.main.bg}
                                                value={enteredPass}
                                                onChange={(e) => setEnteredPass(e.target.value)}
                                                placeholder="Lobby Password"
                                            />
                                        </div>
                                    )}
                                </Dialog.Body>
                                <Dialog.Footer>
                                    <Dialog.ActionTrigger asChild>
                                        <Button
                                            color={theme.colors.main.text}
                                            onClick={() => {
                                                setEnteredPass('')
                                                setOpen(false)
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                    </Dialog.ActionTrigger>
                                    <Button
                                        bg={theme.colors.main.actionSecondary}
                                        color={theme.colors.main.text}
                                        disabled={!enteredPass.length}
                                        onClick={() => {
                                            if (enteredPass === selectedLobby.pass) {
                                                //console.log('enetered pass', enteredPass)
                                                setCurrentLobbyState(selectedLobby)
                                                setEnteredPass('')
                                                setOpen(false)
                                            }
                                        }}
                                    >
                                        Join
                                    </Button>
                                </Dialog.Footer>
                            </Dialog.Content>
                        </Dialog.Positioner>
                    </Portal>
                </Dialog.Root>
            </SideBar>
            <Stack flex="3" minH="100%" overflow="hidden" gap="12px">
                <Box
                    marginLeft="12px"
                    textStyle="xs"
                    color={theme.colors.main.action}
                    display="flex"
                    alignItems="center"
                    gap={'32px'}
                    height={'24px'}
                >
                    {currentLobbyState?.name || ''}
                    {currentLobbyState?.isPrivate && (
                        <Clipboard.Root
                            value={currentLobbyState?.pass || 'eeeee'}
                            color={theme.colors.main.action}
                        >
                            <Clipboard.Trigger asChild>
                                <IconButton
                                    variant="subtle"
                                    size="xs"
                                    bg={theme.colors.main.bg}
                                    color={theme.colors.main.action}
                                >
                                    <ClipboardCopy />
                                    copy password
                                </IconButton>
                            </Clipboard.Trigger>
                        </Clipboard.Root>
                    )}
                </Box>
                <ChatWindow />
                <ChatBar />
            </Stack>
            <Box flex="1">
                <UsersChat />
            </Box>
        </Box>
    )
}
