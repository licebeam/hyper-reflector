export type MiniGameType = 'rps'

export type MiniGameChoice = 'rock' | 'paper' | 'scissors'

export type MiniGameSessionPayload = {
    sessionId: string
    challengerId: string
    opponentId: string
    gameType: MiniGameType
    expiresAt: number
}

export type MiniGameResultPayload = {
    sessionId: string
    challengerId: string
    opponentId: string
    gameType: MiniGameType
    choices: Record<string, MiniGameChoice | null>
    winnerUid?: string
    loserUid?: string
    outcome: 'win' | 'draw' | 'forfeit' | 'declined'
    ratings?: Record<string, number>
    ratingChanges?: Record<string, number>
    actorId?: string
}

export type MiniGameOption = {
    id: MiniGameChoice
    label: string
    description: string
    image: string
}

export type MiniGameUiState = {
    sessionId: string
    challengerId: string
    opponentId: string
    gameType: MiniGameType
    expiresAt: number
    phase: 'invite' | 'active'
    isInitiator: boolean
    status: 'pending' | 'submitted' | 'resolved' | 'declined'
    viewerChoice?: MiniGameChoice
    result?: MiniGameResultPayload
    sidePreferenceSubmitted?: boolean
    mode: 'live' | 'mock'
}
