import { useEffect, useState } from 'react'
import { Flex, Stack, Tabs, Box } from '@chakra-ui/react'
import { useNavigate } from '@tanstack/react-router'
import { useLoginStore, useMessageStore } from '../state/store'

export default function Layout({ children }) {
    const [currentTab, setCurrentTab] = useState<string>('login')
    const [isLoading, setIsLoading] = useState(false)
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)
    const setUserState = useLoginStore((state) => state.setUserState)
    const loggedOut = useLoginStore((state) => state.loggedOut)
    const clearMessageState = useMessageStore((state) => state.clearMessageState)
    const clearUserList = useMessageStore((state) => state.clearUserList)

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
            setCurrentTab('chat')
        } else {
            // user logged out
            setCurrentTab('login')
        }
    }, [isLoggedIn])

    return (
        <Stack minH="100vh" height="100vh">
            <Box
                h="60px"
                display="flex"
                justifyContent="space-between"
                alignItems="center"
                bg="gray.200"
                px="4"
                flexShrink={0}
            >
                <Tabs.Root variant="plain" value={currentTab}>
                    <Tabs.List bg="bg.muted" rounded="l3" p="1">
                        {!isLoggedIn && (
                            <Tabs.Trigger
                                value="login"
                                onClick={() => {
                                    navigate({ to: '/' })
                                    setCurrentTab('login')
                                }}
                            >
                                Sign In
                            </Tabs.Trigger>
                        )}
                        <Tabs.Trigger
                            value="news"
                            onClick={() => {
                                navigate({ to: '/news' })
                                setCurrentTab('news')
                            }}
                        >
                            News
                        </Tabs.Trigger>
                        {isLoggedIn && (
                            <>
                                <Tabs.Trigger
                                    value="chat"
                                    onClick={() => {
                                        navigate({ to: '/chat' })
                                        setCurrentTab('chat')
                                    }}
                                >
                                    Chat
                                </Tabs.Trigger>
                                <Tabs.Trigger
                                    value="profile"
                                    onClick={() => {
                                        navigate({ to: '/profile' })
                                        setCurrentTab('profile')
                                    }}
                                >
                                    Profile
                                </Tabs.Trigger>
                            </>
                        )}
                        <Tabs.Trigger
                            value="offline"
                            onClick={() => {
                                navigate({ to: '/offline' })
                                setCurrentTab('offline')
                            }}
                        >
                            Play Offline
                        </Tabs.Trigger>
                        <Tabs.Trigger
                            value="settings"
                            onClick={() => {
                                navigate({ to: '/settings' })
                                setCurrentTab('settings')
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
                bg="gray.200"
                px="4"
                flexShrink={0}
            >
                <div style={{ fontSize: '0.8rem' }}>https://discord.gg/T77dSXG7Re</div>
                <div style={{ fontSize: '0.8rem' }}>Hyper Reflector version 0.1.9a 2025</div>
            </Box>
        </Stack>
    )
}
