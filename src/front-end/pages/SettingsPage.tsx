import { useEffect, useState } from 'react'
import { Button, Stack, Input, Text, Heading, createListCollection } from '@chakra-ui/react'
import {
    SelectContent,
    SelectItem,
    SelectRoot,
    SelectTrigger,
    SelectValueText,
} from '../components/chakra/ui/select'
import { Field } from '../components/chakra/ui/field'

export default function SettingsPage() {
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
        <Stack gap={2}>
            <Heading size="md">Application Settings</Heading>
            <Stack gap={6}>
                <Text textStyle="xs">
                    This is where we can set our emulator path and other setting
                </Text>
                <Text textStyle="xs">Current Path: {currentEmuPath}</Text>
                <Button
                    onClick={() => {
                        window.api.setEmulatorPath()
                    }}
                >
                    Set Emulator Path
                </Button>
                <Text textStyle="xs">
                    You may need to restart the application if the emulator does not open
                    automatically.
                </Text>

                <Text textStyle="xs">Current delay: {currentDelay}</Text>
                <Field label="Online Delay" helperText="">
                    <SelectRoot
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
        </Stack>
    )
}
