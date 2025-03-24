import { useEffect, useState } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { useLoginStore, useMessageStore } from '../state/store'
import { Button, Stack, Input, Box, Center, Spinner, Text, Flex, Heading } from '@chakra-ui/react'
import { PasswordInput } from './chakra/ui/password-input'
import { Field } from './chakra/ui/field'
import { ArrowLeft } from 'lucide-react'

export default function CreateAccountBlock() {
    const [isLoading, setIsLoading] = useState(false)
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)
    const failedLogin = useLoginStore((state) => state.failedLogin)
    const successLogin = useLoginStore((state) => state.successLogin)
    const setUserState = useLoginStore((state) => state.setUserState)
    const addUser = useMessageStore((state) => state.pushUser)
    const clearUserList = useMessageStore((state) => state.clearUserList)
    const [login, setLogin] = useState({
        name: '',
        email: '',
        pass: '',
        repass: '',
    })
    const navigate = useNavigate()

    const handleCreateSuccess = () => {
        console.log('account created successfully')
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
        window.api.removeExtraListeners('accountCreationSuccess', handleCreateSuccess)
        window.api.on('accountCreationSuccess', handleCreateSuccess)

        window.api.removeExtraListeners('loginSuccess', handleLogIn)
        window.api.on('loginSuccess', handleLogIn)

        window.api.removeExtraListeners('login-failed', handleLoginFail)
        window.api.on('login-failed', handleLoginFail)

        return () => {
            window.api.removeListener('accountCreationSuccess', handleCreateSuccess)
            window.api.removeListener('loginSuccess', handleLogIn)
            window.api.removeListener('login-failed', handleLoginFail)
        }
    }, [])

    return (
        <Stack gap={2}>
            <Flex alignItems="center" gap="2">
                <Text textStyle="xs" color="red.400">
                    <Link to="/" className="[&.active]:font-bold">
                        <Flex gap="1">
                            <ArrowLeft size={18} />
                            <p>Login</p>
                        </Flex>
                    </Link>
                </Text>
                <Heading size="md" color="gray.300">
                    Account Creation
                </Heading>
            </Flex>
            <Box>
                {isLoading && (
                    <Box pos="absolute" inset="0" bg="gray.800" opacity="50%">
                        <Center h="full">
                            <Spinner color="teal.500" />
                        </Center>
                    </Box>
                )}
                {!isLoading && !isLoggedIn && (
                    <Stack gap={6}>
                        <Field
                            label="Display Name"
                            required
                            helperText="This is the name that other users will see, you can also change it later."
                            color="gray.400"
                            textDecorationColor="red"
                        >
                            <Input
                                bg="gray.200"
                                color="gray.900"
                                placeholder="my_user_name"
                                maxLength={16}
                                minLength={1}
                                onChange={(e) =>
                                    setLogin({
                                        name: e.target.value,
                                        email: login.email,
                                        pass: login.pass,
                                        repass: login.repass,
                                    })
                                }
                                type="text"
                                value={login.name}
                            />
                        </Field>
                        <Field label="Email" required color="gray.400">
                            <Input
                                bg="gray.200"
                                color="gray.900"
                                placeholder="blake@example.com"
                                onChange={(e) =>
                                    setLogin({
                                        name: login.name,
                                        email: e.target.value,
                                        pass: login.pass,
                                        repass: login.repass,
                                    })
                                }
                                type="text"
                                value={login.email}
                            />
                        </Field>
                        <Field
                            label="Password"
                            required
                            helperText="Must be atleast 6 alphanumeric characters in length."
                            color="gray.400"
                        >
                            <PasswordInput
                                bg="gray.200"
                                color="gray.900"
                                placeholder="password"
                                onChange={(e) =>
                                    setLogin({
                                        name: login.name,
                                        email: login.email,
                                        pass: e.target.value,
                                        repass: login.repass,
                                    })
                                }
                                type="password"
                                value={login.pass}
                            />
                        </Field>
                        <Field label="Re-enter Password" required color="gray.400">
                            <PasswordInput
                                bg="gray.200"
                                color="gray.900"
                                placeholder="re-enter password"
                                onChange={(e) =>
                                    setLogin({
                                        name: login.name,
                                        email: login.email,
                                        pass: login.pass,
                                        repass: e.target.value,
                                    })
                                }
                                type="password"
                                value={login.repass}
                            />
                        </Field>
                        <Stack>
                            <Button
                                bg="blue.500"
                                disabled={
                                    isLoading ||
                                    !login.pass ||
                                    !login.repass ||
                                    !login.email ||
                                    !login.name
                                }
                                id="create-btn"
                                onClick={() => {
                                    setIsLoading(true)
                                    window.api.createAccount(login)
                                }}
                            >
                                Create Account
                            </Button>
                        </Stack>
                    </Stack>
                )}
            </Box>
        </Stack>
    )
}
