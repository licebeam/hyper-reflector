import { useState } from 'react'
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
import { createUserWithEmailAndPassword } from 'firebase/auth'
import type { FirebaseError } from 'firebase/app'
import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from 'obscenity'
import { auth } from '../utils/firebase'
import api from '../external-api/requests'
import { useUserStore } from '../state/store'

const matcher = new RegExpMatcher({
    ...englishDataset.build(),
    ...englishRecommendedTransformers,
})

export default function CreateAccountPage() {
    const navigate = useNavigate()
    const setGlobalUser = useUserStore((s) => s.setGlobalUser)
    const setGlobalLoggedIn = useUserStore((s) => s.setGlobalLoggedIn)
    const [form, setForm] = useState({ name: '', email: '', pass: '', repass: '' })
    const [isLoading, setIsLoading] = useState(false)
    const [errorMessage, setErrorMessage] = useState<string | null>(null)
    const [nameInvalid, setNameInvalid] = useState(false)
    const [nameWarning, setNameWarning] = useState<string | null>(null)

    const updateField = (key: keyof typeof form, value: string) => {
        setForm((prev) => ({ ...prev, [key]: value }))
    }

    const validateDisplayName = (value: string) => {
        if (!value.trim()) {
            setNameInvalid(true)
            setNameWarning('Display name is required.')
            return
        }
        if (matcher.hasMatch(value)) {
            setNameInvalid(true)
            setNameWarning('Please pick a different display name.')
        } else {
            setNameInvalid(false)
            setNameWarning(null)
        }
    }

    const mapFirebaseError = (error: FirebaseError) => {
        switch (error.code) {
            case 'auth/email-already-in-use':
                return 'That email is already registered. Try signing in instead.'
            case 'auth/weak-password':
                return 'Passwords must be at least 6 characters.'
            case 'auth/invalid-email':
                return 'Please provide a valid email address.'
            default:
                return 'We could not create your account. Please try again.'
        }
    }

    const createAccount = async () => {
        if (form.pass !== form.repass) {
            setErrorMessage('Passwords must match.')
            return
        }
        if (!form.name.trim() || nameInvalid) {
            setErrorMessage('Please provide an appropriate display name.')
            return
        }
        if (nameInvalid) return

        setIsLoading(true)
        setErrorMessage(null)
        try {
            await createUserWithEmailAndPassword(auth, form.email.trim(), form.pass)
            await api.createAccount(auth, form.name.trim(), form.email.trim())
            await api.addLoggedInUser(auth)
            const user = await api.getUserByAuth(auth)
            if (!user) throw new Error('Missing user profile')
            setGlobalUser(user)
            setGlobalLoggedIn(true)
            navigate({ to: '/home' })
        } catch (err) {
            console.warn('create account failed', err)
            if ('code' in (err as FirebaseError)) {
                setErrorMessage(mapFirebaseError(err as FirebaseError))
            } else {
                setErrorMessage('Something went wrong while creating your account.')
            }
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <Flex justify="center" align="center" minH="calc(100vh - 160px)" px={{ base: 4, md: 8 }}>
            <Box
                w="full"
                maxW="640px"
                bg="gray.900"
                borderWidth="1px"
                borderColor="whiteAlpha.200"
                borderRadius="2xl"
                p={{ base: 6, md: 10 }}
                boxShadow="2xl"
            >
                <Stack gap={6}>
                    <Stack gap={1}>
                        <Text fontSize="sm" color="orange.300">
                            <Link to="/" className="[&.active]:font-semibold">
                                Back to sign in
                            </Link>
                        </Text>
                        <Heading size="lg">Create your account</Heading>
                        <Text color="whiteAlpha.700" fontSize="sm">
                            Pick a display name, set your credentials, and start tracking matches.
                        </Text>
                    </Stack>

                    {errorMessage ? (
                        <AlertRoot status="error" borderRadius="lg" bg="red.900">
                            <AlertDescription>{errorMessage}</AlertDescription>
                        </AlertRoot>
                    ) : null}

                    <Stack gap={4}>
                        <Field
                            label="Display name"
                            helperText={
                                nameWarning || 'This is what other players will see. Keep it clean.'
                            }
                            required
                        >
                            <Input
                                value={form.name}
                                maxLength={16}
                                placeholder="OrchidKid"
                                onChange={(e) => {
                                    updateField('name', e.target.value)
                                    validateDisplayName(e.target.value)
                                }}
                                disabled={isLoading}
                            />
                        </Field>
                        <Field label="Email" required>
                            <Input
                                type="email"
                                value={form.email}
                                maxLength={50}
                                placeholder="player@example.com"
                                onChange={(e) => updateField('email', e.target.value)}
                                disabled={isLoading}
                            />
                        </Field>
                        <Field
                            label="Password"
                            required
                            helperText="Use at least 6 characters."
                        >
                            <PasswordInput
                                value={form.pass}
                                maxLength={160}
                                onChange={(e) => updateField('pass', e.target.value)}
                                disabled={isLoading}
                            />
                        </Field>
                        <Field label="Confirm password" required>
                            <PasswordInput
                                value={form.repass}
                                maxLength={160}
                                onChange={(e) => updateField('repass', e.target.value)}
                                disabled={isLoading}
                            />
                        </Field>
                    </Stack>

                    <Button
                        colorScheme="orange"
                        size="lg"
                        onClick={createAccount}
                        isLoading={isLoading}
                        isDisabled={
                            !form.name.trim() ||
                            !form.email.trim() ||
                            !form.pass ||
                            !form.repass ||
                            nameInvalid
                        }
                    >
                        Create account
                    </Button>
                </Stack>
            </Box>
        </Flex>
    )
}
