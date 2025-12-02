import type { TUserTitle } from './user'

export type MatchPlayerSummary = {
    uid: string
    userName?: string
    userProfilePic?: string
    countryCode?: string
    userTitle?: TUserTitle
    accountElo?: number
    playerSlot: 0 | 1
}

export type MatchSummary = {
    id: string
    lobbyId: string
    gameName?: string | null
    startedAt: number
    players: MatchPlayerSummary[]
}
