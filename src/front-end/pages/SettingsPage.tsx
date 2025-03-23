import { useEffect, useState } from 'react'
import {
    Button,
    Stack,
    Input,
    Text,
    Heading,
    createListCollection,
    Box,
    Flex,
} from '@chakra-ui/react'
import {
    SelectContent,
    SelectItem,
    SelectRoot,
    SelectTrigger,
    SelectValueText,
} from '../components/chakra/ui/select'
import { Field } from '../components/chakra/ui/field'
import { useLoginStore } from '../state/store'

export default function SettingsPage() {
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)
    const [currentEmuPath, setCurrentEmuPath] = useState('')
    const [currentDelay, setCurrentDelay] = useState('')

    const delays = createListCollection({
        items: [
            { label: 'Delay 0', value: '0' },
            { label: 'Delay 1', value: '1' },
            { label: 'Delay 2', value: '2' },
            { label: 'Delay 3', value: '3' },
            { label: 'Delay 4', value: '4' },
            { label: 'Delay 5', value: '5' },
            { label: 'Delay 6', value: '6' },
            { label: 'Delay 7', value: '7' },
        ],
    })

    const handleSetPath = (path: string) => {
        setCurrentEmuPath(path)
    }

    const handleSetDelay = (delay: string) => {
        console.log(delay)
        setCurrentDelay(delay)
    }

    useEffect(() => {
        console.log('re-rendered')
        window.api.getEmulatorDelay()
        window.api.getEmulatorPath()
    }, [])

    useEffect(() => {
        // Listen for updates from Electron
        window.api.removeExtraListeners('emulatorPath', handleSetPath)
        window.api.on('emulatorPath', handleSetPath)

        window.api.removeExtraListeners('emulatorDelay', handleSetDelay)
        window.api.on('emulatorDelay', handleSetDelay)

        return () => {
            window.api.removeListener('emulatorPath', handleSetPath)
            window.api.removeListener('emulatorDelay', handleSetDelay)
        }
    }, [])

    return (
        <Stack minH="100%">
            <Heading flex="0" size="md" color="gray.200">
                Application Settings
            </Heading>
            <Stack flex="1">
                <Text textStyle="xs" color="gray.400">
                    This is where we can set our emulator path and other setting
                </Text>
                <Text textStyle="xs" color="gray.300">
                    Current Path: {currentEmuPath}
                </Text>
                <Button
                    bg="blue.500"
                    onClick={() => {
                        window.api.setEmulatorPath()
                    }}
                >
                    Set Emulator Path
                </Button>
            </Stack>
            <Stack flex="1">
                <Text textStyle="xs" color="gray.300">
                    Current delay: {currentDelay}
                </Text>
                <Field label="Online Delay" helperText="" color="gray.300">
                    <SelectRoot
                        color="blue.400"
                        collection={delays}
                        value={[currentDelay]}
                        onValueChange={(e) => {
                            handleSetDelay(e.value[0])
                            window.api.setEmulatorDelay(e.value[0])
                        }}
                    >
                        <SelectTrigger>
                            <SelectValueText placeholder="Select Delay" />
                        </SelectTrigger>
                        <SelectContent>
                            {delays.items.map((delay) => (
                                <SelectItem item={delay} key={delay.value}>
                                    {delay.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </SelectRoot>
                </Field>
            </Stack>
            <Stack flex="1" justifyContent="flex-end">
                <Box display="flex">
                    {isLoggedIn && (
                        <>
                            <Text textStyle="xs" flex="1" color="gray.400">
                                Log out user, this will also make it so you do not automaitcally log
                                in on start next time.
                            </Text>
                            <Button
                                colorPalette="red"
                                flex="1"
                                alignSelf="center"
                                onClick={() => {
                                    console.log('trying to log out')
                                    window.api.logOutUser()
                                }}
                            >
                                Log Out
                            </Button>
                        </>
                    )}
                </Box>
            </Stack>
        </Stack>
    )
}
