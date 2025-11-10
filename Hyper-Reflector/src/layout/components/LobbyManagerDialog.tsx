import { useEffect, useMemo, useState } from 'react'
import {
    Box,
    Button,
    Dialog,
    Flex,
    Input,
    Stack,
    Switch,
    Text,
} from '@chakra-ui/react'
import type { LobbySummary } from '../../state/store'
import { Field } from '../../components/chakra/ui/field'
import { PasswordInput } from '../../components/chakra/ui/password-input'

type JoinResult = string | null | undefined | Promise<string | null | undefined>

type LobbyManagerDialogProps = {
    isOpen: boolean
    onClose: () => void
    accentColor: string
    currentLobbyId: string
    availableLobbies: LobbySummary[]
    lobbyNameMaxLength: number
    onJoinLobby: (lobby: LobbySummary, pass: string) => JoinResult
    onCreateLobby: (params: { name: string; isPrivate: boolean; pass: string }) => JoinResult
}

const CREATE_PASSWORD_LIMIT = 150

export function LobbyManagerDialog({
    isOpen,
    onClose,
    accentColor,
    currentLobbyId,
    availableLobbies,
    lobbyNameMaxLength,
    onJoinLobby,
    onCreateLobby,
}: LobbyManagerDialogProps) {
    const [createName, setCreateName] = useState('')
    const [createPass, setCreatePass] = useState('')
    const [createPrivate, setCreatePrivate] = useState(false)
    const [createError, setCreateError] = useState('')
    const [joinPasses, setJoinPasses] = useState<Record<string, string>>({})
    const [joinErrors, setJoinErrors] = useState<Record<string, string>>({})

    useEffect(() => {
        if (isOpen) {
            setCreateName('')
            setCreatePass('')
            setCreatePrivate(false)
            setCreateError('')
            setJoinPasses({})
            setJoinErrors({})
        }
    }, [isOpen])

    const sortedLobbies = useMemo(() => {
        return [...availableLobbies].sort((a, b) => {
            const aUsers = a.users ?? 0
            const bUsers = b.users ?? 0
            if (bUsers !== aUsers) return bUsers - aUsers
            return a.name.localeCompare(b.name)
        })
    }, [availableLobbies])

    const createDisabled =
        !createName.trim() || (createPrivate && !createPass.trim()) || createPass.length > CREATE_PASSWORD_LIMIT

    const handleCreateLobby = async () => {
        const result = await onCreateLobby({
            name: createName,
            isPrivate: createPrivate,
            pass: createPass,
        })

        if (typeof result === 'string' && result.length > 0) {
            setCreateError(result)
            return
        }

        setCreateName('')
        setCreatePass('')
        setCreatePrivate(false)
        setCreateError('')
        onClose()
    }

    const handleJoinLobby = async (lobby: LobbySummary) => {
        const pass = joinPasses[lobby.name] ?? ''
        const result = await onJoinLobby(lobby, pass)

        if (typeof result === 'string' && result.length > 0) {
            setJoinErrors((prev) => ({ ...prev, [lobby.name]: result }))
            return
        }

        setJoinErrors((prev) => {
            if (!prev[lobby.name]) return prev
            const next = { ...prev }
            delete next[lobby.name]
            return next
        })
        setJoinPasses((prev) => {
            if (!prev[lobby.name]) return prev
            const next = { ...prev }
            delete next[lobby.name]
            return next
        })
        onClose()
    }

    return (
        <Dialog.Root open={isOpen} onOpenChange={({ open }) => (open ? undefined : onClose())}>
            <Dialog.Backdrop />
            <Dialog.Positioner>
                <Dialog.Content maxW="lg">
                    <Dialog.CloseTrigger />
                    <Dialog.Header>
                        <Dialog.Title>Manage Lobbies</Dialog.Title>
                        <Dialog.Description>
                            Switch between active rooms or create a new lobby for your group.
                        </Dialog.Description>
                    </Dialog.Header>
                    <Dialog.Body>
                        <Stack gap="4">
                            <Box>
                                <Text fontWeight="semibold">Current lobby</Text>
                                <Text fontSize="sm" color="gray.500">
                                    {currentLobbyId}
                                </Text>
                            </Box>
                            <Box height="1px" bg="border" />
                            <Stack gap="3">
                                <Text fontWeight="semibold">Available lobbies</Text>
                                {sortedLobbies.length === 0 ? (
                                    <Text fontSize="sm" color="gray.500">
                                        No lobbies found. Create one below.
                                    </Text>
                                ) : (
                                    sortedLobbies.map((lobby) => {
                                        const isCurrent = lobby.name === currentLobbyId
                                        const passValue = joinPasses[lobby.name] ?? ''
                                        const joinDisabled =
                                            isCurrent ||
                                            (lobby.isPrivate ? !passValue.trim() : false)

                                        return (
                                            <Box
                                                key={lobby.name}
                                                borderWidth="1px"
                                                borderRadius="md"
                                                padding="3"
                                                bg="bg.canvas"
                                            >
                                                <Flex justifyContent="space-between" gap="3" alignItems="center">
                                                    <Box>
                                                        <Text fontWeight="medium">{lobby.name}</Text>
                                                        <Text fontSize="xs" color="gray.500">
                                                            {`${lobby.users ?? 0} users | ${
                                                                lobby.isPrivate ? 'Private' : 'Public'
                                                            }`}
                                                        </Text>
                                                    </Box>
                                                    <Button
                                                        size="sm"
                                                        colorPalette={accentColor}
                                                        variant="solid"
                                                        disabled={joinDisabled}
                                                        onClick={() => handleJoinLobby(lobby)}
                                                    >
                                                        {isCurrent
                                                            ? 'Current'
                                                            : lobby.isPrivate
                                                            ? 'Join (Private)'
                                                            : 'Join'}
                                                    </Button>
                                                </Flex>
                                                {lobby.isPrivate ? (
                                                    <Box mt="3">
                                                        <Field label="Password" required>
                                                            <PasswordInput
                                                                value={passValue}
                                                                onChange={(event) => {
                                                                    const next = event.target.value
                                                                    setJoinPasses((prev) => ({
                                                                        ...prev,
                                                                        [lobby.name]: next,
                                                                    }))
                                                                    setJoinErrors((prev) => {
                                                                        if (!prev[lobby.name]) return prev
                                                                        const trimmed = next.trim()
                                                                        if (!trimmed.length) return prev
                                                                        const nextErrors = { ...prev }
                                                                        delete nextErrors[lobby.name]
                                                                        return nextErrors
                                                                    })
                                                                }}
                                                            />
                                                        </Field>
                                                        {joinErrors[lobby.name] ? (
                                                            <Text fontSize="xs" color="red.400" mt="1">
                                                                {joinErrors[lobby.name]}
                                                            </Text>
                                                        ) : null}
                                                    </Box>
                                                ) : null}
                                            </Box>
                                        )
                                    })
                                )}
                            </Stack>
                            <Box height="1px" bg="border" />
                            <Stack gap="3">
                                <Text fontWeight="semibold">Create a lobby</Text>
                                <Field label="Lobby name" required>
                                    <Input
                                        value={createName}
                                        onChange={(event) => {
                                            setCreateName(event.target.value)
                                            if (createError) setCreateError('')
                                        }}
                                        maxLength={lobbyNameMaxLength}
                                        placeholder="Enter a lobby name"
                                    />
                                </Field>
                                <Switch.Root
                                    size="md"
                                    display="flex"
                                    alignItems="center"
                                    justifyContent="space-between"
                                    gap="2"
                                    checked={createPrivate}
                                    onCheckedChange={(event) => {
                                        setCreatePrivate(event.checked)
                                        if (!event.checked) {
                                            setCreatePass('')
                                        }
                                        if (createError) setCreateError('')
                                    }}
                                >
                                    <Switch.HiddenInput />
                                    <Switch.Label>Private lobby</Switch.Label>
                                    <Switch.Control>
                                        <Switch.Thumb />
                                    </Switch.Control>
                                </Switch.Root>
                                {createPrivate ? (
                                    <Field label="Password" required>
                                        <PasswordInput
                                            value={createPass}
                                            onChange={(event) => {
                                                setCreatePass(event.target.value)
                                                if (createError) setCreateError('')
                                            }}
                                            maxLength={CREATE_PASSWORD_LIMIT}
                                            placeholder="Set a lobby password"
                                        />
                                    </Field>
                                ) : null}
                                {createError ? (
                                    <Text fontSize="sm" color="red.400">
                                        {createError}
                                    </Text>
                                ) : null}
                                <Button
                                    colorPalette={accentColor}
                                    onClick={handleCreateLobby}
                                    disabled={createDisabled}
                                >
                                    Create lobby
                                </Button>
                            </Stack>
                        </Stack>
                    </Dialog.Body>
                    <Dialog.Footer>
                        <Button variant="outline" onClick={onClose}>
                            Close
                        </Button>
                    </Dialog.Footer>
                </Dialog.Content>
            </Dialog.Positioner>
        </Dialog.Root>
    )
}
