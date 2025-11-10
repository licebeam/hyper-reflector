import { useEffect, useState, useRef } from 'react'
import { Button, Stack, Text, Heading, createListCollection, Box } from '@chakra-ui/react'
import {
    SelectContent,
    SelectItem,
    SelectRoot,
    SelectTrigger,
    SelectValueText,
} from '../../chakra/ui/select'
import { toaster } from '../../chakra/ui/toaster'
import { useConfigStore, useLayoutStore, useLoginStore } from '../../../state/deprecated_store'
import { getThemeNameList } from '../../../utils/theme'
import SideBar from '../general/SideBar'
import { AlertCircle, Settings, Settings2, Volume2, VolumeX } from 'lucide-react'

export default function SettingsPage() {
    const theme = useLayoutStore((state) => state.appTheme)
    const setTheme = useLayoutStore((state) => state.setTheme)
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)
    const configState = useConfigStore((state) => state.configState)
    const updateConfigState = useConfigStore((state) => state.updateConfigState)
    const [currentTab, setCurrentTab] = useState<number>(0)
    const [currentEmuPath, setCurrentEmuPath] = useState('')
    const [currentDelay, setCurrentDelay] = useState('')
    const [currentTheme, setCurrentTheme] = useState('')
    const prevEmuPathRef = useRef('')
    const hasMounted = useRef(false)

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

    const themes = createListCollection({
        items: [
            ...getThemeNameList().map((t, index) => {
                return { label: t, value: index }
            }),
        ],
    })

    const handleSetPath = (path: string) => {
        setCurrentEmuPath(path)
    }

    const handleSetDelay = (delay: string) => {
        setCurrentDelay(delay)
    }

    const handleSetTheme = (themeIndex: string) => {
        setCurrentTheme(themeIndex)
        const themeToSet = themes.items[parseInt(themeIndex)].label
        setTheme(themeToSet)
    }

    useEffect(() => {
        window.api.getEmulatorPath()
        window.api.getEmulatorDelay()
        window.api.getAppTheme()
        window.api.getConfigValue('appSoundOn')
    }, [])

    useEffect(() => {
        if (prevEmuPathRef.current !== '') {
            toaster.success({
                title: 'Path Set!',
                // description: `${currentEmuPath}`,
            })
        }

        if (prevEmuPathRef.current === currentEmuPath && hasMounted.current) {
            toaster.error({
                title: 'Path setting failed!',
                // description: `${currentEmuPath}`,
            })
        }

        prevEmuPathRef.current = currentEmuPath
        hasMounted.current = true
    }, [currentEmuPath])

    useEffect(() => {
        //TODO remove the old ones and only use getConfigValue
        window.api.removeExtraListeners('emulatorPath', handleSetPath)
        window.api.on('emulatorPath', handleSetPath)

        window.api.removeExtraListeners('emulatorDelay', handleSetDelay)
        window.api.on('emulatorDelay', handleSetDelay)

        window.api.removeExtraListeners('appTheme', handleSetTheme)
        window.api.on('appTheme', handleSetTheme)

        return () => {
            window.api.removeListener('emulatorPath', handleSetPath)
            window.api.removeListener('emulatorDelay', handleSetDelay)
            window.api.removeListener('appTheme', handleSetTheme)
        }
    }, [])

    return (
        <Box display="flex" gap="12px">
            <SideBar width="160px">
                <Button
                    disabled={currentTab === 0}
                    justifyContent="flex-start"
                    bg={theme.colors.main.secondary}
                    onClick={() => setCurrentTab(0)}
                >
                    <Settings />
                    Application
                </Button>

                <Button
                    disabled={currentTab === 1}
                    justifyContent="flex-start"
                    bg={theme.colors.main.secondary}
                    onClick={() => setCurrentTab(1)}
                >
                    <Settings2 />
                    Online Settings
                </Button>

                <Button
                    disabled={currentTab === 2}
                    justifyContent="flex-start"
                    bg={theme.colors.main.secondary}
                    onClick={() => setCurrentTab(2)}
                >
                    <AlertCircle />
                    Danger
                </Button>
            </SideBar>
            <Stack flex="1" maxWidth={'600px'}>
                {currentTab === 0 && (
                    <Box>
                        <Heading flex="0" size="md" color={theme.colors.main.textSubdued}>
                            Application Settings
                        </Heading>
                        <Stack>
                            <Button
                                bg={theme.colors.main.actionSecondary}
                                onClick={() => {
                                    window.api.openEmulatorFolder()
                                }}
                            >
                                Open Rom Folder
                            </Button>
                            <Text textStyle="md" color={theme.colors.main.text}>
                                Sound Settings
                            </Text>
                            <Button
                                // Also terrible logic that we should fix
                                bg={
                                    configState?.appSoundOn === 'true' ||
                                    configState?.appSoundOn === undefined
                                        ? theme.colors.main.success
                                        : theme.colors.main.warning
                                }
                                onClick={() => {
                                    const value =
                                        configState?.appSoundOn === 'true' ||
                                        configState?.appSoundOn === undefined
                                            ? 'false'
                                            : 'true'
                                    try {
                                        window.api.setConfigValue('appSoundOn', value)
                                        updateConfigState({ appSoundOn: value })
                                    } catch (error) {
                                        toaster.error({
                                            title: 'Error',
                                        })
                                    }
                                }}
                            >
                                {configState?.appSoundOn === 'true' ||
                                configState?.appSoundOn === undefined ? (
                                    <Volume2 />
                                ) : (
                                    <VolumeX />
                                )}
                            </Button>
                            <Text textStyle="xs" color={theme.colors.main.textMedium}>
                                Sound:{' '}
                                {configState?.appSoundOn === 'true' ||
                                configState?.appSoundOn === undefined
                                    ? 'On'
                                    : 'Off'}
                            </Text>
                            <Text textStyle="md" color={theme.colors.main.text}>
                                Theme
                            </Text>
                            <SelectRoot
                                key="theme-select"
                                color={theme.colors.main.actionSecondary}
                                collection={themes}
                                value={[currentTheme]}
                                onValueChange={(e) => {
                                    handleSetTheme(e.value[0])
                                    window.api.setAppTheme(e.value[0])
                                    toaster.success({
                                        title: 'Theme Changed',
                                    })
                                }}
                            >
                                <SelectTrigger>
                                    <SelectValueText placeholder="Select Theme" />
                                </SelectTrigger>
                                <SelectContent>
                                    {themes.items.map((theme) => (
                                        <SelectItem item={theme} key={theme.value}>
                                            {theme.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </SelectRoot>
                        </Stack>
                    </Box>
                )}
                {currentTab === 1 && (
                    <Box>
                        <Heading flex="0" size="md" color={theme.colors.main.textSubdued}>
                            Online Settings
                        </Heading>
                        <Stack>
                            <Text textStyle="xs" color={theme.colors.main.textMedium}>
                                Online Delay
                            </Text>
                            <SelectRoot
                                color={theme.colors.main.actionSecondary}
                                collection={delays}
                                value={[currentDelay]}
                                onValueChange={(e) => {
                                    handleSetDelay(e.value[0])
                                    window.api.setEmulatorDelay(e.value[0])
                                    toaster.success({
                                        title: 'Delay Set',
                                        description: `Successfully Set Delay to: ${e.value[0]}`,
                                    })
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
                            <Text textStyle="xs" color={theme.colors.main.textMedium}>
                                Current delay: {currentDelay}
                            </Text>
                        </Stack>
                    </Box>
                )}
                {currentTab === 2 && isLoggedIn && (
                    <Box>
                        <Heading flex="0" size="md" color={theme.colors.main.textSubdued}>
                            Danger Settings
                        </Heading>
                        <Stack>
                            <Text textStyle="xs" color={theme.colors.main.textMedium}>
                                Current Path: {currentEmuPath}
                            </Text>
                            <Button
                                bg={theme.colors.main.actionSecondary}
                                onClick={() => {
                                    try {
                                        window.api.setEmulatorPath(true)
                                    } catch (error) {
                                        toaster.error({
                                            title: 'Error',
                                            description: 'Failed to reset or use path.',
                                        })
                                    }
                                }}
                            >
                                Use Default Emulator
                            </Button>
                            <Text textStyle="xs" color={theme.colors.main.warning}>
                                Not recommended
                            </Text>
                            <Button
                                bg={theme.colors.main.warning}
                                onClick={() => {
                                    try {
                                        window.api.setEmulatorPath()
                                    } catch (error) {
                                        toaster.error({
                                            title: 'Error',
                                            description: 'Failed to update path.',
                                        })
                                    }
                                }}
                            >
                                Set Custom Emulator Path
                            </Button>
                            <Text textStyle="xs" color={theme.colors.main.textMedium}>
                                Log out user, this will also make it so you do not automaitcally log
                                in on start next time.
                            </Text>

                            <Button
                                colorPalette="red"
                                onClick={() => {
                                    window.api.logOutUser()
                                }}
                            >
                                Log Out
                            </Button>
                        </Stack>
                    </Box>
                )}
            </Stack>
        </Box>
    )
}
