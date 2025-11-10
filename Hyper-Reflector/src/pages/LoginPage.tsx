import { useEffect, useState } from 'react'
import { Link, useNavigate } from '@tanstack/react-router'
import {
    AlertDescription,
    AlertRoot,
    Box,
    Button,
    Flex,
    Heading,
    Input,
    Stack,
    Text,
} from '@chakra-ui/react'
import { Field } from '../components/chakra/ui/field'
import { PasswordInput } from '../components/chakra/ui/password-input'
import { onAuthStateChanged } from 'firebase/auth'
import type { FirebaseError } from 'firebase/app'
import { auth, loginEmail, loginGoogle } from '../utils/firebase'
import api from '../external-api/requests'
import type { TUser } from '../types/user'
import { useUserStore } from '../state/store'

export default function LoginPage() {
    const navigate = useNavigate()
    const globalLoggedIn = useUserStore((s) => s.globalLoggedIn)
    const setGlobalUser = useUserStore((s) => s.setGlobalUser)
    const setGlobalLoggedIn = useUserStore((s) => s.setGlobalLoggedIn)
    const [isLoading, setIsLoading] = useState(true)
    const [sessionUser, setSessionUser] = useState<TUser | undefined>()
    const [authError, setAuthError] = useState<string | null>(null)
    const [loginObject, setLoginObject] = useState<{ email: string; password: string }>({
        email: '',
        password: '',
    })

    const resetError = () => setAuthError(null)

    const handleFailUser = (message?: string) => {
        setSessionUser(undefined)
        setIsLoading(false)
        setGlobalLoggedIn(false)
        if (message) setAuthError(message)
    }

    useEffect(() => {
        const unsub = onAuthStateChanged(auth, async (login) => {
            if (!login) {
                handleFailUser()
                return
            }

            try {
                resetError()
                await api.addLoggedInUser(auth)
                await api.getLoggedInUser(login.email ?? '')
                const user = await api.getUserByAuth(auth)
                if (!user) throw new Error('Missing user profile')
                setSessionUser(user)
                setGlobalUser(user)
                setGlobalLoggedIn(true)
                navigate({ to: '/home' })
            } catch (err) {
                console.warn('failed to hydrate user session', err)
                handleFailUser('Unable to finish signing you in. Please try again.')
            } finally {
                setIsLoading(false)
            }
        })

        return () => unsub()
    }, [navigate, setGlobalLoggedIn, setGlobalUser])

    async function loginEmailHelper() {
        if (!loginObject.email || !loginObject.password) return
        setIsLoading(true)
        resetError()
        try {
            await loginEmail(loginObject.email, loginObject.password)
        } catch (e) {
            const err = e as FirebaseError
            console.warn('failed to log in', err.code, err.message)
            handleFailUser('Incorrect email or password.')
        }
    }

    async function loginGoogleHelper() {
        setIsLoading(true)
        resetError()
        try {
            await loginGoogle()
        } catch (e) {
            console.warn('failed to log in with google', e)
            handleFailUser('Google sign-in failed.')
        }
    }

    const isFormDisabled = isLoading || globalLoggedIn

    return (
        <Flex justify="center" align="center" minH="calc(100vh - 160px)" px={{ base: 4, md: 8 }}>
            <Box
                w="full"
                maxW="440px"
                bg="gray.900"
                borderWidth="1px"
                borderColor="whiteAlpha.200"
                borderRadius="2xl"
                p={{ base: 6, md: 8 }}
                boxShadow="2xl"
            >
                <Stack gap={6}>
                    <Stack gap={1} textAlign="center">
                        <Heading size="lg">Welcome back</Heading>
                        <Text color="whiteAlpha.700" fontSize="sm">
                            Sign in to jump into lobbies and track your matches.
                        </Text>
                        {sessionUser && (
                            <Text fontSize="sm" color="green.300">
                                Signed in as {sessionUser.userName}
                            </Text>
                        )}
                    </Stack>

                    {authError ? (
                        <AlertRoot
                            status="error"
                            borderRadius="lg"
                            bg="red.900"
                            borderColor="red.500"
                        >
                            <AlertDescription>{authError}</AlertDescription>
                        </AlertRoot>
                    ) : null}

                    {!globalLoggedIn && (
                        <Stack gap={4}>
                            <Field label="Email" required>
                                <Input
                                    disabled={isFormDisabled}
                                    maxLength={50}
                                    placeholder="hyper@reflector.com"
                                    onChange={(e) =>
                                        setLoginObject((prev) => ({
                                            ...prev,
                                            email: e.target.value,
                                        }))
                                    }
                                    type="email"
                                    value={loginObject.email}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            void loginEmailHelper()
                                        }
                                    }}
                                />
                            </Field>
                            <Field label="Password" required>
                                <PasswordInput
                                    disabled={isFormDisabled}
                                    maxLength={160}
                                    placeholder="password"
                                    onChange={(e) =>
                                        setLoginObject((prev) => ({
                                            ...prev,
                                            password: e.target.value,
                                        }))
                                    }
                                    type="password"
                                    value={loginObject.password}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') {
                                            void loginEmailHelper()
                                        }
                                    }}
                                />
                            </Field>
                            <Button
                                colorScheme="orange"
                                size="lg"
                                onClick={loginEmailHelper}
                                isDisabled={
                                    isFormDisabled ||
                                    !loginObject.email.trim() ||
                                    !loginObject.password.trim()
                                }
                                isLoading={isLoading}
                            >
                                Sign in
                            </Button>
                            <Button
                                variant="outline"
                                size="lg"
                                onClick={loginGoogleHelper}
                                isDisabled={isFormDisabled}
                                isLoading={isLoading && !globalLoggedIn}
                            >
                                Continue with Google
                            </Button>
                        </Stack>
                    )}

                    {globalLoggedIn ? (
                        <Stack gap={4}>
                            <AlertRoot status="success" borderRadius="lg" bg="green.900">
                                <AlertDescription>
                                    You&apos;re already signed in. Head to the dashboard to get
                                    started.
                                </AlertDescription>
                            </AlertRoot>
                            <Button colorScheme="orange" onClick={() => navigate({ to: '/home' })}>
                                Go to dashboard
                            </Button>
                        </Stack>
                    ) : null}

                    <Box h="1px" bg="whiteAlpha.200" />
                    <Text fontSize="sm" color="whiteAlpha.700" textAlign="center">
                        Need an account?{' '}
                        <Link to="/create" className="[&.active]:font-semibold">
                            <Text as="span" color="orange.300" fontWeight="semibold">
                                Create one now
                            </Text>
                        </Link>
                    </Text>
                </Stack>
            </Box>
        </Flex>
    )
}
