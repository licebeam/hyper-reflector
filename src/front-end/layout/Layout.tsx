import { useEffect, useState } from 'react'
import { Flex, Stack, Tabs, Box, Text } from '@chakra-ui/react'
import { useNavigate } from '@tanstack/react-router'
import { useLayoutStore, useLoginStore, useMessageStore } from '../state/store'

export default function Layout({ children }) {
    const [isLoading, setIsLoading] = useState(false)
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)
    const setUserState = useLoginStore((state) => state.setUserState)
    const user = useLoginStore((state) => state.userState)
    const loggedOut = useLoginStore((state) => state.loggedOut)
    const clearMessageState = useMessageStore((state) => state.clearMessageState)
    const clearUserList = useMessageStore((state) => state.clearUserList)
    const layoutTab = useLayoutStore((state) => state.selectedTab)
    const setLayoutTab = useLayoutStore((state) => state.setSelectedTab)

    const navigate = useNavigate()

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

    return (
        <Stack minH="100vh" height="100vh">
            <Box
                h="60px"
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                bg="gray.700"
                px="4"
                flexShrink={0}
            >
                <Tabs.Root variant="enclosed" value={layoutTab}>
                    <Tabs.List bg="gray.700" rounded="l3" p="1">
                        {!isLoggedIn && (
                            <Tabs.Trigger
                                _selected={{ bg: 'red.500' }}
                                color="gray.100"
                                value="login"
                                onClick={() => {
                                    navigate({ to: '/' })
                                    setLayoutTab('login')
                                }}
                            >
                                Sign In
                            </Tabs.Trigger>
                        )}
                        <Tabs.Trigger
                            _selected={{ bg: 'red.500' }}
                            color="gray.100"
                            value="news"
                            onClick={() => {
                                navigate({ to: '/news' })
                                setLayoutTab('news')
                            }}
                        >
                            News
                        </Tabs.Trigger>
                        {isLoggedIn && (
                            <>
                                <Tabs.Trigger
                                    _selected={{ bg: 'red.500' }}
                                    color="gray.100"
                                    value="chat"
                                    onClick={() => {
                                        navigate({ to: '/chat' })
                                        setLayoutTab('chat')
                                    }}
                                >
                                    Chat
                                </Tabs.Trigger>
                                <Tabs.Trigger
                                    _selected={{ bg: 'red.500' }}
                                    color="gray.100"
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
                            _selected={{ bg: 'red.500' }}
                            color="gray.100"
                            value="offline"
                            onClick={() => {
                                navigate({ to: '/offline' })
                                setLayoutTab('offline')
                            }}
                        >
                            Play Offline
                        </Tabs.Trigger>
                        <Tabs.Trigger
                            _selected={{ bg: 'red.500' }}
                            color="gray.100"
                            value="settings"
                            onClick={() => {
                                navigate({ to: '/settings' })
                                setLayoutTab('settings')
                            }}
                        >
                            Settings
                        </Tabs.Trigger>
                        <Tabs.Indicator rounded="l2" />
                    </Tabs.List>
                </Tabs.Root>
            </Box>
            <Box flex="1" display="flex" flexDirection="column" height="calc(100vh - 120px)">
                <Box flex="1" overflowY="auto" p="4">
                    {children}
                </Box>
            </Box>
            <Box
                h="40px"
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                bg="gray.700"
                px="4"
                flexShrink={0}
            >
                <Text textStyle="xs" color="red.400">
                    https://discord.gg/T77dSXG7Re
                </Text>
                <Text textStyle="xs" color="red.400">
                    Hyper Reflector version 0.2.0a 2025
                </Text>
            </Box>
        </Stack>
    )
}
