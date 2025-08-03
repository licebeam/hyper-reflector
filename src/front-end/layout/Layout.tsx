import { useEffect, useState } from 'react'
import { Stack, Tabs, Box, Text, Image, Button } from '@chakra-ui/react'
import { useNavigate } from '@tanstack/react-router'
import { toaster } from '../components/chakra/ui/toaster'
import { useConfigStore, useLayoutStore, useLoginStore, useMessageStore } from '../state/store'
import { Bell, BellOff, Settings } from 'lucide-react'
import { getThemeNameList } from '../utils/theme'
import bgImage from './bgImage.svg'
import hrLogo from './logo.svg'

import soundBase64Data from '../components/sound/challenge.wav'

export default function Layout({ children }) {
    const audioEffect = new Audio(soundBase64Data) // this line for renderer process only
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)
    const setUserState = useLoginStore((state) => state.setUserState)
    const user = useLoginStore((state) => state.userState)
    const loggedOut = useLoginStore((state) => state.loggedOut)
    const messageState = useMessageStore((state) => state.messageState)
    const clearMessageState = useMessageStore((state) => state.clearMessageState)
    const updateMessage = useMessageStore((state) => state.updateMessage)
    const callData = useMessageStore((state) => state.callData)
    const removeCallData = useMessageStore((state) => state.removeCallData)
    const clearUserList = useMessageStore((state) => state.clearUserList)
    const layoutTab = useLayoutStore((state) => state.selectedTab)
    const setLayoutTab = useLayoutStore((state) => state.setSelectedTab)
    const configState = useConfigStore((state) => state.configState)
    const updateConfigState = useConfigStore((state) => state.updateConfigState)
    const theme = useLayoutStore((state) => state.appTheme)
    const setTheme = useLayoutStore((state) => state.setTheme)
    const [isLoading, setIsLoading] = useState(false)

    const navigate = useNavigate()

    // useEffect(() => {
    //     console.log('state update  -------------------------------', configState)
    // }, [configState])

    // Initially set the theme when loaded
    useEffect(() => {
        window.api.getConfigValue('appSoundOn')
        window.api.getConfigValue('isAway')
        window.api.removeExtraListeners('appTheme', handleSetTheme)
        window.api.on('appTheme', handleSetTheme)

        return () => {
            window.api.removeListener('appTheme', handleSetTheme)
        }
    }, [])

    const handleSetTheme = (themeIndex: string) => {
        const themeToSet = getThemeNameList()[parseInt(themeIndex)]
        setTheme(themeToSet)
    }
    // - end

    useEffect(() => {
        window.api.on('loggedOutSuccess', (event) => {
            clearUserList()
            clearMessageState()
            setUserState({ email: '' })
            loggedOut()
            setIsLoading(false)
            navigate({ to: '/' })
            // handle do some funky stateful call for logging in redirect etc
        })
        window.api.getAppTheme()
    }, [])

    useEffect(() => {
        if (isLoggedIn) {
            // user logged in
            setLayoutTab('chat')
        } else {
            // user logged out
            setLayoutTab('login')
        }
    }, [isLoggedIn])

    const handleAlertFromMain = (alertData) => {
        toaster.error({
            title: alertData?.message?.title,
            description: alertData?.message?.description,
        })
    }

    const handleSetConfigState = (data: { key: string; value: string | boolean | number }) => {
        const { key, value } = data
        updateConfigState({
            [key]: value,
        })
    }

    const handleCallDeclined = (fromUID) => {
        const callToRemove = callData.find((call) => call.callerId === fromUID)
        removeCallData(callToRemove)
        const messageState = useMessageStore.getState().messageState
        messageState.forEach((m) => {
            if (m?.fromMe && m?.challengedUID === fromUID && !m?.declined) {
                const updatedMessage = {
                    ...m,
                    declined: true,
                }
                updateMessage(updatedMessage)
            }
        })
    }

    useEffect(() => {
        window.api.removeAllListeners('callDeclined', handleCallDeclined)
        window.api.on('callDeclined', handleCallDeclined)
        window.api.removeExtraListeners('getConfigValue', handleSetConfigState)
        window.api.on('getConfigValue', handleSetConfigState)
        window.api.removeExtraListeners('sendAlert', handleAlertFromMain)
        window.api.on('sendAlert', handleAlertFromMain)

        return () => {
            window.api.removeListener('callDeclined', handleCallDeclined)
            window.api.removeListener('getConfigValue', handleSetConfigState)
            window.api.removeListener('sendAlert', handleAlertFromMain)
        }
    }, [])

    // update chats
    const handleChallengeQueue = (messageObject) => {
        const currentConfig = useConfigStore.getState().configState
        if (messageObject.type === 'challenge') {
            if (currentConfig?.appSoundOn === 'true') {
                audioEffect.play()
            }
        }
    }

    // get message from websockets
    useEffect(() => {
        window.api.removeAllListeners('getChallengeQueue', handleChallengeQueue)
        window.api.on('getChallengeQueue', handleChallengeQueue)

        return () => {
            window.api.removeListener('getChallengeQueue', handleChallengeQueue)
        }
    }, [])

    return (
        <Stack
            minH="100vh"
            height="100vh"
            bg={theme.colors.main.bg}
            bgImage={`url(${bgImage})`}
            bgBlendMode={'color-dodge'}
        >
            <Box
                h="60px"
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                bg={theme.colors.main.secondary}
                px="4"
                flexShrink={0}
            >
                <Image src={hrLogo} height={'80px'} />
                <Tabs.Root variant="enclosed" value={layoutTab} width="100%">
                    <Tabs.List bg={theme.colors.main.secondary} rounded="l3" minW="100%">
                        <Box display={'flex'} width="100%">
                            {!isLoggedIn && (
                                <Tabs.Trigger
                                    width={'100px'}
                                    _selected={{ bg: theme.colors.main.action }}
                                    color={theme.colors.main.text}
                                    value="login"
                                    onClick={() => {
                                        navigate({ to: '/' })
                                        setLayoutTab('login')
                                    }}
                                >
                                    Sign In
                                </Tabs.Trigger>
                            )}
                            {isLoggedIn && (
                                <>
                                    <Tabs.Trigger
                                        width={'100px'}
                                        _selected={{ bgColor: theme.colors.main.action }}
                                        color={theme.colors.main.text}
                                        value="news"
                                        onClick={() => {
                                            navigate({ to: '/news' })
                                            setLayoutTab('news')
                                        }}
                                    >
                                        Home
                                    </Tabs.Trigger>
                                    <Tabs.Trigger
                                        width={'100px'}
                                        _selected={{ bgColor: theme.colors.main.action }}
                                        color={theme.colors.main.text}
                                        value="chat"
                                        onClick={() => {
                                            navigate({ to: '/chat' })
                                            setLayoutTab('chat')
                                        }}
                                    >
                                        Lobby
                                    </Tabs.Trigger>
                                    <Tabs.Trigger
                                        width={'100px'}
                                        _selected={{ bg: theme.colors.main.action }}
                                        color={theme.colors.main.text}
                                        value="profile"
                                        onClick={() => {
                                            navigate({ to: `/profile/${user.uid}` })
                                            setLayoutTab('profile')
                                        }}
                                    >
                                        Profile
                                    </Tabs.Trigger>
                                </>
                            )}
                            <Tabs.Trigger
                                width={'100px'}
                                _selected={{ bg: theme.colors.main.action }}
                                color={theme.colors.main.text}
                                value="offline"
                                onClick={() => {
                                    navigate({ to: '/offline' })
                                    setLayoutTab('offline')
                                }}
                            >
                                Offline
                            </Tabs.Trigger>
                            <Tabs.Indicator rounded="l2" bgColor={theme.colors.main.action} />
                            <Box
                                gap={'20px'}
                                width="100%"
                                display={'flex'}
                                alignItems="center"
                                justifyContent={'right'}
                            >
                                <Button
                                    bg="none"
                                    width={'60px'}
                                    color={
                                        configState?.isAway === 'true'
                                            ? theme.colors.main.away
                                            : theme.colors.main.active
                                    }
                                    cursor={'pointer'}
                                    onClick={() => {
                                        // This is terrible logic, lets fix this
                                        const value =
                                            configState?.isAway === 'true' ? 'false' : 'true'
                                        try {
                                            window.api.setConfigValue('isAway', value)
                                            updateConfigState({ isAway: value })
                                        } catch (error) {
                                            toaster.error({
                                                title: 'Error',
                                            })
                                        }
                                    }}
                                >
                                    {configState?.isAway === 'false' ||
                                    configState?.isAway === undefined ? (
                                        <Bell />
                                    ) : (
                                        <BellOff />
                                    )}
                                </Button>
                                <Tabs.Trigger
                                    justifySelf="end"
                                    width="40px"
                                    value="settings"
                                    _selected={{ bg: theme.colors.main.action }}
                                    color={theme.colors.main.text}
                                    onClick={() => {
                                        navigate({ to: '/settings' })
                                        setLayoutTab('settings')
                                    }}
                                >
                                    <Box width={'80px'}>
                                        <Settings />
                                    </Box>
                                </Tabs.Trigger>
                            </Box>
                        </Box>
                    </Tabs.List>
                </Tabs.Root>
            </Box>
            <Box flex="1" display="flex" flexDirection="column" height="calc(100vh - 120px)">
                <Box flex="1" overflowY="auto" p="4" scrollbarWidth={'thin'}>
                    {children}
                </Box>
            </Box>
            <Box
                h="40px"
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                bg={theme.colors.main.secondary}
                px="4"
                flexShrink={0}
            >
                <Box display="flex" gap="8px">
                    <a href="https://hyper-reflector.com/" target="_blank" rel="noreferrer">
                        <Text textStyle="xs" color={theme.colors.main.action}>
                            Hyper Reflector on:
                        </Text>
                    </a>
                    <a href="https://discord.gg/fsQEVzXwbt" target="_blank" rel="noreferrer">
                        <Text textStyle="xs" color={theme.colors.main.action}>
                            Discord
                        </Text>
                    </a>
                    <a
                        href="https://github.com/Hyper-Reflector-Team"
                        target="_blank"
                        rel="noreferrer"
                    >
                        <Text textStyle="xs" color={theme.colors.main.action}>
                            Github
                        </Text>
                    </a>
                </Box>

                <Text textStyle="xs" color={theme.colors.main.action}>
                    Hyper Reflector version 0.4.0a 2025
                </Text>
            </Box>
        </Stack>
    )
}
