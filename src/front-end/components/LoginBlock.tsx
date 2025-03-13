import { useEffect, useState } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { useLoginStore, useMessageStore } from '../state/store'
import { Button, Stack, Input, Box, Center, Spinner, Text, Heading, Flex } from '@chakra-ui/react'
import { PasswordInput } from './chakra/ui/password-input'
import { Field } from './chakra/ui/field'
import { Camera, Hammer } from 'lucide-react'

export default function LoginBlock() {
    const [isLoading, setIsLoading] = useState(false)
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)
    const failedLogin = useLoginStore((state) => state.failedLogin)
    const successLogin = useLoginStore((state) => state.successLogin)
    const setUserState = useLoginStore((state) => state.setUserState)
    const addUser = useMessageStore((state) => state.pushUser)
    const clearUserList = useMessageStore((state) => state.clearUserList)
    const [login, setLogin] = useState({
        name: 'no-one',
        email: '',
        pass: '',
    })
    const navigate = useNavigate()

    const handleIsLoggingIn = () => {
        setIsLoading(true)
    }

    const handleAutoLoginFail = () => {
        setIsLoading(false)
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
                <Box pos="absolute" inset="0" bg="bg/80">
                    <Center h="full">
                        <Spinner color="red.500" />
                    </Center>
                </Box>
            )}
            <Stack gap={2}>
                {!isLoading && <Heading size="md">Sign In</Heading>}
                <Box>
                    {!isLoading && !isLoggedIn && (
                        <Stack gap={6}>
                            <Field label="Email" required>
                                <Input
                                    placeholder="bobby@example.com"
                                    disabled={isLoading}
                                    onChange={(e) =>
                                        setLogin({
                                            name: login.name,
                                            email: e.target.value,
                                            pass: login.pass,
                                        })
                                    }
                                    type="text"
                                    value={login.email}
                                />
                            </Field>
                            <Field label="Password" required>
                                <PasswordInput
                                    placeholder="password"
                                    disabled={isLoading}
                                    onChange={(e) =>
                                        setLogin({
                                            name: login.name,
                                            email: login.email,
                                            pass: e.target.value,
                                        })
                                    }
                                    type="password"
                                    value={login.pass}
                                />
                            </Field>
                            <Stack>
                                <Button
                                    disabled={isLoading}
                                    id="login-btn"
                                    onClick={() => {
                                        setIsLoading(true)
                                        window.api.loginUser(login)
                                    }}
                                >
                                    Log In
                                </Button>
                                <Text textStyle="sm">
                                    <Link to="/create" className="[&.active]:font-bold">
                                        <Flex gap="1">
                                            <p> Create New Account </p>
                                            <Hammer size={18} />
                                        </Flex>
                                    </Link>
                                </Text>
                            </Stack>
                        </Stack>
                    )}
                </Box>
            </Stack>
        </>
    )
}
