import { useNavigate } from '@tanstack/react-router'
import { useTranslation } from 'react-i18next'
import {
    Stack,
    Button,
    Switch,
    Card,
    Select,
    Portal,
    createListCollection,
    Box,
    IconButton,
    Text,
} from '@chakra-ui/react'
import { logout } from '../utils/firebase'
import { useColorMode } from '../components/chakra/ui/color-mode'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { useSettingsStore } from '../state/store'
import { Check, Moon, Play, Square, Sun, Volume2, VolumeX, X, LogOut } from 'lucide-react'
import { toaster } from '../components/chakra/ui/toaster'
import { useTauriSoundPlayer } from '../utils/useTauriSoundPlayer'

const MARGIN_SECTION = '12px'

export default function SettingsPage() {
    const { i18n, t } = useTranslation()
    const navigate = useNavigate()
    const { toggleColorMode } = useColorMode()
    const ggpoDelay = useSettingsStore((s) => s.ggpoDelay)
    const setGgpoDelay = useSettingsStore((s) => s.setGgpoDelay)
    const notifChallengeSound = useSettingsStore((s) => s.notifChallengeSound)
    const setNotifChallengeSound = useSettingsStore((s) => s.setNotifChallengeSound)
    const notifChallengeSoundPath = useSettingsStore((s) => s.notifChallengeSoundPath)
    const setNotifChallengeSoundPath = useSettingsStore((s) => s.setNotifChallengeSoundPath)
    const notifiAtSound = useSettingsStore((s) => s.notifiAtSound)
    const setNotifAtSound = useSettingsStore((s) => s.setNotifAtSound)
    const notifAtSoundPath = useSettingsStore((s) => s.notifAtSoundPath)
    const setNotifAtSoundPath = useSettingsStore((s) => s.setNotifAtSoundPath)
    const darkMode = useSettingsStore((s) => s.darkMode)
    const setDarkMode = useSettingsStore((s) => s.setDarkMode)
    const theme = useSettingsStore((s) => s.theme)
    const setTheme = useSettingsStore((s) => s.setTheme)
    const setEmulatorPath = useSettingsStore((s) => s.setEmulatorPath)
    const emulatorPath = useSettingsStore((s) => s.emulatorPath)
    const setAppLanguage = useSettingsStore((s) => s.setAppLanguage)
    const appLanguage = useSettingsStore((s) => s.appLanguage)
    const { playSound: playSoundFile } = useTauriSoundPlayer()

    const themes = createListCollection({
        items: [
            {
                label: 'Orange Soda',
                value: 'Orange Soda',
                data: { colorPalette: 'orange', name: 'Orange Soda' },
            },
            {
                label: 'Grape Soda',
                value: 'Grape Soda',
                data: { colorPalette: 'purple', name: 'Grape Soda' },
            },
        ],
    })

    const delays = createListCollection({
        items: [
            { label: '0', value: '0' },
            { label: '1', value: '1' },
            { label: '2', value: '2' },
            { label: '3', value: '3' },
            { label: '4', value: '4' },
            { label: '5', value: '5' },
            { label: '6', value: '6' },
            { label: '7', value: '7' },
        ],
    })

    const languages = createListCollection({
        items: [
            { label: t('Settings.Language.en'), value: 'en' },
            { label: t('Settings.Language.ja'), value: 'ja' },
        ],
    })

    const pickSoundFile = async (type: string) => {
        try {
            const res = await open({
                multiple: false,
                directory: false,
                title: 'Select a sound file to use',
                filters: [{ name: 'Audio', extensions: ['mp3', 'wav'] }],
            })
            if (type === 'challenge') {
                if (typeof res === 'string') {
                    setNotifChallengeSoundPath(res)
                }
            }
            if (type === 'at') {
                if (typeof res === 'string') setNotifAtSoundPath(res)
            }
        } catch (err: any) {
            toaster.error({
                title: 'Error Opening Dialog',
                description: err,
            })
        }
    }

    const pickExe = async () => {
        try {
            const res = await open({
                multiple: false,
                directory: false,
                title: 'Select Emulator Executable',
                filters: [{ name: 'Executables', extensions: ['exe'] }],
            })
            if (typeof res === 'string') setEmulatorPath(res)
        } catch (err: any) {
            toaster.error({
                title: 'Error Opening Dialog',
                description: err,
            })
        }
    }

    const handleResetAllSettings = async () => {
        try {
            const storeWithPersist = useSettingsStore as typeof useSettingsStore & {
                persist?: {
                    clearStorage?: () => Promise<void> | void
                }
            }
            await storeWithPersist.persist?.clearStorage?.()
            window.location.reload()
        } catch (error) {
            toaster.error({
                title: 'Failed to reset settings',
                description:
                    error instanceof Error ? error.message : 'Unknown error clearing saved settings.',
            })
        }
    }

    const playSound = async (type: string) => {
        if (type === 'challenge') {
            await playSoundFile(notifChallengeSoundPath)
        }
        if (type === 'at') {
            await playSoundFile(notifAtSoundPath)
        }
    }

    const pauseSound = async () => {
        await invoke('stop_sound')
    }

    const changeRoute = (route: string) => {
        navigate({ to: route })
    }

    async function logoutHelper() {
        logout()
        changeRoute('/')
    }

    return (
        <Stack>
            <Card.Root flex={'1'} overflow="hidden">
                <Card.Body gap="2">
                    <Card.Title>{t('Settings.GGPO.title')}</Card.Title>
                    <Card.Description>{t('Settings.GGPO.desc')}</Card.Description>
                    <Select.Root
                        colorPalette={theme.colorPalette}
                        marginTop={MARGIN_SECTION}
                        maxW="1/2"
                        key={'test'}
                        variant={'outline'}
                        collection={delays}
                        value={[ggpoDelay]}
                        onValueChange={(e) => setGgpoDelay(e.value[0])}
                    >
                        <Select.HiddenSelect />
                        <Select.Label>{t('Settings.GGPO.label')}</Select.Label>
                        <Select.Control>
                            <Select.Trigger>
                                <Select.ValueText placeholder={t('Settings.GGPO.placeholder')} />
                            </Select.Trigger>
                            <Select.IndicatorGroup>
                                <Select.Indicator />
                            </Select.IndicatorGroup>
                        </Select.Control>
                        <Portal>
                            <Select.Positioner>
                                <Select.Content>
                                    {delays.items.map((d) => (
                                        <Select.Item item={d} key={d.value}>
                                            {d.label}
                                            <Select.ItemIndicator />
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Positioner>
                        </Portal>
                    </Select.Root>
                </Card.Body>
            </Card.Root>
            <Card.Root flex={'1'} overflow="hidden">
                <Card.Body gap="2">
                    <Card.Title>{t('Settings.Language.title')}</Card.Title>
                    <Select.Root
                        colorPalette={theme.colorPalette}
                        marginTop={MARGIN_SECTION}
                        maxW="1/2"
                        key={'test'}
                        variant={'outline'}
                        collection={languages}
                        value={[appLanguage]}
                        onValueChange={(e) => {
                            setAppLanguage(e.value[0])
                            i18n.changeLanguage(e.value[0])
                        }}
                    >
                        <Select.HiddenSelect />
                        <Select.Control>
                            <Select.Trigger>
                                <Select.ValueText
                                    placeholder={t('Settings.Language.placeholder')}
                                />
                            </Select.Trigger>
                            <Select.IndicatorGroup>
                                <Select.Indicator />
                            </Select.IndicatorGroup>
                        </Select.Control>
                        <Portal>
                            <Select.Positioner>
                                <Select.Content>
                                    {languages.items.map((d) => (
                                        <Select.Item item={d} key={d.value}>
                                            {d.label}
                                            <Select.ItemIndicator />
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Positioner>
                        </Portal>
                    </Select.Root>
                </Card.Body>
            </Card.Root>
            <Card.Root flex={'1'} overflow="hidden">
                <Card.Body gap="2">
                    <Card.Title>{t('Settings.Notification.title')}</Card.Title>
                    <Card.Description>{t('Settings.Notification.desc')}</Card.Description>
                    <Switch.Root
                        colorPalette={theme.colorPalette}
                        marginTop={MARGIN_SECTION}
                        size="lg"
                        checked={notifChallengeSound}
                        onCheckedChange={(e) => setNotifChallengeSound(e.checked)}
                    >
                        <Switch.HiddenInput />
                        <Switch.Control>
                            <Switch.Thumb>
                                <Switch.ThumbIndicator fallback={<X color="black" />}>
                                    <Check />
                                </Switch.ThumbIndicator>
                            </Switch.Thumb>
                        </Switch.Control>
                        {notifChallengeSound ? <Volume2 /> : <VolumeX />}
                        <Switch.Label>{t('Settings.Notification.challengeSound')}</Switch.Label>
                    </Switch.Root>
                    <Stack>
                        <Text textStyle="xs">{notifChallengeSoundPath}</Text>
                        <Box gap="2" display={'flex'}>
                            <Button
                                colorPalette={theme.colorPalette}
                                maxW="1/2"
                                onClick={() => pickSoundFile('challenge')}
                            >
                                {t('Settings.Notification.setCustomChallenge')}
                            </Button>
                            <IconButton
                                colorPalette={theme.colorPalette}
                                colorScheme="blue"
                                onClick={() => {
                                    playSound('challenge')
                                }}
                            >
                                <Play />
                            </IconButton>
                            <IconButton
                                colorPalette={theme.colorPalette}
                                colorScheme="blue"
                                onClick={() => {
                                    pauseSound()
                                }}
                            >
                                <Square />
                            </IconButton>
                        </Box>
                    </Stack>
                    <Switch.Root
                        colorPalette={theme.colorPalette}
                        marginTop={MARGIN_SECTION}
                        size="lg"
                        checked={notifiAtSound}
                        onCheckedChange={(e) => setNotifAtSound(e.checked)}
                    >
                        <Switch.HiddenInput />
                        <Switch.Control>
                            <Switch.Thumb>
                                <Switch.ThumbIndicator fallback={<X color="black" />}>
                                    <Check />
                                </Switch.ThumbIndicator>
                            </Switch.Thumb>
                        </Switch.Control>
                        {notifiAtSound ? <Volume2 /> : <VolumeX />}
                        <Switch.Label>{t('Settings.Notification.messageSound')}</Switch.Label>
                    </Switch.Root>
                    <Stack>
                        <Text textStyle="xs">{notifAtSoundPath}</Text>
                        <Box gap="2" display={'flex'}>
                            <Button
                                colorPalette={theme.colorPalette}
                                maxW="1/2"
                                onClick={() => pickSoundFile('at')}
                            >
                                {t('Settings.Notification.setCustomMessage')}
                            </Button>
                            <IconButton
                                colorPalette={theme.colorPalette}
                                colorScheme="blue"
                                onClick={() => {
                                    playSound('at')
                                }}
                            >
                                <Play />
                            </IconButton>
                            <IconButton
                                colorPalette={theme.colorPalette}
                                colorScheme="blue"
                                onClick={() => {
                                    pauseSound()
                                }}
                            >
                                <Square />
                            </IconButton>
                        </Box>
                    </Stack>
                </Card.Body>
            </Card.Root>
            <Card.Root overflow="hidden" flex={'1'}>
                <Card.Body gap="2">
                    <Card.Title>{t('Settings.Theme.title')}</Card.Title>
                    <Card.Description>{t('Settings.Theme.desc')}</Card.Description>
                    <Switch.Root
                        colorPalette={theme.colorPalette}
                        marginTop={MARGIN_SECTION}
                        maxW="1/2"
                        size="lg"
                        checked={darkMode}
                        onCheckedChange={(e) => {
                            setDarkMode(e.checked)
                            // This delay prevents a weird animation issue
                            setTimeout(() => {
                                toggleColorMode()
                            }, 100)
                        }}
                    >
                        <Switch.HiddenInput />
                        <Switch.Control>
                            <Switch.Thumb>
                                <Switch.ThumbIndicator fallback={<Moon color="black" />}>
                                    <Sun />
                                </Switch.ThumbIndicator>
                            </Switch.Thumb>
                        </Switch.Control>
                        <Switch.Label>{t('Settings.Theme.darkMode')}</Switch.Label>
                    </Switch.Root>
                    <Select.Root
                        colorPalette={theme.colorPalette}
                        marginTop={MARGIN_SECTION}
                        maxW="1/2"
                        key={'test'}
                        variant={'outline'}
                        collection={themes}
                        value={[theme.name]}
                        onValueChange={(e) => {
                            setTheme(e.items[0].data)
                        }}
                    >
                        <Select.HiddenSelect />
                        <Select.Label>{t('Settings.Theme.select')}</Select.Label>
                        <Select.Control>
                            <Select.Trigger>
                                <Select.ValueText placeholder={t('Settings.Theme.select')} />
                            </Select.Trigger>
                            <Select.IndicatorGroup>
                                <Select.Indicator />
                            </Select.IndicatorGroup>
                        </Select.Control>
                        <Portal>
                            <Select.Positioner>
                                <Select.Content>
                                    {themes.items.map((t) => (
                                        <Select.Item item={t} key={t.value}>
                                            {t.label}
                                            <Select.ItemIndicator />
                                        </Select.Item>
                                    ))}
                                </Select.Content>
                            </Select.Positioner>
                        </Portal>
                    </Select.Root>
                </Card.Body>
            </Card.Root>
            <Card.Root overflow="hidden" flex={'1'}>
                <Card.Body gap="2">
                    <Card.Title>{t('Settings.Emu.title')}</Card.Title>
                    <Card.Description>{t('Settings.Emu.desc')}</Card.Description>
                    <Text textStyle="xs">{emulatorPath}</Text>
                    <Button
                        colorPalette={'red'}
                        marginTop={MARGIN_SECTION}
                        maxW="1/2"
                        onClick={pickExe}
                    >
                        {t('Settings.Emu.setEmuPath')}
                    </Button>
                </Card.Body>
            </Card.Root>
            <Card.Root overflow="hidden" flex={'1'}>
                <Card.Body gap="2">
                    <Card.Title>{t('Settings.Danger.title')}</Card.Title>
                    <Card.Description></Card.Description>
                    <Button
                        colorPalette={'red'}
                        marginTop={MARGIN_SECTION}
                        maxW="1/2"
                        onClick={handleResetAllSettings}
                    >
                        {t('Settings.Danger.reset')}
                    </Button>
                    <Text textStyle="xs">{t('Settings.Danger.logOut')}</Text>
                    <IconButton
                        colorPalette={'red'}
                        width={'40px'}
                        height={'40px'}
                        onClick={logoutHelper}
                        aria-label={t('Settings.Danger.logOut')}
                    >
                        <LogOut />
                    </IconButton>
                </Card.Body>
            </Card.Root>
        </Stack>
    )
}
