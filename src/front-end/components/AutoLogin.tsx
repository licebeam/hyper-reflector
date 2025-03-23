import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useLoginStore, useMessageStore } from '../state/store'
import { Stack, Box, Center, Spinner, Text } from '@chakra-ui/react'

export default function Autologin() {
    const [isLoading, setIsLoading] = useState(true)
    const failedLogin = useLoginStore((state) => state.failedLogin)
    const successLogin = useLoginStore((state) => state.successLogin)
    const setUserState = useLoginStore((state) => state.setUserState)
    const addUser = useMessageStore((state) => state.pushUser)
    const clearUserList = useMessageStore((state) => state.clearUserList)

    const navigate = useNavigate()

    const handleIsLoggingIn = () => {
        setIsLoading(true)
    }

    const handleAutoLoginFail = () => {
        console.log('auto log failed')
        navigate({ to: '/' })
    }

    const handleLogIn = (loginInfo) => {
        setUserState(loginInfo)
        addUser(loginInfo)
        successLogin()
        setIsLoading(false)
        navigate({ to: '/chat' })
        // handle do some funky stateful call for logging in redirect etc
    }

    const handleLoginFail = (event) => {
        setIsLoading(false)
        clearUserList()
        failedLogin()
        navigate({ to: '/' })
    }

    useEffect(() => {
        // Listen for updates from Electron
        window.api.removeExtraListeners('autoLoggingIn', handleIsLoggingIn)
        window.api.on('autoLoggingIn', handleIsLoggingIn)

        window.api.removeExtraListeners('autoLoginFailure', handleAutoLoginFail)
        window.api.on('autoLoginFailure', handleAutoLoginFail)

        window.api.removeExtraListeners('loginSuccess', handleLogIn)
        window.api.on('loginSuccess', handleLogIn)

        window.api.removeExtraListeners('login-failed', handleLoginFail)
        window.api.on('login-failed', handleLoginFail)

        return () => {
            window.api.removeListener('autoLoggingIn', handleIsLoggingIn)
            window.api.removeListener('autoLoginFailure', handleAutoLoginFail)
            window.api.removeListener('loginSuccess', handleLogIn)
            window.api.removeListener('login-failed', handleLoginFail)
        }
    }, [])

    return (
        <>
            {isLoading && (
                <Box pos="absolute" inset="0" bg="gray.800" opacity="50%">
                    <Center h="full">
                        <Spinner color="red.500" />
                    </Center>
                </Box>
            )}
            <Stack justifySelf="center">
                <Box>
                    <Text textStyle="4xl" color="red.600">
                        Logging you in!
                    </Text>
                </Box>
            </Stack>
        </>
    )
}
