import { useState } from 'react'
import { IconButton, Stack, Text, Heading, Skeleton, Editable, Flex } from '@chakra-ui/react'
import { Check, Pencil, X } from 'lucide-react'

import {
    RegExpMatcher,
    TextCensor,
    englishDataset,
    englishRecommendedTransformers,
} from 'obscenity'
import { useLayoutStore } from '../../state/store'

const matcher = new RegExpMatcher({
    ...englishDataset.build(),
    ...englishRecommendedTransformers,
})

export default function GravatarInput({
    editedGravEmail,
    setEditedGravEmail,
    updateUserState,
    userState,
    userData,
    emailInvalid,
}) {
    const theme = useLayoutStore((state) => state.appTheme)
    const [isEditGravEmail, setIsEditGravEmail] = useState(false)

    return (
        <Stack>
            <Flex gap="2">
                <Text textStyle="xs" color={theme.colors.main.textMedium}>
                    Gravatar Email
                </Text>
                <a href="https://gravatar.com/" target="_blank" rel="noreferrer">
                    <Text textStyle="xs" color={theme.colors.main.action}>
                        Click here for: Gravatar Information / Settings
                    </Text>
                </a>
            </Flex>

            <Editable.Root
                //TODO:  Lets get rid of the email visibility.
                defaultValue={'my-email@email.com'}
                maxLength={128}
                onEditChange={(e) => setIsEditGravEmail(e.edit)}
                onValueCommit={(e) => {
                    const censor = new TextCensor()
                    const textMatch = e.value
                    const matches = matcher.getAllMatches(textMatch)
                    const censoredMessage = censor.applyTo(textMatch, matches)
                    setEditedGravEmail(censoredMessage)
                    updateUserState({ ...userState, gravEmail: censoredMessage })
                    window.api.changeUserData({ gravEmail: censoredMessage })
                }}
                onValueChange={(e) => setEditedGravEmail(e.value)}
                onValueRevert={(e) => {
                    setEditedGravEmail(e.value)
                    updateUserState({ ...userState, gravEmail: e.value })
                }}
                placeholder={'my-email@email.com'}
                value={editedGravEmail || userState.gravEmail}
                invalid={editedGravEmail && editedGravEmail.length <= 1 && emailInvalid}
            >
                {!isEditGravEmail && (
                    <Heading
                        flex="1"
                        size="lg"
                        color={theme.colors.main.actionSecondary}
                        width="100px"
                        height="36px"
                    >
                        {editedGravEmail || userData?.gravEmail || '' ? (
                            editedGravEmail || userData?.gravEmail || ''
                        ) : (
                            <Skeleton height="24px" />
                        )}
                    </Heading>
                )}

                <Editable.Input
                    id="test"
                    bg={theme.colors.main.textSubdued}
                    height="36px"
                    value={editedGravEmail}
                />
                {userData?.uid === userState.uid && (
                    <Editable.Control>
                        <Editable.EditTrigger asChild>
                            <IconButton variant="ghost" size="xs" color={theme.colors.main.action}>
                                <Pencil />
                            </IconButton>
                        </Editable.EditTrigger>
                        <Editable.CancelTrigger asChild>
                            <IconButton
                                variant="outline"
                                size="xs"
                                color={theme.colors.main.action}
                            >
                                <X />
                            </IconButton>
                        </Editable.CancelTrigger>
                        <Editable.SubmitTrigger asChild>
                            <IconButton
                                variant="outline"
                                size="xs"
                                color={theme.colors.main.action}
                            >
                                <Check />
                            </IconButton>
                        </Editable.SubmitTrigger>
                    </Editable.Control>
                )}
            </Editable.Root>
        </Stack>
    )
}
