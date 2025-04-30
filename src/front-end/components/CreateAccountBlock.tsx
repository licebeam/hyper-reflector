import { useEffect, useState } from 'react'
import { useNavigate, Link } from '@tanstack/react-router'
import { useLayoutStore, useLoginStore, useMessageStore } from '../state/store'
import { Button, Stack, Input, Box, Center, Spinner, Text, Flex, Heading } from '@chakra-ui/react'
import { PasswordInput } from './chakra/ui/password-input'
import { Field } from './chakra/ui/field'
import { ArrowLeft } from 'lucide-react'
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity'

const matcher = new RegExpMatcher({
    ...englishDataset.build(),
    ...englishRecommendedTransformers,
})

export default function CreateAccountBlock() {
    const theme = useLayoutStore((state) => state.appTheme)
    const [isLoading, setIsLoading] = useState(false)
    const isLoggedIn = useLoginStore((state) => state.isLoggedIn)
    const failedLogin = useLoginStore((state) => state.failedLogin)
    const successLogin = useLoginStore((state) => state.successLogin)
    const setUserState = useLoginStore((state) => state.setUserState)
    const addUser = useMessageStore((state) => state.pushUser)
    const clearUserList = useMessageStore((state) => state.clearUserList)
    const [nameInvalid, setNameInvalid] = useState<boolean>(false)
    const [login, setLogin] = useState({
        name: '',
        email: '',
        pass: '',
        repass: '',
    })
    const navigate = useNavigate()

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
        window.api.removeExtraListeners('loginSuccess', handleLogIn)
        window.api.on('loginSuccess', handleLogIn)

        window.api.removeExtraListeners('login-failed', handleLoginFail)
        window.api.on('login-failed', handleLoginFail)

        return () => {
            window.api.removeListener('loginSuccess', handleLogIn)
            window.api.removeListener('login-failed', handleLoginFail)
        }
    }, [])

    return (
        <Stack gap={2}>
            <Flex alignItems="center" gap="2">
                <Text textStyle="xs" color={theme.colors.main.action}>
                    <Link to="/" className="[&.active]:font-bold">
                        <Flex gap="1">
                            <ArrowLeft size={18} />
                            <div>Login</div>
                        </Flex>
                    </Link>
                </Text>
                <Heading size="md" color={theme.colors.main.textMedium}>
                    Account Creation
                </Heading>
            </Flex>
            <Box>
                {isLoading && (
                    <Box pos="absolute" inset="0" bg={theme.colors.main.bg} opacity="50%">
                        <Center h="full">
                            <Spinner color={theme.colors.main.action} />
                        </Center>
                    </Box>
                )}
                {!isLoading && !isLoggedIn && (
                    <Stack gap={6}>
                        <Field
                            label="Display Name"
                            required
                            helperText="This is the name that other users will see, you can also change it later."
                            color={theme.colors.main.textMedium}
                            textDecorationColor="red"
                        >
                            <Input
                                bg={theme.colors.main.textSubdued}
                                color={theme.colors.main.bg}
                                placeholder="my_user_name"
                                maxLength={16}
                                minLength={1}
                                onChange={(e) => {
                                    if (matcher.hasMatch(e.target.value)) {
                                        setNameInvalid(true)
                                    } else {
                                        setNameInvalid(false)
                                    }
                                    setLogin({
                                        name: e.target.value,
                                        email: login.email,
                                        pass: login.pass,
                                        repass: login.repass,
                                    })
                                }}
                                type="text"
                                value={login.name}
                            />
                        </Field>
                        <Field label="Email" required color={theme.colors.main.textMedium}>
                            <Input
                                bg={theme.colors.main.textSubdued}
                                color={theme.colors.main.bg}
                                maxLength={50}
                                minLength={1}
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
                            color={theme.colors.main.textMedium}
                        >
                            <PasswordInput
                                bg={theme.colors.main.textSubdued}
                                color={theme.colors.main.bg}
                                maxLength={160}
                                minLength={1}
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
                        <Field
                            label="Re-enter Password"
                            required
                            color={theme.colors.main.textMedium}
                        >
                            <PasswordInput
                                bg={theme.colors.main.textSubdued}
                                color={theme.colors.main.bg}
                                maxLength={160}
                                minLength={1}
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
                                bg={theme.colors.main.actionSecondary}
                                disabled={
                                    nameInvalid ||
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
