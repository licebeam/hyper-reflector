import { useEffect, useState } from 'react'
import { Button, Flex, Stack, Tabs } from '@chakra-ui/react'
import { Link, useNavigate } from '@tanstack/react-router'
import { useLoginStore, useMessageStore } from '../state/store'

export default function Layout({ children }) {
    const [currentTab, setCurrentTab] = useState<string>('login')
    const [isLoading, setIsLoading] = useState(false)
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)
    const userState = useLoginStore((state) => state.userState)
    const setUserState = useLoginStore((state) => state.setUserState)
    const loggedOut = useLoginStore((state) => state.loggedOut)
    const clearMessageState = useMessageStore((state) => state.clearMessageState)
    const clearUserList = useMessageStore((state) => state.clearUserList)

    const navigate = useNavigate()

    useEffect(() => {
        window.api.on('loggedOutSuccess', (event) => {
            console.log('===============================log out reset state')
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
        console.log('----------------------------------------------', currentTab)
    }, [isLoggedIn])

    return (
        <Stack minH={'100vh'} justifyContent={'space-between'}>
            <Flex>
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
                {isLoggedIn && (
                    <Button
                        alignSelf="center"
                        disabled={isLoading}
                        onClick={() => {
                            console.log('trying to log out')
                            setIsLoading(true)
                            window.api.logOutUser()
                        }}
                    >
                        Log Out
                    </Button>
                )}
            </Flex>
            <Stack flex={'auto'}>{children}</Stack>
            <Flex alignSelf={'flex-end'}>Hyper Reflector version 0.1.2a 2025</Flex>
        </Stack>
    )
}
