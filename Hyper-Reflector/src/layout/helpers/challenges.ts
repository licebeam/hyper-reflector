import type { TMessage } from '../../state/store'
import { useMessageStore } from '../../state/store'

type DeclineHandler = (opponentId: string, challengerId: string) => void

type CancelForChallengerArgs = {
    challengerId: string
    excludeOpponentId?: string
    reason?: string
    declineChallenge?: DeclineHandler
    currentUserId?: string
}

type CancelInvolvingArgs = {
    participantIds: string[]
    excludeMessageIds?: string[]
    reason?: string
    declineChallenge?: DeclineHandler
    currentUserId?: string
}

const FALLBACK_DECLINE_REASON = 'System'

const toCleanString = (value: unknown): string | undefined => {
    if (typeof value === 'string') {
        const trimmed = value.trim()
        return trimmed.length ? trimmed : undefined
    }

    if (value && typeof value === 'object') {
        const { uid, id } = value as Record<string, unknown>
        if (typeof uid === 'string' && uid.trim().length) {
            return uid.trim()
        }
        if (typeof id === 'string' && id.trim().length) {
            return id.trim()
        }
    }

    return undefined
}

const tryCandidates = (...candidates: unknown[]): string | undefined => {
    for (const candidate of candidates) {
        const resolved = toCleanString(candidate)
        if (resolved) {
            return resolved
        }
    }
    return undefined
}

export const resolveChallengeParticipants = (
    message: TMessage | undefined
): { challengerId?: string; opponentId?: string } => {
    if (!message) {
        return {}
    }

    const challengerId = tryCandidates(
        message.challengeChallengerId,
        (message as any)?.challengerId,
        (message as any)?.challengerUID,
        (message as any)?.challenger,
        (message as any)?.callerId,
        (message as any)?.sender,
        (message as any)?.from
    )

    const opponentId = tryCandidates(
        message.challengeOpponentId,
        (message as any)?.opponentId,
        (message as any)?.opponentUID,
        (message as any)?.opponent,
        (message as any)?.targetUid,
        (message as any)?.targetId,
        (message as any)?.calleeId,
        (message as any)?.to
    )

    return { challengerId, opponentId }
}

export const normalizeChallengeParticipants = (
    message: TMessage | undefined,
    currentUserId?: string
): { challengerId?: string; opponentId?: string } => {
    let { challengerId, opponentId } = resolveChallengeParticipants(message)

    if (!challengerId) {
        challengerId = toCleanString((message as any)?.sender) ?? currentUserId
    }

    if (!opponentId) {
        opponentId =
            tryCandidates(
                (message as any)?.opponent,
                (message as any)?.targetUid,
                (message as any)?.targetId
            ) ?? (currentUserId && currentUserId !== challengerId ? currentUserId : opponentId)
    }

    return { challengerId, opponentId }
}

export const cancelPendingChallengesForChallenger = ({
    challengerId,
    excludeOpponentId,
    reason,
    declineChallenge,
    currentUserId,
}: CancelForChallengerArgs) => {
    if (!challengerId) {
        return
    }

    const { chatMessages, updateMessage } = useMessageStore.getState()
    const finalReason = reason ?? FALLBACK_DECLINE_REASON

    chatMessages.forEach((message) => {
        if (message.role !== 'challenge' || message.challengeStatus) {
            return
        }

        const { challengerId: messageChallenger, opponentId } =
            resolveChallengeParticipants(message)

        if (messageChallenger !== challengerId) {
            return
        }

        if (excludeOpponentId && opponentId === excludeOpponentId) {
            return
        }

        updateMessage(message.id, {
            challengeStatus: 'declined',
            challengeResponder: finalReason,
            challengeChallengerId: messageChallenger,
            challengeOpponentId: opponentId,
        })

        if (currentUserId && currentUserId === challengerId && opponentId) {
            declineChallenge?.(opponentId, challengerId)
        }
    })
}

export const cancelPendingChallengesInvolving = ({
    participantIds,
    excludeMessageIds,
    reason,
    declineChallenge,
    currentUserId,
}: CancelInvolvingArgs) => {
    if (!Array.isArray(participantIds) || participantIds.length === 0) {
        return
    }

    const idsToCheck = participantIds.filter((id): id is string => Boolean(id))
    if (!idsToCheck.length) {
        return
    }

    const { chatMessages, updateMessage } = useMessageStore.getState()
    const finalReason = reason ?? FALLBACK_DECLINE_REASON
    const excluded = new Set(excludeMessageIds ?? [])

    chatMessages.forEach((message) => {
        if (message.role !== 'challenge' || message.challengeStatus) {
            return
        }

        if (excluded.has(message.id)) {
            return
        }

        const { challengerId, opponentId } = resolveChallengeParticipants(message)

        if (!challengerId && !opponentId) {
            return
        }

        const involvesParticipant = idsToCheck.some(
            (id) => id === challengerId || id === opponentId
        )

        if (!involvesParticipant) {
            return
        }

        updateMessage(message.id, {
            challengeStatus: 'declined',
            challengeResponder: finalReason,
            challengeChallengerId: challengerId,
            challengeOpponentId: opponentId,
        })

        if (currentUserId) {
            const otherParty =
                currentUserId === challengerId
                    ? opponentId
                    : currentUserId === opponentId
                      ? challengerId
                      : undefined

            if (otherParty && otherParty !== currentUserId) {
                declineChallenge?.(otherParty, currentUserId)
            }
        }
    })
}

